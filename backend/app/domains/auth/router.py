from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.domains.auth import service
from app.domains.auth.schemas import (
    LoginRequest,
    MobileEntraTokenRequest,
    MobileOtpOut,
    MobileOtpRequest,
    MobileOtpVerifyRequest,
    LogoutOut,
    PasswordChangeRequest,
    PasswordResetRequest,
    PermissionOut,
    RoleOut,
    RoleAccessOut,
    RoleAccessUpdateRequest,
    RoleCreateRequest,
    RoleUpdateRequest,
    SessionOut,
    TokenOut,
    UserCreateRequest,
    UserOut,
    UserUpdateRequest,
)

router = APIRouter()


def bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return authorization.split(" ", 1)[1].strip()


def current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    try:
        user, _ = service.get_session(db, bearer_token(authorization))
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    return user


def admin_user(user=Depends(current_user)):
    try:
        service.require_admin(user)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return user


@router.post("/login", response_model=TokenOut)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenOut:
    try:
        user, session = service.login(db, payload.username, payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    return TokenOut(token=session.token, user=user, expires_at=session.expires_at.isoformat())


@router.get("/entra/login")
def entra_login() -> RedirectResponse:
    try:
        url = service.entra_authorization_url()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return RedirectResponse(url)


@router.get("/entra/callback")
def entra_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    settings = get_settings()
    if error:
        query = urlencode({"auth_error": error_description or error})
        return RedirectResponse(f"{settings.web_base_url}/?{query}")
    if not code or not state:
        query = urlencode({"auth_error": "Missing Entra callback code or state"})
        return RedirectResponse(f"{settings.web_base_url}/?{query}")
    try:
        _, session = service.login_with_entra_code(db, code, state)
    except ValueError as exc:
        query = urlencode({"auth_error": str(exc)})
        return RedirectResponse(f"{settings.web_base_url}/?{query}")
    query = urlencode({"auth_token": session.token, "auth_provider": "entra"})
    return RedirectResponse(f"{settings.web_base_url}/?{query}")


@router.get("/me", response_model=SessionOut)
def me(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> SessionOut:
    try:
        user, session = service.get_session(db, bearer_token(authorization))
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    return SessionOut(
        user=user,
        expires_at=session.expires_at.isoformat(),
        client_type=session.client_type,
    )


@router.get("/roles", response_model=list[RoleOut])
def roles(db: Session = Depends(get_db), _: object = Depends(current_user)) -> list[RoleOut]:
    return service.list_configured_roles(db)


@router.post("/roles", response_model=RoleOut)
def create_role(
    payload: RoleCreateRequest,
    db: Session = Depends(get_db),
    _: object = Depends(admin_user),
) -> RoleOut:
    try:
        return service.create_role(
            db,
            key=payload.key,
            label=payload.label,
            description=payload.description,
            is_active=payload.is_active,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/roles/{role_key}", response_model=RoleOut)
def update_role(
    role_key: str,
    payload: RoleUpdateRequest,
    db: Session = Depends(get_db),
    _: object = Depends(admin_user),
) -> RoleOut:
    try:
        return service.update_role(
            db,
            role_key=role_key,
            label=payload.label,
            description=payload.description,
            is_active=payload.is_active,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/permissions", response_model=list[PermissionOut])
def permissions(_: object = Depends(current_user)) -> list[PermissionOut]:
    return [PermissionOut(**permission) for permission in service.permission_catalog()]


@router.get("/roles/{role_key}/access", response_model=RoleAccessOut)
def role_access(
    role_key: str,
    db: Session = Depends(get_db),
    _: object = Depends(admin_user),
) -> RoleAccessOut:
    try:
        return RoleAccessOut(
            role_key=role_key,
            permissions=service.get_role_permissions(db, role_key),
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/roles/{role_key}/access", response_model=RoleAccessOut)
def update_role_access(
    role_key: str,
    payload: RoleAccessUpdateRequest,
    db: Session = Depends(get_db),
    _: object = Depends(admin_user),
) -> RoleAccessOut:
    try:
        return RoleAccessOut(
            role_key=role_key,
            permissions=service.set_role_permissions(db, role_key, payload.permissions),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/users", response_model=list[UserOut])
def users(db: Session = Depends(get_db), _: object = Depends(admin_user)) -> list[UserOut]:
    return service.list_users(db)


@router.post("/users", response_model=UserOut)
def create_user(
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    _: object = Depends(admin_user),
) -> UserOut:
    try:
        return service.create_user(
            db,
            username=payload.username,
            display_name=payload.display_name,
            role=payload.role,
            password=payload.password,
            email=payload.email,
            mobile_number=payload.mobile_number,
            is_active=payload.is_active,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    _: object = Depends(admin_user),
) -> UserOut:
    try:
        return service.update_user(
            db,
            user_id=user_id,
            display_name=payload.display_name,
            role=payload.role,
            email=payload.email,
            mobile_number=payload.mobile_number,
            is_active=payload.is_active,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/users/{user_id}", response_model=UserOut)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(admin_user),
) -> UserOut:
    try:
        return service.deactivate_user(db, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/users/{user_id}/reset-password", response_model=UserOut)
def reset_user_password(
    user_id: int,
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
    _: object = Depends(admin_user),
) -> UserOut:
    try:
        return service.reset_user_password(db, user_id, payload.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/password/change", response_model=LogoutOut)
def change_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    user=Depends(current_user),
) -> LogoutOut:
    try:
        service.change_password(db, user, payload.current_password, payload.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return LogoutOut(status="password_changed")


@router.post("/logout", response_model=LogoutOut)
def logout(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> LogoutOut:
    try:
        token = bearer_token(authorization)
    except HTTPException:
        return LogoutOut(status="already_logged_out")
    service.revoke_session(db, token)
    return LogoutOut(status="logged_out")


@router.post("/mobile/request-otp", response_model=MobileOtpOut)
def request_mobile_otp(payload: MobileOtpRequest, db: Session = Depends(get_db)) -> MobileOtpOut:
    try:
        otp, push_ready = service.request_mobile_otp(db, payload.username, payload.push_token)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    settings = get_settings()
    return MobileOtpOut(
        status="sent" if push_ready else "dev_otp_generated",
        message="OTP sent through push provider." if push_ready else "Push provider disabled; use dev OTP.",
        dev_otp=otp if settings.push_provider == "disabled" else None,
    )


@router.post("/mobile/verify-otp", response_model=TokenOut)
def verify_mobile_otp(payload: MobileOtpVerifyRequest, db: Session = Depends(get_db)) -> TokenOut:
    try:
        user, session = service.verify_mobile_otp(db, payload.username, payload.otp, payload.push_token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    return TokenOut(token=session.token, user=user, expires_at=session.expires_at.isoformat())


@router.post("/mobile/entra-session", response_model=TokenOut)
def mobile_entra_session(
    payload: MobileEntraTokenRequest,
    db: Session = Depends(get_db),
) -> TokenOut:
    try:
        user, session = service.login_with_entra_access_token(db, payload.access_token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    return TokenOut(token=session.token, user=user, expires_at=session.expires_at.isoformat())
