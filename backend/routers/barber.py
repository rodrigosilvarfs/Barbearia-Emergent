"""Barber area — every query is scoped to the caller's own barber_id (foreign ids → 404)."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import require_barber
from lib.db import db
from lib.scheduling import cancel_appointment, complete_appointment, to_min, today_str
from models.schemas import Appointment, BarberPublic, MyScheduleUpdate

router = APIRouter(prefix="/barber", tags=["barber"])


async def _own(appt_id: str, user: dict) -> dict:
    appt = await db.appointments.find_one({"id": appt_id, "barber_id": user["barber_id"]}, {"_id": 0})
    if not appt:
        raise HTTPException(404, "Agendamento não encontrado")
    return appt


@router.get("/profile", response_model=BarberPublic)
async def profile(user: dict = Depends(require_barber)):
    doc = await db.barbers.find_one({"id": user["barber_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Barbeiro não encontrado")
    return BarberPublic(**doc)


@router.put("/schedule", response_model=BarberPublic)
async def update_my_schedule(body: MyScheduleUpdate, user: dict = Depends(require_barber)):
    doc = await db.barbers.find_one({"id": user["barber_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Barbeiro não encontrado")
    hours = {h.weekday: h for h in body.hours}
    schedule = []
    for day in doc.get("schedule", []):
        h = hours.get(day["weekday"])
        if h:
            if to_min(h.end) <= to_min(h.start):
                raise HTTPException(400, "O horário de término deve ser depois do início")
            day = {**day, "start": h.start, "end": h.end}  # enabled/intervalo continuam com o admin
        schedule.append(day)
    today = today_str()
    days_off = sorted({d for d in body.days_off if d >= today} | {d for d in doc.get("days_off", []) if d < today})
    await db.barbers.update_one({"id": doc["id"]}, {"$set": {"schedule": schedule, "days_off": days_off}})
    return BarberPublic(**{**doc, "schedule": schedule, "days_off": days_off})


@router.get("/appointments", response_model=list[Appointment])
async def my_appointments(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(require_barber),
):
    q: dict = {"barber_id": user["barber_id"]}
    if date_from or date_to:
        q["date"] = {k: v for k, v in (("$gte", date_from), ("$lte", date_to)) if v}
    if status:
        q["status"] = {"$in": status.split(",")}
    docs = await db.appointments.find(q, {"_id": 0}).sort([("date", 1), ("time", 1)]).to_list(2000)
    return [Appointment(**d) for d in docs]


@router.post("/appointments/{appt_id}/complete", response_model=Appointment)
async def complete(appt_id: str, user: dict = Depends(require_barber)):
    return Appointment(**await complete_appointment(await _own(appt_id, user)))


@router.post("/appointments/{appt_id}/cancel", response_model=Appointment)
async def cancel(appt_id: str, user: dict = Depends(require_barber)):
    return Appointment(**await cancel_appointment(await _own(appt_id, user)))
