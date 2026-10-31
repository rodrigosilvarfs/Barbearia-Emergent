"""Pydantic models. Every model here has a hand-written TS mirror in frontend/src/lib/types.ts."""

import re
import uuid
from datetime import datetime, timezone
from typing import Annotated, Literal, Optional

from pydantic import AfterValidator, BaseModel, EmailStr, Field, field_validator

TIME_RE = r"^([01]\d|2[0-3]):[0-5]\d$"
DATE_RE = r"^\d{4}-\d{2}-\d{2}$"


def new_id() -> str:
    return str(uuid.uuid4())


def _aware(v: datetime) -> datetime:
    # motor returns naive UTC datetimes — re-attach the offset so JS parses them correctly
    return v if v.tzinfo else v.replace(tzinfo=timezone.utc)


UTCDatetime = Annotated[datetime, AfterValidator(_aware)]
Status = Literal["scheduled", "completed", "cancelled"]


def normalize_phone(v: str) -> str:
    digits = re.sub(r"\D", "", v)
    if digits.startswith("55") and len(digits) in (12, 13):
        digits = digits[2:]
    if len(digits) not in (10, 11):
        raise ValueError("Telefone inválido — informe DDD + número")
    return digits


# ---------- schedule ----------
class DaySchedule(BaseModel):
    weekday: int = Field(ge=0, le=6)  # 0 = segunda ... 6 = domingo (Python weekday)
    enabled: bool = True
    start: str = Field("09:00", pattern=TIME_RE)
    end: str = Field("19:00", pattern=TIME_RE)
    break_start: Optional[str] = Field(None, pattern=TIME_RE)
    break_end: Optional[str] = Field(None, pattern=TIME_RE)


def default_schedule() -> list[DaySchedule]:
    return [
        DaySchedule(weekday=i, enabled=i < 6, start="09:00", end="19:00", break_start="12:00", break_end="13:00")
        for i in range(7)
    ]


# ---------- barbers ----------
class BarberPublic(BaseModel):
    id: str
    name: str
    bio: str = ""
    photo_url: str = ""
    schedule: list[DaySchedule] = Field(default_factory=default_schedule)
    days_off: list[str] = Field(default_factory=list)


class Barber(BarberPublic):
    active: bool = True
    email: Optional[str] = None


class BarberCreate(BaseModel):
    name: str = Field(min_length=2)
    bio: str = ""
    photo_url: str = ""
    active: bool = True
    schedule: list[DaySchedule] = Field(default_factory=default_schedule)
    days_off: list[Annotated[str, Field(pattern=DATE_RE)]] = Field(default_factory=list)
    email: EmailStr
    password: str = Field(min_length=6)


class BarberUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2)
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    active: Optional[bool] = None
    schedule: Optional[list[DaySchedule]] = None
    days_off: Optional[list[Annotated[str, Field(pattern=DATE_RE)]]] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6)


# ---------- services ----------
class Service(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    description: str = ""
    active: bool = True


class ServiceIn(BaseModel):
    name: str = Field(min_length=2)
    description: str = ""
    active: bool = True


# ---------- appointments ----------
class AppointmentCreate(BaseModel):
    barber_id: str
    service_id: str
    client_name: str = Field(min_length=3, max_length=80)
    client_phone: str
    date: str = Field(pattern=DATE_RE)
    time: str = Field(pattern=TIME_RE)

    @field_validator("client_phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalize_phone(v)

    @field_validator("client_name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v) < 3:
            raise ValueError("Informe o nome completo")
        return v


class Appointment(BaseModel):
    id: str
    barber_id: str
    barber_name: str
    service_id: str
    service_name: str
    client_name: str
    client_phone: str
    date: str
    time: str
    end_time: str
    duration_minutes: int
    status: Status
    source: Literal["online", "manual"]
    starts_at: UTCDatetime
    created_at: UTCDatetime


class AvailabilityOut(BaseModel):
    barber_id: str
    date: str
    slots: list[str]


# ---------- blocks ----------
class BlockIn(BaseModel):
    barber_id: str
    date: str = Field(pattern=DATE_RE)
    start: str = Field(pattern=TIME_RE)
    end: str = Field(pattern=TIME_RE)
    reason: str = ""


class Block(BlockIn):
    id: str
    barber_name: str


# ---------- reminders ----------
class Reminder(BaseModel):
    id: str
    appointment_id: str
    kind: Literal["6h", "1h"]
    send_at: UTCDatetime
    status: Literal["pending", "sending", "sent", "cancelled", "failed", "skipped"]
    mode: Optional[Literal["simulated", "live"]] = None
    message: str
    client_name: str
    client_phone: str
    barber_name: str
    sent_at: Optional[UTCDatetime] = None
    error: Optional[str] = None


class RemindersOut(BaseModel):
    mode: Literal["simulated", "live"]
    template_name: str
    items: list[Reminder]


class RunResult(BaseModel):
    processed: int


# ---------- auth ----------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class Me(BaseModel):
    id: str
    email: str
    name: str
    role: Literal["admin", "barber"]
    barber_id: Optional[str] = None


# ---------- misc ----------
class ShopInfo(BaseModel):
    shop_name: str
    today: str
    now_time: str
    timezone: str
    slot_minutes: int
    max_days_ahead: int


class BarberStat(BaseModel):
    barber_id: str
    barber_name: str
    total: int
    completed: int
    cancelled: int


class Dashboard(BaseModel):
    today: str
    total_today: int
    upcoming_count: int
    completed_today: int
    cancelled_today: int
    upcoming: list[Appointment]
    by_barber: list[BarberStat]
