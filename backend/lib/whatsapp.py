"""WhatsApp Business Cloud API (Meta) — thin sender.

SIMULATED when WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID are absent: nothing leaves the server,
the rendered message is stored in the reminder log. Live mode sends an approved UTILITY template
(proactive messages outside the 24h window must be templates).

Template expected (pt_BR), body params in this order:
  {{1}} nome do cliente, {{2}} data, {{3}} horário, {{4}} barbeiro, {{5}} serviço, {{6}} barbearia
"""

import logging
import os

import httpx

log = logging.getLogger(__name__)


def is_live() -> bool:
    return bool(os.environ.get("WHATSAPP_TOKEN") and os.environ.get("WHATSAPP_PHONE_NUMBER_ID"))


def mode() -> str:
    return "live" if is_live() else "simulated"


def template_name() -> str:
    return os.environ.get("WHATSAPP_TEMPLATE_NAME", "lembrete_agendamento")


def to_e164(phone_digits: str) -> str:
    digits = "".join(c for c in phone_digits if c.isdigit())
    return digits if digits.startswith("55") and len(digits) >= 12 else "55" + digits


async def send_reminder(*, phone: str, params: list[str], text: str) -> dict:
    to = to_e164(phone)
    if not is_live():
        log.info("SIMULATED WhatsApp to=***%s", to[-4:])
        return {"mode": "simulated"}

    url = (
        f"https://graph.facebook.com/{os.environ.get('WHATSAPP_GRAPH_VERSION', 'v23.0')}/"
        f"{os.environ['WHATSAPP_PHONE_NUMBER_ID']}/messages"
    )
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "template",
        "template": {
            "name": template_name(),
            "language": {"code": os.environ.get("WHATSAPP_TEMPLATE_LANG", "pt_BR")},
            "components": [{"type": "body", "parameters": [{"type": "text", "text": p} for p in params]}],
        },
    }
    headers = {"Authorization": f"Bearer {os.environ['WHATSAPP_TOKEN']}"}
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(url, headers=headers, json=payload)
    if res.is_error:
        raise RuntimeError(f"WhatsApp API {res.status_code}: {res.text[:300]}")
    data = res.json()
    return {"mode": "live", "message_id": data.get("messages", [{}])[0].get("id")}
