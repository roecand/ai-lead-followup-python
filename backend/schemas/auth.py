from pydantic import BaseModel, Field, field_validator

class LoginRequest(BaseModel):
    email: str
    password: str
    remember: bool = False

class SignupRequest(BaseModel):
    email: str
    password: str
    join_code: str
    name: str

class VerifyRequest(BaseModel):
    email: str
    code: str