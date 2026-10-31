"""Availability, booking rules and reminder scheduling. Every booking path (public, admin, barber) goes through here."""

import logging
import os
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from lib import whatsapp
from lib.db import db
from models.schemas import AppointmentCreate, new_id

log = logging.getLogger(__name__)

SLOT = 30  # every appointment lasts 30 minutes, regardless of service
MAX_DAYS_AHEAD = 60
TZ_NAME = os.environ.get("APP_TZ", "America/Sao_Paulo")
TZ = ZoneInfo(TZ_NAME)
SHOP_NAME = os.environ.get("SHOP_NAME", "RPG Barbearia")


def to_min(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def to_hhmm(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"


def now_local() -> datetime:
    return datetime.now(TZ)


def today_str() -> str:
    return now_local().strftime("%Y-%m-%d")


def local_to_utc(d: str, t: str) -> datetime:
    return datetime.fromisoformat(f"{d}T{t}").replace(tzinfo=TZ).astimezone(timezone.utc)


def working_slots(barber: dict, date_str: str) -> list[str]:
    if not barber.get("active", True) or date_str in barber.get("days_off", []):
        return []
    wd = date.fromisoformat(date_str).weekday()
    day = next((s for s in barber.get("schedule", []) if s["weekday"] == wd), None)
    if not day or not day.get("enabled"):
        return []
    start, end = to_min(day["start"]), to_min(day["end"])
    bs = to_min(day["break_start"]) if day.get("break_start") and day.get("break_end") else None
    be = to_min(day["break_end"]) if bs is not None else None
    out, m = [], start
    while m + SLOT <= end:
        if bs is None or not (m < be and m + SLOT > bs):
            out.append(to_hhmm(m))
        m += SLOT
    return out


async def available_slots(barber: dict, date_str: str, exclude_id: str | None = None) -> list[str]:
    today = today_str()
    if date_str < today:
        return []
    if date.fromisoformat(date_str) > date.fromisoformat(today) + timedelta(days=MAX_DAYS_AHEAD):
        return []
    slots = working_slots(barber, date_str)
    if not slots:
        return []
    q: dict = {"barber_id": barber["id"], "date": date_str, "status": {"$ne": "cancelled"}}
    if exclude_id:
        q["id"] = {"$ne": exclude_id}
    taken = [to_min(a["time"]) for a in await db.appointments.find(q, {"time": 1}).to_list(500)]
    blocks = await db.blocks.find({"barber_id": barber["id"], "date": date_str}).to_list(200)
    now_min = to_min(now_local().strftime("%H:%M"))
    result = []
    for s in slots:
        sm = to_min(s)
        if date_str == today and sm <= now_min:
            continue
        if any(abs(sm - t) < SLOT for t in taken):
            continue
        if any(sm < to_min(b["end"]) and sm + SLOT > to_min(b["start"]) for b in blocks):
            continue
        result.append(s)
    return result


async def _load_refs(data: AppointmentCreate) -> tuple[dict, dict]:
    barber = await db.barbers.find_one({"id": data.barber_id}, {"_id": 0})
    if not barber or not barber.get("active", True):
        raise HTTPException(400, "Barbeiro indisponível")
    service = await db.services.find_one({"id": data.service_id}, {"_id": 0})
    if not service or not service.get("active", True):
        raise HTTPException(400, "Serviço indisponível")
    return barber, service


def _slot_key(barber_id: str, d: str, t: str) -> str:
    return f"{barber_id}|{d}|{t}"


def _fields(data: AppointmentCreate, barber: dict, service: dict) -> dict:
    return {
        "barber_id": barber["id"],
        "barber_name": barber["name"],
        "service_id": service["id"],
        "service_name": service["name"],
        "client_name": data.client_name,
        "client_phone": data.client_phone,
        "date": data.date,
        "time": data.time,
        "end_time": to_hhmm(to_min(data.time) + SLOT),
        "duration_minutes": SLOT,
        "starts_at": local_to_utc(data.date, data.time),
        "slot_key": _slot_key(barber["id"], data.date, data.time),
    }


async def create_appointment(data: AppointmentCreate, source: str) -> dict:
    barber, service = await _load_refs(data)
    if data.time not in await available_slots(barber, data.date):
        raise HTTPException(409, "Horário indisponível. Escolha outro horário.")
    doc = {
        "id": new_id(),
        **_fields(data, barber, service),
        "status": "scheduled",
        "source": source,
        "created_at": datetime.now(timezone.utc),
    }
    try:
        await db.appointments.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, "Horário indisponível. Escolha outro horário.")
    await db.clients.update_one(
        {"phone": data.client_phone},
        {"$set": {"phone": data.client_phone, "name": data.client_name, "last_seen": doc["created_at"]},
         "$setOnInsert": {"id": new_id()}},
        upsert=True,
    )
    await schedule_reminders(doc)
    doc.pop("_id", None)
    return doc


async def reschedule_appointment(appt: dict, data: AppointmentCreate) -> dict:
    if appt["status"] != "scheduled":
        raise HTTPException(400, "Somente agendamentos ativos podem ser alterados")
    barber, service = await _load_refs(data)
    if data.time not in await available_slots(barber, data.date, exclude_id=appt["id"]):
        raise HTTPException(409, "Horário indisponível. Escolha outro horário.")
    fields = _fields(data, barber, service)
    try:
        await db.appointments.update_one({"id": appt["id"]}, {"$set": fields})
    except DuplicateKeyError:
        raise HTTPException(409, "Horário indisponível. Escolha outro horário.")
    await cancel_reminders(appt["id"])
    updated = {**appt, **fields}
    await schedule_reminders(updated)
    return updated


async def cancel_appointment(appt: dict) -> dict:
    if appt["status"] != "scheduled":
        raise HTTPException(400, "Este agendamento não pode ser cancelado")
    upd = {"status": "cancelled", "slot_key": f"x|{appt['id']}"}
    await db.appointments.update_one({"id": appt["id"]}, {"$set": upd})
    await cancel_reminders(appt["id"])
    return {**appt, **upd}


async def complete_appointment(appt: dict) -> dict:
    if appt["status"] != "scheduled":
        raise HTTPException(400, "Este agendamento não pode ser concluído")
    await db.appointments.update_one({"id": appt["id"]}, {"$set": {"status": "completed"}})
    await cancel_reminders(appt["id"])
    return {**appt, "status": "completed"}


# ---------- reminders ----------
def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def reminder_parts(appt: dict, send_at: datetime) -> tuple[list[str], str]:
    d = date.fromisoformat(appt["date"])
    date_br = d.strftime("%d/%m/%Y")
    same_day = send_at.astimezone(TZ).date() == d
    when = f"hoje ({date_br})" if same_day else f"no dia {date_br}"
    hour = appt["time"].replace(":", "h")
    first = appt["client_name"].split()[0]
    text = (
        f"Olá, {first}! Tudo bem? Passando para lembrar que você tem um horário agendado na {SHOP_NAME} "
        f"{when} às {hour}, com o barbeiro {appt['barber_name']}. "
        f"Seu atendimento será {appt['service_name']}. Esperamos você!"
    )
    params = [first, date_br, hour, appt["barber_name"], appt["service_name"], SHOP_NAME]
    return params, text


async def schedule_reminders(appt: dict) -> None:
    starts = _aware(appt["starts_at"])
    now = datetime.now(timezone.utc)
    docs = []
    for kind, hours in (("6h", 6), ("1h", 1)):
        send_at = starts - timedelta(hours=hours)
        _, text = reminder_parts(appt, send_at)
        docs.append({
            "id": new_id(),
            "appointment_id": appt["id"],
            "kind": kind,
            "send_at": send_at,
            "status": "pending" if send_at > now - timedelta(minutes=5) else "skipped",
            "mode": None,
            "message": text,
            "client_name": appt["client_name"],
            "client_phone": appt["client_phone"],
            "barber_name": appt["barber_name"],
            "sent_at": None,
            "error": None,
        })
    await db.reminders.insert_many(docs)


async def cancel_reminders(appointment_id: str) -> None:
    await db.reminders.update_many(
        {"appointment_id": appointment_id, "status": "pending"}, {"$set": {"status": "cancelled"}}
    )


async def process_due_reminders() -> int:
    now = datetime.now(timezone.utc)
    processed = 0
    while True:
        # atomic claim → a reminder is sent at most once even with overlapping runs
        rem = await db.reminders.find_one_and_update(
            {"status": "pending", "send_at": {"$lte": now}}, {"$set": {"status": "sending"}}
        )
        if not rem:
            break
        processed += 1
        appt = await db.appointments.find_one({"id": rem["appointment_id"]})
        if not appt or appt["status"] != "scheduled" or _aware(appt["starts_at"]) <= now:
            await db.reminders.update_one({"id": rem["id"]}, {"$set": {"status": "cancelled"}})
            continue
        params, text = reminder_parts(appt, _aware(rem["send_at"]))
        try:
            res = await whatsapp.send_reminder(phone=appt["client_phone"], params=params, text=text)
            await db.reminders.update_one(
                {"id": rem["id"]},
                {"$set": {"status": "sent", "mode": res["mode"], "message": text, "sent_at": datetime.now(timezone.utc)}},
            )
        except Exception as exc:  # keep the batch going; the log shows the failure
            log.error("reminder %s failed: %s", rem["id"], exc)
            await db.reminders.update_one(
                {"id": rem["id"]}, {"$set": {"status": "failed", "mode": whatsapp.mode(), "error": str(exc)[:300]}}
            )
    return processed
