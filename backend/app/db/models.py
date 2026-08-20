from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))

    sites: Mapped[list["Site"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(160))
    role: Mapped[str] = mapped_column(String(80), default="geologist", index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(160), nullable=True, index=True)
    auth_provider: Mapped[str] = mapped_column(String(40), default="local", index=True)
    mobile_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    push_token: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[int] = mapped_column(Integer, default=1, index=True)
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_system: Mapped[int] = mapped_column(Integer, default=0, index=True)
    is_active: Mapped[int] = mapped_column(Integer, default=1, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    permissions: Mapped[list["RolePermission"]] = relationship(
        back_populates="role", cascade="all, delete-orphan"
    )


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), index=True)
    permission_key: Mapped[str] = mapped_column(String(120), index=True)
    enabled: Mapped[int] = mapped_column(Integer, default=1)

    role: Mapped[Role] = relationship(back_populates="permissions")


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    client_type: Mapped[str] = mapped_column(String(40), default="web", index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class MobileOtp(Base):
    __tablename__ = "mobile_otps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(120), index=True)
    otp_hash: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(40), default="pending", index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class Site(Base):
    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    code: Mapped[str] = mapped_column(String(80), index=True)
    name: Mapped[str] = mapped_column(String(200))

    project: Mapped[Project] = relationship(back_populates="sites")
    boreholes: Mapped[list["Borehole"]] = relationship(
        back_populates="site", cascade="all, delete-orphan"
    )


class Borehole(Base):
    __tablename__ = "boreholes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id"), index=True)
    code: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    state: Mapped[str | None] = mapped_column(String(120), nullable=True)
    total_depth: Mapped[float] = mapped_column(Float)
    closure_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_workbook: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_sheet: Mapped[str | None] = mapped_column(String(120), nullable=True)
    workflow_status: Mapped[str] = mapped_column(String(80), default="ready_for_central_review", index=True)
    attributes: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    site: Mapped[Site] = relationship(back_populates="boreholes")
    lithology_intervals: Mapped[list["LithologyInterval"]] = relationship(
        back_populates="borehole", cascade="all, delete-orphan"
    )
    seam_intervals: Mapped[list["SeamInterval"]] = relationship(
        back_populates="borehole", cascade="all, delete-orphan"
    )
    curves: Mapped[list["Curve"]] = relationship(back_populates="borehole", cascade="all, delete-orphan")
    core_images: Mapped[list["CoreImage"]] = relationship(
        back_populates="borehole", cascade="all, delete-orphan"
    )
    display_layouts: Mapped[list["DisplayLayout"]] = relationship(
        back_populates="borehole", cascade="all, delete-orphan"
    )
    validation_issues: Mapped[list["ValidationIssue"]] = relationship(
        back_populates="borehole", cascade="all, delete-orphan"
    )
    ai_suggestions: Mapped[list["AiSuggestion"]] = relationship(
        back_populates="borehole", cascade="all, delete-orphan"
    )
    source_imports: Mapped[list["SourceImport"]] = relationship(
        back_populates="borehole", cascade="all, delete-orphan"
    )
    source_files: Mapped[list["SourceFile"]] = relationship(
        back_populates="borehole", cascade="all, delete-orphan"
    )
    field_submissions: Mapped[list["FieldSubmission"]] = relationship(
        back_populates="borehole", cascade="all, delete-orphan"
    )
    export_jobs: Mapped[list["ExportJob"]] = relationship(
        back_populates="borehole", cascade="all, delete-orphan"
    )


class LithologyInterval(Base):
    __tablename__ = "lithology_intervals"
    __table_args__ = (
        Index("ix_lithology_borehole_depth", "borehole_id", "from_depth", "to_depth"),
    )

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    borehole_id: Mapped[int] = mapped_column(ForeignKey("boreholes.id"), index=True)
    source_row: Mapped[int | None] = mapped_column(Integer, nullable=True)
    from_depth: Mapped[float] = mapped_column(Float, index=True)
    to_depth: Mapped[float] = mapped_column(Float, index=True)
    lithology_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    lithology_label: Mapped[str] = mapped_column(String(160))
    display_color: Mapped[str | None] = mapped_column(String(32), nullable=True)
    logged_color: Mapped[str | None] = mapped_column(String(120), nullable=True)
    seam_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    recovery: Mapped[float | None] = mapped_column(Float, nullable=True)
    recovery_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    rqd: Mapped[float | None] = mapped_column(Float, nullable=True)
    structural_features: Mapped[str | None] = mapped_column(Text, nullable=True)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_box: Mapped[int | None] = mapped_column(Integer, nullable=True)
    image_file: Mapped[str | None] = mapped_column(String(255), nullable=True)
    attributes: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    borehole: Mapped[Borehole] = relationship(back_populates="lithology_intervals")


