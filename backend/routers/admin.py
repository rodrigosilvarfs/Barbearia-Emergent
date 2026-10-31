"""Admin area — every route requires role=admin (router-level dependency)."""

from collections import defaultdict
from datetime import date as date_cls, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.errors import DuplicateKeyError

from lib import whatsapp
from lib.auth import hash_password, require_admin
from lib.db import db
from lib.scheduling import (
    available_slots, cancel_appointment, complete_appointment, create_appointment,
    process_due_reminders, reschedule_appointment, to_min, today_str, now_local,
)
from models.schemas import (
    Appointment, AppointmentCreate, AvailabilityOut, Barber, BarberCreate, BarberStat, BarberUpdate,
    Block, BlockIn, Dashboard, Reminder, RemindersOut, RunResult, Service, ServiceIn, new_id,
)

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


# ---------- barbers ----------
async def _barber_out(doc: dict) -> Barber:
    user = await db.users.find_one({"barber_id": doc["id"]}, {"email": 1})
    return Barber(**doc, email=user["email"] if user else None)


async def _get_barber(barber_id: str) -> dict:
    doc = await db.barbers.find_one({"id": barber_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Barbeiro não encontrado")
    return doc


@router.get("/barbers", response_model=list[Barber])
async def list_barbers():
    docs = await db.barbers.find({}, {"_id": 0}).sort("name", 1).to_list(200)
    return [await _barber_out(d) for d in docs]


@router.post("/barbers", response_model=Barber, status_code=201)
async def create_barber(body: BarberCreate):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "E-mail já cadastrado")
    barber = {
        "id": new_id(), "name": body.name, "bio": body.bio, "photo_url": body.photo_url, "active": body.active,
        "schedule": [s.model_dump() for s in body.schedule], "days_off": sorted(set(body.days_off)),
    }
    await db.barbers.insert_one(dict(barber))
    try:
        await db.users.insert_one({
            "id": new_id(), "email": email, "password_hash": hash_password(body.password),
            "role": "barber", "name": body.name, "barber_id": barber["id"],
        })
    except DuplicateKeyError:
        await db.barbers.delete_one({"id": barber["id"]})
        raise HTTPException(409, "E-mail já cadastrado")
    return Barber(**barber, email=email)


@router.put("/barbers/{barber_id}", response_model=Barber)
async def update_barber(barber_id: str, body: BarberUpdate):
    await _get_barber(barber_id)
    data = body.model_dump(exclude_unset=True, exclude_none=True)
    email, password = data.pop("email", None), data.pop("password", None)
    if "days_off" in data:
        data["days_off"] = sorted(set(data["days_off"]))
    if data:
        await db.barbers.update_one({"id": barber_id}, {"$set": data})
    user_set: dict = {}
    if email:
        email = email.lower()
        clash = await db.users.find_one({"email": email, "barber_id": {"$ne": barber_id}})
        if clash:
            raise HTTPException(409, "E-mail já cadastrado")
        user_set["email"] = email
    if password:
        user_set["password_hash"] = hash_password(password)
    if "name" in data:
        user_set["name"] = data["name"]
    if user_set:
        await db.users.update_one({"barber_id": barber_id}, {"$set": user_set})
    return await _barber_out(await _get_barber(barber_id))


@router.delete("/barbers/{barber_id}", status_code=204)
async def delete_barber(barber_id: str):
    await _get_barber(barber_id)
    future = await db.appointments.find(
        {"barber_id": barber_id, "status": "scheduled", "date": {"$gte": today_str()}}, {"_id": 0}
    ).to_list(2000)
    for appt in future:
        await cancel_appointment(appt)
    await db.barbers.delete_one({"id": barber_id})
    await db.users.delete_many({"barber_id": barber_id})
    await db.blocks.delete_many({"barber_id": barber_id})


# ---------- services ----------
@router.get("/services", response_model=list[Service])
async def list_services():
    return [Service(**d) for d in await db.services.find({}, {"_id": 0}).sort("name", 1).to_list(200)]


@router.post("/services", response_model=Service, status_code=201)
async def create_service(body: ServiceIn):
    svc = Service(**body.model_dump())
    await db.services.insert_one(svc.model_dump())
    return svc


@router.put("/services/{service_id}", response_model=Service)
async def update_service(service_id: str, body: ServiceIn):
    res = await db.services.update_one({"id": service_id}, {"$set": body.model_dump()})
    if not res.matched_count:
        raise HTTPException(404, "Serviço não encontrado")
    return Service(id=service_id, **body.model_dump())


@router.delete("/services/{service_id}", status_code=204)
async def delete_service(service_id: str):
    res = await db.services.delete_one({"id": service_id})
    if not res.deleted_count:
        raise HTTPException(404, "Serviço não encontrado")


# ---------- appointments ----------
async def _get_appt(appt_id: str) -> dict:
    appt = await db.appointments.find_one({"id": appt_id}, {"_id": 0})
    if not appt:
        raise HTTPException(404, "Agendamento não encontrado")
    return appt


@router.get("/appointments", response_model=list[Appointment])
async def list_appointments(
    barber_id: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None,
    status: Optional[str] = None,
):
    q: dict = {}
    if barber_id:
        q["barber_id"] = barber_id
    if date_from or date_to:
        q["date"] = {k: v for k, v in (("$gte", date_from), ("$lte", date_to)) if v}
    if status:
        q["status"] = {"$in": status.split(",")}
    docs = await db.appointments.find(q, {"_id": 0}).sort([("date", 1), ("time", 1)]).to_list(2000)
    return [Appointment(**d) for d in docs]


@router.get("/availability", response_model=AvailabilityOut)
async def admin_availability(barber_id: str, date: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}$"), exclude_id: Optional[str] = None):
    barber = await _get_barber(barber_id)
    return AvailabilityOut(barber_id=barber_id, date=date, slots=await available_slots(barber, date, exclude_id))


@router.post("/appointments", response_model=Appointment, status_code=201)
async def admin_create(body: AppointmentCreate):
    return Appointment(**await create_appointment(body, "manual"))


@router.put("/appointments/{appt_id}", response_model=Appointment)
async def admin_update(appt_id: str, body: AppointmentCreate):
    return Appointment(**await reschedule_appointment(await _get_appt(appt_id), body))


@router.post("/appointments/{appt_id}/cancel", response_model=Appointment)
async def admin_cancel(appt_id: str):
    return Appointment(**await cancel_appointment(await _get_appt(appt_id)))


@router.post("/appointments/{appt_id}/complete", response_model=Appointment)
async def admin_complete(appt_id: str):
    return Appointment(**await complete_appointment(await _get_appt(appt_id)))


# ---------- blocks ----------
@router.get("/blocks", response_model=list[Block])
async def list_blocks():
    docs = await db.blocks.find({"date": {"$gte": today_str()}}, {"_id": 0}).sort([("date", 1), ("start", 1)]).to_list(500)
    return [Block(**d) for d in docs]


@router.post("/blocks", response_model=Block, status_code=201)
async def create_block(body: BlockIn):
    barber = await _get_barber(body.barber_id)
    if to_min(body.end) <= to_min(body.start):
        raise HTTPException(400, "O horário final deve ser depois do inicial")
    block = Block(**body.model_dump(), id=new_id(), barber_name=barber["name"])
    await db.blocks.insert_one(block.model_dump())
    return block


@router.delete("/blocks/{block_id}", status_code=204)
async def delete_block(block_id: str):
    res = await db.blocks.delete_one({"id": block_id})
    if not res.deleted_count:
        raise HTTPException(404, "Bloqueio não encontrado")


# ---------- reminders ----------
@router.get("/reminders", response_model=RemindersOut)
async def list_reminders():
    docs = await db.reminders.find({}, {"_id": 0}).sort("send_at", -1).to_list(200)
    return RemindersOut(mode=whatsapp.mode(), template_name=whatsapp.template_name(), items=[Reminder(**d) for d in docs])


@router.post("/reminders/run", response_model=RunResult)
async def run_reminders():
    return RunResult(processed=await process_due_reminders())


# ---------- dashboard ----------
@router.get("/dashboard", response_model=Dashboard)
async def dashboard():
    today = today_str()
    now_hm = now_local().strftime("%H:%M")
    todays = await db.appointments.find({"date": today}, {"_id": 0}).to_list(2000)
    upcoming = await db.appointments.find(
        {"status": "scheduled", "$or": [{"date": {"$gt": today}}, {"date": today, "time": {"$gte": now_hm}}]},
        {"_id": 0},
    ).sort([("date", 1), ("time", 1)]).to_list(2000)
    month_start = date_cls.fromisoformat(today).replace(day=1).isoformat()
    month = await db.appointments.find({"date": {"$gte": month_start}}, {"_id": 0, "barber_id": 1, "barber_name": 1, "status": 1}).to_list(10000)
    stats: dict = defaultdict(lambda: {"total": 0, "completed": 0, "cancelled": 0, "barber_name": ""})
    for b in await db.barbers.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(200):
        stats[b["id"]]["barber_name"] = b["name"]
    for a in month:
        s = stats[a["barber_id"]]
        s["barber_name"] = s["barber_name"] or a["barber_name"]
        s["total"] += 1
        if a["status"] in ("completed", "cancelled"):
            s[a["status"]] += 1
    return Dashboard(
        today=today,
        total_today=sum(1 for a in todays if a["status"] != "cancelled"),
        upcoming_count=len(upcoming),
        completed_today=sum(1 for a in todays if a["status"] == "completed"),
        cancelled_today=sum(1 for a in todays if a["status"] == "cancelled"),
        upcoming=[Appointment(**a) for a in upcoming[:8]],
        by_barber=[BarberStat(barber_id=k, **v) for k, v in stats.items()],
    )
