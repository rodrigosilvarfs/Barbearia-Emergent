"""Idempotent seed: admin, 2 barbers (with logins) and default services. Run: cd /app/backend && python seed.py"""

import asyncio

from lib.auth import hash_password
from lib.db import db, ensure_indexes
from models.schemas import default_schedule, new_id

ADMIN = {"email": "admin@rpgbarbearia.com", "password": "admin123", "name": "Administrador"}
BARBERS = [
    {
        "name": "Roberto", "email": "roberto@rpgbarbearia.com", "password": "barbeiro123",
        "bio": "Especialista em cortes clássicos e degradê navalhado.",
        "photo_url": "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=600&q=80&auto=format&fit=crop",
    },
    {
        "name": "Kauã", "email": "kaua@rpgbarbearia.com", "password": "barbeiro123",
        "bio": "Barboterapia, desenho de barba e acabamentos precisos.",
        "photo_url": "https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=600&q=80&auto=format&fit=crop",
    },
]
SERVICES = [
    ("Corte de cabelo", "Corte personalizado com lavagem e finalização."),
    ("Barba", "Barba modelada com toalha quente e navalha."),
    ("Corte + Barba", "O combo completo para sair impecável."),
    ("Acabamento", "Pezinho, contornos e alinhamento."),
    ("Sobrancelha", "Limpeza e alinhamento na navalha."),
]


async def main() -> None:
    await ensure_indexes()
    if not await db.users.find_one({"email": ADMIN["email"]}):
        await db.users.insert_one({
            "id": new_id(), "email": ADMIN["email"], "password_hash": hash_password(ADMIN["password"]),
            "role": "admin", "name": ADMIN["name"], "barber_id": None,
        })
    for b in BARBERS:
        if await db.users.find_one({"email": b["email"]}):
            continue
        barber_id = new_id()
        await db.barbers.insert_one({
            "id": barber_id, "name": b["name"], "bio": b["bio"], "photo_url": b["photo_url"], "active": True,
            "schedule": [s.model_dump() for s in default_schedule()], "days_off": [],
        })
        await db.users.insert_one({
            "id": new_id(), "email": b["email"], "password_hash": hash_password(b["password"]),
            "role": "barber", "name": b["name"], "barber_id": barber_id,
        })
    for name, desc in SERVICES:
        await db.services.update_one(
            {"name": name}, {"$setOnInsert": {"id": new_id(), "name": name, "description": desc, "active": True}}, upsert=True
        )
    print("seed ok")


if __name__ == "__main__":
    asyncio.run(main())
