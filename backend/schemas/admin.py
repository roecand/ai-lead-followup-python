from pydantic import BaseModel

class CreateCompany(BaseModel):
    name: str
    twilio_number: str
    timezone: str = "America/Los_Angeles"

class DemoInbound(BaseModel):
    phone: str
    company_phone: str
    body: str
    provider_id: str | None = None