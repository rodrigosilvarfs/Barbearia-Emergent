"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on. Applied by ensure_indexes() at startup.
INDEXES: dict[str, list[IndexModel]] = {
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "users": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("email", ASCENDING)], name="email", unique=True),
        IndexModel([("barber_id", ASCENDING)], name="barber_id"),
    ],
    "barbers": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "services": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "clients": [IndexModel([("phone", ASCENDING)], name="phone", unique=True)],
    "appointments": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        # one active appointment per barber+date+time; cancelled ones get a unique tombstone key
        IndexModel([("slot_key", ASCENDING)], name="slot_key", unique=True),
        IndexModel([("barber_id", ASCENDING), ("date", ASCENDING), ("time", ASCENDING)], name="barber_date_time"),
        IndexModel([("date", ASCENDING), ("status", ASCENDING)], name="date_status"),
    ],
    "blocks": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("barber_id", ASCENDING), ("date", ASCENDING)], name="barber_date"),
    ],
    "reminders": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("status", ASCENDING), ("send_at", ASCENDING)], name="status_send_at"),
        IndexModel([("appointment_id", ASCENDING)], name="appointment_id"),
    ],
    "cron_runs": [IndexModel([("run_id", ASCENDING)], name="run_id", unique=True)],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index; the log line names what to fix
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)
