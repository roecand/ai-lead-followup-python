from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import uuid4

from twilio.rest import Client

from .config import get_settings


@dataclass(frozen=True)
class SendReceipt:
    provider_id: str


class SMSGateway(ABC):
    @abstractmethod
    async def send(self, to: str, body: str) -> SendReceipt:
        raise NotImplementedError


class ConsoleSMS(SMSGateway):
    async def send(self, to: str, body: str) -> SendReceipt:
        print(f"[DEMO SMS -> {to}] {body}")
        return SendReceipt(provider_id=f"demo-{uuid4()}")


class TwilioSMS(SMSGateway):
    def __init__(self) -> None:
        settings = get_settings()
        if not all((settings.twilio_account_sid, settings.twilio_auth_token, settings.twilio_from_number)):
            raise RuntimeError("Twilio mode requires account SID, auth token, and from number")
        self.client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        self.from_number = settings.twilio_from_number

    async def send(self, to: str, body: str) -> SendReceipt:
        message = self.client.messages.create(to=to, from_=self.from_number, body=body)
        return SendReceipt(provider_id=message.sid)


def build_sms_gateway() -> SMSGateway:
    return TwilioSMS() if get_settings().sms_provider.lower() == "twilio" else ConsoleSMS()

