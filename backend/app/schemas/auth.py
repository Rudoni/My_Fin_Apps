from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    display_name: str = Field(min_length=1, max_length=120)


class LoginPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)


class UserRead(BaseModel):
    user_id: int
    email: EmailStr
    display_name: str
    created_at: datetime


class AuthSessionRead(BaseModel):
    token: str
    expires_at: datetime
    user: UserRead


class MessageResponse(BaseModel):
    message: str


class ChangePasswordPayload(BaseModel):
    current_password: str = Field(min_length=8, max_length=200)
    new_password: str = Field(min_length=8, max_length=200)


class UpdateProfilePayload(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)
