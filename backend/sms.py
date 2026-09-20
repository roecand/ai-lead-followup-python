from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import uuid4

import httpx
from twilio.rest import Client

from .config import get_settings


@dataclass(frozen=True)
class SendReceipt:
    provider_id: str


class SMSGateway(ABC):
    @abstractmethod
    async def send(self, to: str, from_number: str, body: str) -> SendReceipt:
        raise NotImplementedError


class ConsoleSMS(SMSGateway):
    async def send(self, to: str, from_number: str, body: str) -> SendReceipt:
        print(f"[DEMO SMS -> {to}] {body}")
        return SendReceipt(provider_id=f"demo-{uuid4()}")


class TwilioSMS(SMSGateway):
    def __init__(self) -> None:
        settings = get_settings()
        if not all((settings.twilio_account_sid, settings.twilio_auth_token)):
            raise RuntimeError("Twilio mode requires account SID, auth token, and from number")
        self.client = Client(settings.twilio_account_sid, settings.twilio_auth_token)

    async def send(self, to: str, from_number: str, body: str) -> SendReceipt:

        message = self.client.messages.create(to=to, from_=from_number, body=body)
        return SendReceipt(provider_id=message.sid)

class GoHighLevelSMS(SMSGateway):
    """
    TEMPORARY. Stands in for TwilioSMS while GHL is being used for live testing.
    Delete this class and the GHL_* settings once SMS_PROVIDER is permanently "twilio".

    GHL's send-message API takes a contactId, not a bare phone number, so every
    send does a contacts/upsert-by-phone first. That's one extra HTTP call per
    message versus Twilio — acceptable for testing volume, not something to
    carry into production.
    """

    BASE_URL = "https://services.leadconnectorhq.com"
    CONTACTS_API_VERSION = "2021-07-28"
    MESSAGES_API_VERSION = "v3"

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.ghl_api_key or not settings.ghl_location_id:
            raise RuntimeError("GoHighLevel mode requires ghl_api_key and ghl_location_id")
        self._location_id = settings.ghl_location_id
        self._client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            headers={
                "Authorization": f"Bearer {settings.ghl_api_key}",
                "Accept": "application/json",
            },
            timeout=15.0,
        )

    async def _contact_id_for(self, phone: str) -> str:
        response = await self._client.post(
            "/contacts/upsert",
            headers={"Version": self.CONTACTS_API_VERSION},
            json={"locationId": self._location_id, "phone": phone},
        )
        response.raise_for_status()
        return response.json()["contact"]["id"]

    async def send(self, to: str, from_number: str, body: str) -> SendReceipt:
        contact_id = await self._contact_id_for(to)
        payload: dict[str, str] = {
            "type": "SMS",
            "contactId": contact_id,
            "message": body,
        }
        if from_number:
            payload["fromNumber"] = from_number

        response = await self._client.post(
            "/conversations/messages",
            headers={"Version": self.MESSAGES_API_VERSION},
            json=payload,
        )
        response.raise_for_status()
        return SendReceipt(provider_id=response.json()["messageId"])


def build_sms_gateway() -> SMSGateway:
    provider = get_settings().sms_provider.lower()
    if provider == "twilio":
        return TwilioSMS()
    if provider in ("gohighlevel", "ghl"):
        return GoHighLevelSMS()
    return ConsoleSMS()