class CorrectionAudit(Base):
    __tablename__ = "correction_audits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    borehole_id: Mapped[int] = mapped_column(ForeignKey("boreholes.id"), index=True)
    interval_id: Mapped[str] = mapped_column(ForeignKey("lithology_intervals.id"), index=True)
    entity_type: Mapped[str] = mapped_column(String(80), default="lithology_interval")
    changed_by: Mapped[str] = mapped_column(String(160), default="demo-user")
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    change_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    before_values: Mapped[dict] = mapped_column(JSON)
    after_values: Mapped[dict] = mapped_column(JSON)


class ValidationIssue(Base):
    __tablename__ = "validation_issues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    borehole_id: Mapped[int] = mapped_column(ForeignKey("boreholes.id"), index=True)
    code: Mapped[str] = mapped_column(String(120), index=True)
    severity: Mapped[str] = mapped_column(String(40), index=True)
    message: Mapped[str] = mapped_column(Text)
    from_depth: Mapped[float | None] = mapped_column(Float, nullable=True)
    to_depth: Mapped[float | None] = mapped_column(Float, nullable=True)
    entity_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="open", index=True)
    issue_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    borehole: Mapped[Borehole] = relationship(back_populates="validation_issues")


class AiSuggestion(Base):
    __tablename__ = "ai_suggestions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    borehole_id: Mapped[int] = mapped_column(ForeignKey("boreholes.id"), index=True)
    validation_issue_id: Mapped[int | None] = mapped_column(ForeignKey("validation_issues.id"), nullable=True, index=True)
    suggestion_type: Mapped[str] = mapped_column(String(120), index=True)
    title: Mapped[str] = mapped_column(String(240))
    rationale: Mapped[str] = mapped_column(Text)
    recommended_action: Mapped[str] = mapped_column(Text)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="open", index=True)
    provider: Mapped[str] = mapped_column(String(80), default="rule_based")
    from_depth: Mapped[float | None] = mapped_column(Float, nullable=True)
    to_depth: Mapped[float | None] = mapped_column(Float, nullable=True)
    entity_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    patch: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    evidence: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    borehole: Mapped[Borehole] = relationship(back_populates="ai_suggestions")


class SourceImport(Base):
    __tablename__ = "source_imports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    borehole_id: Mapped[int] = mapped_column(ForeignKey("boreholes.id"), index=True)
    import_type: Mapped[str] = mapped_column(String(80), index=True)
    source_name: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(80), default="parsed", index=True)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    borehole: Mapped[Borehole] = relationship(back_populates="source_imports")


class ImportProfile(Base):
    __tablename__ = "import_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    profile_type: Mapped[str] = mapped_column(String(80), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    mapping: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class ExportProfile(Base):
    __tablename__ = "export_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    export_type: Mapped[str] = mapped_column(String(80), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    mapping: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class QualitySettings(Base):
    __tablename__ = "quality_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    settings: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class SourceFile(Base):
    __tablename__ = "source_files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    borehole_id: Mapped[int | None] = mapped_column(ForeignKey("boreholes.id"), nullable=True, index=True)
    source_import_id: Mapped[int | None] = mapped_column(ForeignKey("source_imports.id"), nullable=True)
    file_type: Mapped[str] = mapped_column(String(80), index=True)
    original_name: Mapped[str] = mapped_column(String(255))
    storage_path: Mapped[str] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(80), default="uploaded", index=True)
    file_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    borehole: Mapped[Borehole | None] = relationship(back_populates="source_files")


