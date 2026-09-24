import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from backend.config import get_settings


class FAQ(BaseModel):
    question: str
    answer: str


class BusinessKnowledge(BaseModel):
    name: str
    description: str
    phone: str
    timezone: str
    service_area: list[str]
    hours: dict[str, str]
    booking_url: str
    policies: list[str]
    faqs: list[FAQ]

    def prompt_context(self) -> str:
        return self.model_dump_json(indent=2)


@lru_cache
def load_knowledge() -> BusinessKnowledge:
    path: Path = get_settings().business_file
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return BusinessKnowledge.model_validate(data)

