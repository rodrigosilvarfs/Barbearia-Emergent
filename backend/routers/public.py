from fastapi import APIRouter, HTTPException, Query

from lib.db import db
from lib.scheduling import MAX_DAYS_AHEAD, SHOP_NAME, SLOT, TZ_NAME, available_slots, create_appointment, now_local
from models.schemas import Appointment, AppointmentCreate, AvailabilityOut, BarberPublic, Service, ShopInfo

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/info", response_model=ShopInfo)
async def info():
    now = now_local()
    return ShopInfo(
        shop_name=SHOP_NAME, today=now.strftime("%Y-%m-%d"), now_time=now.strftime("%H:%M"),
        timezone=TZ_NAME, slot_minutes=SLOT, max_days_ahead=MAX_DAYS_AHEAD,
    )


@router.get("/barbers", response_model=list[BarberPublic])
async def barbers():
    docs = await db.barbers.find({"active": True}, {"_id": 0}).sort("name", 1).to_list(100)
    return [BarberPublic(**d) for d in docs]


@router.get("/services", response_model=list[Service])
async def services():
    docs = await db.services.find({"active": True}, {"_id": 0}).sort("name", 1).to_list(100)
    return [Service(**d) for d in docs]


@router.get("/availability", response_model=AvailabilityOut)
async def availability(barber_id: str, date: str = Query(pattern=r"^\d{4}-\d{2}-\d{2}$")):
    barber = await db.barbers.find_one({"id": barber_id, "active": True}, {"_id": 0})
    if not barber:
        raise HTTPException(404, "Barbeiro não encontrado")
    return AvailabilityOut(barber_id=barber_id, date=date, slots=await available_slots(barber, date))


@router.post("/appointments", response_model=Appointment, status_code=201)
async def book(body: AppointmentCreate):
    return Appointment(**await create_appointment(body, "online"))
