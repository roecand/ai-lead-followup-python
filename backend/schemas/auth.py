from pydantic import BaseModel, Field, field_validator

class LoginRequest(BaseModel):
    email: str
    password: str
    remember: bool = False

class SignupRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    join_code: str
    name: str

    @field_validator("password")
    @classmethod
    def fits_bcrypt(cls, v: str) -> str:
        if len(v.encode('utf-8')) > 72:
            raise ValueError("Password too long")
        return v

class VerifyRequest(BaseModel):
    email: str
    code: str

class ResendCode(BaseModel):
    email: str

class CodeIn(BaseModel):
    code: str