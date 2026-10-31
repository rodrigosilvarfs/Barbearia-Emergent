import asyncio
import hmac
import logging
import os

from fastapi import APIRouter, HTTPException, Request, Response
from pymongo.errors import DuplicateKeyError

from lib.db import db
from lib.scheduling import process_due_reminders

router = APIRouter(prefix="/cron", tags=["cron"])
log = logging.getLogger(__name__)
_tasks: set[asyncio.Task] = set()


async def _run() -> None:
    try:
        n = await process_due_reminders()
        log.info("cron reminders processed=%s", n)
    except Exception as exc:
        log.error("cron reminders failed: %s", exc)


@router.post("/reminders", status_code=202)
async def reminders_tick(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else ""
    if not secret or not token or not hmac.compare_digest(token, secret):
        raise HTTPException(401, "unauthorized")
    try:
        body = await request.json()
    except Exception:
        body = None
    if body is not None and not isinstance(body, dict):
        raise HTTPException(400, "invalid body")
    run_id = request.headers.get("x-webhook-id") or (body or {}).get("run_id")
    if run_id:
        try:
            await db.cron_runs.insert_one({"run_id": run_id})
        except DuplicateKeyError:
            return Response(status_code=202)
    task = asyncio.create_task(_run())
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return Response(status_code=202)
