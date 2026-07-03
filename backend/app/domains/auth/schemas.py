from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    display_name: str
    role: str
    email: str | None = None
    auth_provider: str = "local"
    mobile_number: str | None = None
    is_active: int = 1
    failed_login_count: int = 0
    locked_until: datetime | None = None
    last_login_at: datetime | None = None


class UserCreateRequest(BaseModel):
    username: str
    display_name: str
    role: str = "central_geologist"
    password: str
    email: str | None = None
    mobile_number: str | None = None
    is_active: int = 1


class UserUpdateRequest(BaseModel):
    display_name: str | None = None
    role: str | None = None
    email: str | None = None
    mobile_number: str | None = None
    is_active: int | None = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class PasswordResetRequest(BaseModel):
    new_password: str


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    label: str
    description: str | None = None
    is_system: int = 0
    is_active: int = 1


class RoleCreateRequest(BaseModel):
    key: str
    label: str
    description: str | None = None
    is_active: int = 1


class RoleUpdateRequest(BaseModel):
    label: str | None = None
    description: str | None = None
    is_active: int | None = None


class PermissionOut(BaseModel):
    key: str
    label: str
    description: str
    category: str


class RoleAccessOut(BaseModel):
    role_key: str
    permissions: list[str]


class RoleAccessUpdateRequest(BaseModel):
    permissions: list[str]


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    token: str
    user: UserOut
    expires_at: str


class SessionOut(BaseModel):
    user: UserOut
    expires_at: str
    client_type: str


class LogoutOut(BaseModel):
    status: str


class MobileOtpRequest(BaseModel):
    username: str
    push_token: str | None = None


class MobileOtpOut(BaseModel):
    status: str
    message: str
    dev_otp: str | None = None


class MobileOtpVerifyRequest(BaseModel):
    username: str
    otp: str
    push_token: str | None = None


class MobileEntraTokenRequest(BaseModel):
    access_token: str
