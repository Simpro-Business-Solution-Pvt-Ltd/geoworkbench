import hashlib
import hmac
import json
import secrets
import time
from base64 import urlsafe_b64decode, urlsafe_b64encode
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import AuthSession, MobileOtp, Role, RolePermission, User

ROLE_DEFINITIONS = [
    {
        "key": "system_admin",
        "label": "System Admin",
        "description": "Can manage users, roles, configuration, and all review workflows.",
    },
    {
        "key": "central_geologist",
        "label": "Central Geologist",
        "description": "Can review, edit, approve, import, export, and run AI analysis.",
    },
    {
        "key": "site_geologist",
        "label": "Site Geologist",
        "description": "Can submit field data and mobile captures for assigned boreholes.",
    },
    {
        "key": "viewer",
        "label": "Viewer",
        "description": "Can view dashboards, displays, and reports without editing.",
    },
    {
        "key": "developer",
        "label": "Developer",
        "description": "Can view implementation, architecture, deployment, and extension documentation.",
    },
]
ROLE_KEYS = {role["key"] for role in ROLE_DEFINITIONS}
ADMIN_ROLES = {"system_admin"}
MAX_FAILED_LOGINS = 5
LOCK_MINUTES = 15
PERMISSION_DEFINITIONS = [
    {
        "key": "workspace.view",
        "label": "View workspace",
        "description": "Open borehole displays, correlation, and dashboards.",
        "category": "Workspace",
    },
    {
        "key": "workspace.edit",
        "label": "Edit interpretation",
        "description": "Edit intervals, remarks, display settings, and corrections.",
        "category": "Workspace",
    },
    {
        "key": "ai.review",
        "label": "AI review",
        "description": "Run validations, generate AI suggestions, and accept/reject insights.",
        "category": "AI",
    },
    {
        "key": "import.manage",
        "label": "Import data",
        "description": "Upload, parse, template, and merge source files.",
        "category": "Data Exchange",
    },
    {
        "key": "export.manage",
        "label": "Export data",
        "description": "Configure exports, review readiness, and download output files.",
        "category": "Data Exchange",
    },
    {
        "key": "mobile.capture",
        "label": "Mobile capture",
        "description": "Submit field forms, files, photos, and runtime parameters.",
        "category": "Mobile",
    },
    {
        "key": "settings.users",
        "label": "Manage users",
        "description": "Create users, reset passwords, activate users, and manage roles.",
        "category": "Settings",
    },
    {
        "key": "settings.access",
        "label": "Manage access",
        "description": "Create roles and configure role access mappings.",
        "category": "Settings",
    },
]
DEFAULT_ROLE_PERMISSIONS = {
    "system_admin": [permission["key"] for permission in PERMISSION_DEFINITIONS],
    "central_geologist": [
        "workspace.view",
        "workspace.edit",
        "ai.review",
        "import.manage",
        "export.manage",
    ],
    "site_geologist": ["workspace.view", "mobile.capture"],
    "viewer": ["workspace.view"],
    "developer": [
        "workspace.view",
        "settings.access",
    ],
}


def _to_aware(value: datetime | None) -> datetime | None:
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def list_roles() -> list[dict]:
    return ROLE_DEFINITIONS


def permission_catalog() -> list[dict]:
    return PERMISSION_DEFINITIONS


def ensure_roles(db: Session) -> None:
    existing = {role.key: role for role in db.scalars(select(Role)).all()}
    changed = False
    for definition in ROLE_DEFINITIONS:
        role = existing.get(definition["key"])
        if role is None:
            role = Role(
                key=definition["key"],
                label=definition["label"],
                description=definition["description"],
                is_system=1,
                is_active=1,
            )
            db.add(role)
            changed = True
        else:
            if role.is_system != 1:
                role.is_system = 1
                changed = True
            if not role.description:
                role.description = definition["description"]
                changed = True
    if changed:
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    for role in db.scalars(select(Role)).all():
        default_permissions = DEFAULT_ROLE_PERMISSIONS.get(role.key, [])
        existing_permissions = {
            permission.permission_key
            for permission in db.scalars(
                select(RolePermission).where(RolePermission.role_id == role.id)
            )
        }
        for permission_key in default_permissions:
            if permission_key not in existing_permissions:
                db.add(RolePermission(role_id=role.id, permission_key=permission_key, enabled=1))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()


