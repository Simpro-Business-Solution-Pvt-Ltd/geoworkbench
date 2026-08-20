from pydantic import BaseModel, Field

from app.domains.boreholes.schemas import BoreholeListItem


class MobileBoreholeCreate(BaseModel):
    project_code: str = "DEMO-COAL"
    project_name: str = "Demo Coal Block"
    site_code: str
    site_name: str | None = None
    borehole_code: str
    title: str | None = None
    total_depth: float = 0
    state: str | None = None
    current_depth: float | None = None
    coalgrid_easting: float | None = None
    coalgrid_northing: float | None = None
    utm_easting: float | None = None
    utm_northing: float | None = None
    reduced_level: float | None = None
    water_level: float | None = None
    coordinate_system: str | None = None


class MobileLithologyInterval(BaseModel):
    from_depth: float
    to_depth: float
    lithology_code: str | None = None
    lithology_label: str | None = None
    logged_color: str | None = None
    seam_name: str | None = None
    recovery: float | None = None
    recovery_percent: float | None = None
    rqd: float | None = None
    structural_features: str | None = None
    remark: str | None = None


class MobileRuntimeParameter(BaseModel):
    name: str
    value: str
    unit: str | None = None


class MobileFieldSubmissionCreate(BaseModel):
    borehole_id: int
    submission_type: str = "mobile_form"
    submitted_by: str | None = "site-geologist"
    status: str = "synced"
    current_depth: float | None = None
    lithology_intervals: list[MobileLithologyInterval] = Field(default_factory=list)
    runtime_parameters: list[MobileRuntimeParameter] = Field(default_factory=list)
    remarks: str | None = None
    payload: dict | None = None
    apply_to_log: bool = True


class MobileDemoCopyCreate(BaseModel):
    source_borehole_id: int
    new_code: str
    title_suffix: str = "(mobile submitted demo)"
    submitted_by: str | None = "site-geologist"


class MobileSubmissionOut(BaseModel):
    borehole: BoreholeListItem
    field_submission_id: int | None = None
    message: str