class FieldSubmission(Base):
    __tablename__ = "field_submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    borehole_id: Mapped[int] = mapped_column(ForeignKey("boreholes.id"), index=True)
    submission_type: Mapped[str] = mapped_column(String(80), index=True)
    status: Mapped[str] = mapped_column(String(80), default="synced", index=True)
    submitted_by: Mapped[str | None] = mapped_column(String(160), nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    borehole: Mapped[Borehole] = relationship(back_populates="field_submissions")


class ExportJob(Base):
    __tablename__ = "export_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    borehole_id: Mapped[int] = mapped_column(ForeignKey("boreholes.id"), index=True)
    export_type: Mapped[str] = mapped_column(String(80), index=True)
    status: Mapped[str] = mapped_column(String(80), default="generated", index=True)
    file_path: Mapped[str] = mapped_column(String(500))
    file_name: Mapped[str] = mapped_column(String(255))
    summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    borehole: Mapped[Borehole] = relationship(back_populates="export_jobs")


class SeamInterval(Base):
    __tablename__ = "seam_intervals"
    __table_args__ = (
        Index("ix_seam_borehole_depth", "borehole_id", "from_depth", "to_depth"),
    )

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    borehole_id: Mapped[int] = mapped_column(ForeignKey("boreholes.id"), index=True)
    source_row: Mapped[int | None] = mapped_column(Integer, nullable=True)
    name: Mapped[str] = mapped_column(String(120))
    from_depth: Mapped[float] = mapped_column(Float)
    to_depth: Mapped[float] = mapped_column(Float)
    thickness: Mapped[float | None] = mapped_column(Float, nullable=True)
    lithology_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    lithology_label: Mapped[str | None] = mapped_column(String(160), nullable=True)
    image_box: Mapped[int | None] = mapped_column(Integer, nullable=True)
    attributes: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    borehole: Mapped[Borehole] = relationship(back_populates="seam_intervals")


class Curve(Base):
    __tablename__ = "curves"
    __table_args__ = (
        Index("ix_curves_borehole_key", "borehole_id", "key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    borehole_id: Mapped[int] = mapped_column(ForeignKey("boreholes.id"), index=True)
    key: Mapped[str] = mapped_column(String(80), index=True)
    label: Mapped[str] = mapped_column(String(120))
    unit: Mapped[str] = mapped_column(String(40))
    source_type: Mapped[str] = mapped_column(String(40), default="synthetic")
    color: Mapped[str] = mapped_column(String(32))
    curve_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    borehole: Mapped[Borehole] = relationship(back_populates="curves")
    samples: Mapped[list["CurveSample"]] = relationship(
        back_populates="curve", cascade="all, delete-orphan"
    )


class CurveSample(Base):
    __tablename__ = "curve_samples"
    __table_args__ = (
        Index("ix_curve_samples_curve_depth", "curve_id", "depth"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    curve_id: Mapped[int] = mapped_column(ForeignKey("curves.id"), index=True)
    depth: Mapped[float] = mapped_column(Float, index=True)
    value: Mapped[float] = mapped_column(Float)

    curve: Mapped[Curve] = relationship(back_populates="samples")


class CoreImage(Base):
    __tablename__ = "core_images"
    __table_args__ = (
        Index("ix_core_images_borehole_depth", "borehole_id", "from_depth", "to_depth"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    borehole_id: Mapped[int] = mapped_column(ForeignKey("boreholes.id"), index=True)
    box_number: Mapped[int] = mapped_column(Integer, index=True)
    name: Mapped[str] = mapped_column(String(160))
    file_path: Mapped[str] = mapped_column(String(255))
    from_depth: Mapped[float | None] = mapped_column(Float, nullable=True)
    to_depth: Mapped[float | None] = mapped_column(Float, nullable=True)
    image_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    borehole: Mapped[Borehole] = relationship(back_populates="core_images")


class DisplayLayout(Base):
    __tablename__ = "display_layouts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    borehole_id: Mapped[int | None] = mapped_column(ForeignKey("boreholes.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(160))
    mode: Mapped[str] = mapped_column(String(40), default="runtime")
    settings: Mapped[dict] = mapped_column(JSON)

    borehole: Mapped[Borehole | None] = relationship(back_populates="display_layouts")
