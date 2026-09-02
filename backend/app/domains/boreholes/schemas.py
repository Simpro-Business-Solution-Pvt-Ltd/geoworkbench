from datetime import datetime

from pydantic import BaseModel, ConfigDict
from app.domains.imports.schemas import SourceFileOut


class BoreholeListItem(BaseModel):
    id: int
    code: str
    title: str
    total_depth: float
    workflow_status: str
    site_code: str
    project_code: str
    coordinates: dict | None = None


class BoreholeStatusOut(BaseModel):
    id: int
    code: str
    workflow_status: str
    message: str


class LithologyIntervalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source_row: int | None
    from_depth: float
    to_depth: float
    lithology_code: str | None
    lithology_label: str
    display_color: str | None
    logged_color: str | None
    seam_name: str | None
    recovery: float | None
    recovery_percent: float | None
    rqd: float | None
    structural_features: str | None
    remark: str | None
    image_box: int | None
    image_file: str | None
    attributes: dict | None = None


class LithologyIntervalPatch(BaseModel):
    lithology_code: str | None = None
    lithology_label: str | None = None
    seam_name: str | None = None
    remark: str | None = None
    from_depth: float | None = None
    to_depth: float | None = None
    recovery: float | None = None
    recovery_percent: float | None = None
    rqd: float | None = None
    logged_color: str | None = None
    structural_features: str | None = None


class SeamIntervalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source_row: int | None
    name: str
    from_depth: float
    to_depth: float
    thickness: float | None
    lithology_code: str | None
    lithology_label: str | None
    image_box: int | None
    attributes: dict | None = None


class CurveSampleOut(BaseModel):
    depth: float
    value: float


class CurveOut(BaseModel):
    id: int
    key: str
    label: str
    unit: str
    source_type: str
    color: str
    curve_metadata: dict | None = None
    samples: list[CurveSampleOut]


class CurveSampleWindowOut(BaseModel):
    borehole_id: int
    curve_id: int
    key: str
    from_depth: float
    to_depth: float
    full_sample_count: int
    window_sample_count: int
    returned_sample_count: int
    display_mode: str
    samples: list[CurveSampleOut]


class CoreImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    box_number: int
    name: str
    file_path: str
    from_depth: float | None
    to_depth: float | None
    url: str
    original_url: str
    strip_url: str | None
    strip_preview_url: str | None = None
    strip_metadata: dict | None = None
    image_metadata: dict | None = None


class DisplayLayoutOut(BaseModel):
    id: int
    name: str
    mode: str
    settings: dict


class DisplayLayoutPatch(BaseModel):
    name: str | None = None
    mode: str | None = None
    settings: dict | None = None


class DisplayLayoutCloneRequest(BaseModel):
    name: str | None = None


class ValidationIssueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    severity: str
    message: str
    from_depth: float | None
    to_depth: float | None
    entity_type: str | None
    entity_id: str | None
    status: str
    issue_metadata: dict | None


class AiSuggestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    validation_issue_id: int | None
    suggestion_type: str
    title: str
    rationale: str
    recommended_action: str
    confidence: float | None
    status: str
    provider: str
    from_depth: float | None
    to_depth: float | None
    entity_type: str | None
    entity_id: str | None
    patch: dict | None
    evidence: dict | None


class SourceImportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    import_type: str
    source_name: str
    status: str
    summary: dict | None


class FieldSubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    submission_type: str
    status: str
    submitted_by: str | None
    payload: dict | None


class CorrectionAuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    interval_id: str
    entity_type: str
    changed_by: str
    changed_at: datetime
    change_reason: str | None
    before_values: dict
    after_values: dict


class BoreholeWorkbenchOut(BaseModel):
    id: int
    code: str
    title: str
    state: str | None
    total_depth: float
    closure_note: str | None
    source_workbook: str | None
    source_sheet: str | None
    workflow_status: str
    attributes: dict | None = None
    lithology_intervals: list[LithologyIntervalOut]
    seam_intervals: list[SeamIntervalOut]
    curves: list[CurveOut]
    core_images: list[CoreImageOut]
    layout: DisplayLayoutOut | None
    display_layouts: list[DisplayLayoutOut] = []
    validation_issues: list[ValidationIssueOut]
    ai_suggestions: list[AiSuggestionOut]
    source_imports: list[SourceImportOut]
    field_submissions: list[FieldSubmissionOut]
    source_files: list[SourceFileOut]
    correction_audits: list[CorrectionAuditOut] = []
