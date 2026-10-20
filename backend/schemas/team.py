import re
from datetime import datetime

from pydantic import BaseModel, field_validator

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class MeView(BaseModel):
    name: str
    email: str
    role: str


class InviteCreate(BaseModel):
    email: str
    role: str

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        v = v.strip().lower()
        if len(v) > 255 or not EMAIL_RE.match(v):
            raise ValueError("Enter a valid email address")
        return v


class InviteView(BaseModel):
    email: str
    role: str
    expires_at: datetime
    join_code: str