def list_configured_roles(db: Session) -> list[Role]:
    ensure_roles(db)
    return db.scalars(select(Role).order_by(Role.label)).all()


def configured_role_keys(db: Session) -> set[str]:
    ensure_roles(db)
    return {role.key for role in db.scalars(select(Role).where(Role.is_active == 1)).all()}


def create_role(db: Session, key: str, label: str, description: str | None, is_active: int) -> Role:
    normalised_key = key.strip().lower().replace(" ", "_")
    if not normalised_key:
        raise ValueError("Role key is required")
    if db.scalar(select(Role).where(Role.key == normalised_key)):
        raise ValueError("Role already exists")
    role = Role(
        key=normalised_key,
        label=label.strip(),
        description=description,
        is_system=0,
        is_active=1 if is_active else 0,
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


def update_role(
    db: Session,
    role_key: str,
    label: str | None = None,
    description: str | None = None,
    is_active: int | None = None,
) -> Role:
    role = db.scalar(select(Role).where(Role.key == role_key))
    if role is None:
        raise ValueError("Role not found")
    if label is not None:
        role.label = label
    if description is not None:
        role.description = description
    if is_active is not None:
        role.is_active = 1 if is_active else 0
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


def get_role_permissions(db: Session, role_key: str) -> list[str]:
    ensure_roles(db)
    role = db.scalar(select(Role).where(Role.key == role_key))
    if role is None:
        raise ValueError("Role not found")
    return [
        permission.permission_key
        for permission in db.scalars(
            select(RolePermission)
            .where(RolePermission.role_id == role.id)
            .where(RolePermission.enabled == 1)
            .order_by(RolePermission.permission_key)
        )
    ]


def set_role_permissions(db: Session, role_key: str, permissions: list[str]) -> list[str]:
    ensure_roles(db)
    valid_permissions = {permission["key"] for permission in PERMISSION_DEFINITIONS}
    unknown = sorted(set(permissions) - valid_permissions)
    if unknown:
        raise ValueError(f"Unknown permission(s): {', '.join(unknown)}")
    role = db.scalar(select(Role).where(Role.key == role_key))
    if role is None:
        raise ValueError("Role not found")
    db.query(RolePermission).filter(RolePermission.role_id == role.id).delete()
    for permission_key in sorted(set(permissions)):
        db.add(RolePermission(role_id=role.id, permission_key=permission_key, enabled=1))
    db.commit()
    return get_role_permissions(db, role_key)


def require_admin(user: User) -> None:
    if user.role not in ADMIN_ROLES:
        raise PermissionError("System admin role required")


def user_to_out(user: User) -> User:
    user.locked_until = _to_aware(user.locked_until)
    user.last_login_at = _to_aware(user.last_login_at)
    return user


def ensure_valid_role(role: str) -> str:
    if role not in ROLE_KEYS:
        raise ValueError("Invalid role")
    return role


def hash_secret(secret: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", secret.encode("utf-8"), salt.encode("utf-8"), 120_000)
    return f"pbkdf2_sha256${salt}${digest.hex()}"


def verify_secret(secret: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        _, salt, _ = stored.split("$", 2)
    except ValueError:
        return False
    return hmac.compare_digest(hash_secret(secret, salt), stored)


def _b64encode_json(payload: dict) -> str:
    return urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8")).decode(
        "ascii"
    ).rstrip("=")


def _b64decode_json(value: str) -> dict:
    padded = value + ("=" * (-len(value) % 4))
    return json.loads(urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))


def _state_signature(payload: str) -> str:
    settings = get_settings()
    secret = settings.entra_client_secret or "geoworkbench-local-state"
    return hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def create_entra_state(return_to: str | None = None) -> str:
    values = {"nonce": secrets.token_urlsafe(16), "iat": int(time.time())}
    if return_to and return_to.startswith("/") and not return_to.startswith("//"):
        values["return_to"] = return_to[:200]
    payload = _b64encode_json(values)
    return f"{payload}.{_state_signature(payload)}"


def verify_entra_state(state: str) -> dict:
    try:
        payload, signature = state.split(".", 1)
        values = _b64decode_json(payload)
    except (ValueError, json.JSONDecodeError):
        raise ValueError("Invalid Entra state")
    if not hmac.compare_digest(signature, _state_signature(payload)):
        raise ValueError("Invalid Entra state signature")
    if int(time.time()) - int(values.get("iat", 0)) > 600:
        raise ValueError("Expired Entra state")
    return values


def entra_state_return_to(state: str | None) -> str:
    if not state:
        return "/"
    try:
        values = verify_entra_state(state)
    except ValueError:
        return "/"
    return_to = values.get("return_to")
    if isinstance(return_to, str) and return_to.startswith("/") and not return_to.startswith("//"):
        return return_to
    return "/"


def entra_authorization_url(return_to: str | None = None) -> str:
    settings = get_settings()
    if not settings.entra_tenant_id or not settings.entra_client_id:
        raise ValueError("Entra ID is not configured")
    params = {
        "client_id": settings.entra_client_id,
        "response_type": "code",
        "redirect_uri": settings.entra_redirect_uri,
        "response_mode": "query",
        "scope": "openid profile email User.Read",
        "state": create_entra_state(return_to),
        "prompt": "select_account",
    }
    return (
        f"https://login.microsoftonline.com/{settings.entra_tenant_id}/oauth2/v2.0/authorize?"
        f"{urlencode(params)}"
    )


def _entra_token_endpoint() -> str:
    settings = get_settings()
    return f"https://login.microsoftonline.com/{settings.entra_tenant_id}/oauth2/v2.0/token"


def _normalise_domain(value: str | None) -> str | None:
    return value.strip().lower().lstrip("@") if value else None


def _extract_entra_profile(token_payload: dict) -> dict:
    access_token = token_payload.get("access_token")
    if not access_token:
        raise ValueError("Entra token response did not include an access token")
    with httpx.Client(timeout=20) as client:
        response = client.get(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if response.status_code >= 400:
        raise ValueError(f"Could not read Entra profile: {response.text}")
    profile = response.json()
    username = (
        profile.get("mail")
        or profile.get("userPrincipalName")
        or profile.get("id")
        or ""
    ).strip().lower()
    if not username:
        raise ValueError("Entra profile did not include a usable username")
    return {
        "username": username,
        "display_name": profile.get("displayName") or username,
        "mail": profile.get("mail"),
        "user_principal_name": profile.get("userPrincipalName"),
    }


def _get_or_create_entra_user(db: Session, profile: dict) -> User:
    settings = get_settings()
    username = profile["username"]
    allowed_domain = _normalise_domain(settings.entra_allowed_domain)
    if allowed_domain and not username.endswith(f"@{allowed_domain}"):
        raise ValueError("This Entra account is not allowed for GeoWorkbench")
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        user = User(
            username=username,
            display_name=profile["display_name"],
            role=settings.entra_default_role,
            email=profile.get("mail") or username,
            auth_provider="entra",
            password_hash=None,
        )
    else:
        user.display_name = profile["display_name"]
        user.email = profile.get("mail") or user.email or username
        user.auth_provider = "entra"
        user.failed_login_count = 0
        user.locked_until = None
        user.is_active = 1
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def login_with_entra_code(db: Session, code: str, state: str) -> tuple[User, AuthSession]:
    settings = get_settings()
    if not settings.entra_client_id or not settings.entra_client_secret or not settings.entra_tenant_id:
        raise ValueError("Entra ID is not configured")
    verify_entra_state(state)
    token_data = {
        "client_id": settings.entra_client_id,
        "client_secret": settings.entra_client_secret,
        "code": code,
        "redirect_uri": settings.entra_redirect_uri,
        "grant_type": "authorization_code",
        "scope": "openid profile email User.Read",
    }
    with httpx.Client(timeout=20) as client:
        response = client.post(_entra_token_endpoint(), data=token_data)
    if response.status_code >= 400:
        raise ValueError(f"Entra token exchange failed: {response.text}")
    profile = _extract_entra_profile(response.json())
    user = _get_or_create_entra_user(db, profile)
    user.last_login_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    return user, create_session(db, user, "web_entra")


def login_with_entra_access_token(db: Session, access_token: str) -> tuple[User, AuthSession]:
    if not access_token:
        raise ValueError("Missing Entra access token")
    profile = _extract_entra_profile({"access_token": access_token})
    user = _get_or_create_entra_user(db, profile)
    user.last_login_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    return user, create_session(db, user, "mobile_entra")


def ensure_demo_users(db: Session) -> None:
    ensure_roles(db)
    demo_users = [
        {
            "username": "geologist",
            "display_name": "Central Geologist",
            "role": "system_admin",
            "password": "geologist123",
            "email": "geologist@local",
            "mobile_number": "+910000000001",
        },
        {
            "username": "field",
            "display_name": "Site Geologist",
            "role": "site_geologist",
            "password": "field123",
            "email": "field@local",
            "mobile_number": "+910000000002",
        },
        {
            "username": "developer",
            "display_name": "Developer",
            "role": "developer",
            "password": "developer123",
            "email": "developer@local",
            "mobile_number": "+910000000003",
        },
    ]
    for demo_user in demo_users:
        user = db.scalar(select(User).where(User.username == demo_user["username"]))
        if user is None:
            db.add(
                User(
                    username=demo_user["username"],
                    display_name=demo_user["display_name"],
                    role=demo_user["role"],
                    password_hash=hash_secret(demo_user["password"]),
                    email=demo_user["email"],
                    auth_provider="local",
                    mobile_number=demo_user["mobile_number"],
                )
            )
            try:
                db.commit()
            except IntegrityError:
                db.rollback()
            continue
        changed = False
        if not user.display_name:
            user.display_name = demo_user["display_name"]
            changed = True
        if user.role != demo_user["role"]:
            user.role = demo_user["role"]
            changed = True
        if not user.email:
            user.email = demo_user["email"]
            changed = True
        if not user.auth_provider:
            user.auth_provider = "local"
            changed = True
        if not user.mobile_number:
            user.mobile_number = demo_user["mobile_number"]
            changed = True
        if changed:
            db.add(user)
            try:
                db.commit()
            except IntegrityError:
                db.rollback()


def create_session(db: Session, user: User, client_type: str) -> AuthSession:
    settings = get_settings()
    session = AuthSession(
        user_id=user.id,
        token=secrets.token_urlsafe(32),
        client_type=client_type,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.auth_token_hours),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_session(db: Session, token: str) -> tuple[User, AuthSession]:
    session = db.scalar(select(AuthSession).where(AuthSession.token == token))
    if session is None:
        raise ValueError("Invalid session")
    expires_at = session.expires_at
    expires_at = _to_aware(expires_at)
    if expires_at < datetime.now(timezone.utc):
        raise ValueError("Session expired")
    user = db.scalar(select(User).where(User.id == session.user_id).where(User.is_active == 1))
    if user is None:
        raise ValueError("User not found")
    return user, session


def revoke_session(db: Session, token: str) -> None:
    session = db.scalar(select(AuthSession).where(AuthSession.token == token))
    if session is not None:
        db.delete(session)
        db.commit()


def login(db: Session, username: str, password: str) -> tuple[User, AuthSession]:
    ensure_demo_users(db)
    user = db.scalar(select(User).where(User.username == username))
    if user is None or user.is_active != 1:
        raise ValueError("Invalid username or password")
    now = datetime.now(timezone.utc)
    locked_until = _to_aware(user.locked_until)
    if locked_until and locked_until > now:
        raise ValueError("User is temporarily locked due to failed login attempts")
    if not verify_secret(password, user.password_hash):
        user.failed_login_count = (user.failed_login_count or 0) + 1
        if user.failed_login_count >= MAX_FAILED_LOGINS:
            user.locked_until = now + timedelta(minutes=LOCK_MINUTES)
        db.add(user)
        db.commit()
        raise ValueError("Invalid username or password")
    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = now
    db.add(user)
    db.commit()
    return user, create_session(db, user, "web")


def list_users(db: Session) -> list[User]:
    ensure_demo_users(db)
    return [user_to_out(user) for user in db.scalars(select(User).order_by(User.username)).all()]


def create_user(
    db: Session,
    username: str,
    display_name: str,
    role: str,
    password: str,
    email: str | None = None,
    mobile_number: str | None = None,
    is_active: int = 1,
) -> User:
    if role not in configured_role_keys(db):
        raise ValueError("Invalid role")
    if db.scalar(select(User).where(User.username == username)):
        raise ValueError("Username already exists")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    user = User(
        username=username.strip().lower(),
        display_name=display_name.strip(),
        role=role,
        password_hash=hash_secret(password),
        email=email,
        mobile_number=mobile_number,
        auth_provider="local",
        is_active=1 if is_active else 0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_to_out(user)


def update_user(
    db: Session,
    user_id: int,
    display_name: str | None = None,
    role: str | None = None,
    email: str | None = None,
    mobile_number: str | None = None,
    is_active: int | None = None,
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise ValueError("User not found")
    if role is not None:
        if role not in configured_role_keys(db):
            raise ValueError("Invalid role")
        user.role = role
    if display_name is not None:
        user.display_name = display_name
    if email is not None:
        user.email = email
    if mobile_number is not None:
        user.mobile_number = mobile_number
    if is_active is not None:
        user.is_active = 1 if is_active else 0
        if user.is_active:
            user.locked_until = None
            user.failed_login_count = 0
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_to_out(user)


def update_user_preferences(db: Session, user: User, preferences: dict) -> User:
    user.preferences = preferences
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_to_out(user)


def deactivate_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise ValueError("User not found")
    user.is_active = 0
    db.query(AuthSession).filter(AuthSession.user_id == user.id).delete()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_to_out(user)


def reset_user_password(db: Session, user_id: int, new_password: str) -> User:
    if len(new_password) < 8:
        raise ValueError("Password must be at least 8 characters")
    user = db.get(User, user_id)
    if user is None:
        raise ValueError("User not found")
    user.password_hash = hash_secret(new_password)
    user.auth_provider = "local" if user.auth_provider == "entra" else user.auth_provider
    user.failed_login_count = 0
    user.locked_until = None
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_to_out(user)


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    if not verify_secret(current_password, user.password_hash):
        raise ValueError("Current password is incorrect")
    if len(new_password) < 8:
        raise ValueError("Password must be at least 8 characters")
    user.password_hash = hash_secret(new_password)
    user.failed_login_count = 0
    user.locked_until = None
    db.add(user)
    db.commit()


def request_mobile_otp(db: Session, username: str, push_token: str | None) -> tuple[str, bool]:
    ensure_demo_users(db)
    settings = get_settings()
    user = db.scalar(select(User).where(User.username == username).where(User.is_active == 1))
    if user is None:
        raise ValueError("User not found")
    if push_token:
        user.push_token = push_token
    otp = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        MobileOtp(
            username=username,
            otp_hash=hash_secret(otp),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.mobile_otp_minutes),
        )
    )
    db.add(user)
    db.commit()
    push_ready = settings.push_provider != "disabled" and bool(user.push_token)
    return otp, push_ready


def verify_mobile_otp(
    db: Session, username: str, otp: str, push_token: str | None
) -> tuple[User, AuthSession]:
    ensure_demo_users(db)
    user = db.scalar(select(User).where(User.username == username).where(User.is_active == 1))
    if user is None:
        raise ValueError("User not found")
    if push_token:
        user.push_token = push_token
    now = datetime.now(timezone.utc)
    otp_row = db.scalar(
        select(MobileOtp)
        .where(MobileOtp.username == username)
        .where(MobileOtp.status == "pending")
        .order_by(MobileOtp.created_at.desc())
    )
    if otp_row is None:
        raise ValueError("Invalid or expired OTP")
    expires_at = otp_row.expires_at
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now or not verify_secret(otp, otp_row.otp_hash):
        raise ValueError("Invalid or expired OTP")
    otp_row.status = "used"
    db.add(otp_row)
    db.add(user)
    return user, create_session(db, user, "mobile")
