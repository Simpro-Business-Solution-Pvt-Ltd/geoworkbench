from pydantic import BaseModel, ConfigDict


class ExportReadinessOut(BaseModel):
    borehole_id: int
    ready: bool
    status: str
    checks: list[dict]
    counts: dict


class ExportJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    borehole_id: int
    export_type: str
    status: str
    file_path: str
    file_name: str
    summary: dict | None


class ExportProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    export_type: str
    description: str | None
    mapping: dict
    builtin: bool = False


class ExportProfilePatch(BaseModel):
    name: str | None = None
    description: str | None = None
    mapping: dict | None = None


class ExportProfileCreate(BaseModel):
    export_type: str
    name: str
    description: str | None = None
    mapping: dict


class ExportSourceFieldOut(BaseModel):
    key: str
    label: str
    unit: str | None = None
    group: str | None = None


class ExportRequest(BaseModel):
    export_type: str = "corrected_lithology_csv"
    export_profile_id: int | None = None
    stage: str | None = None
    from_depth: float | None = None
    to_depth: float | None = None
    sections: list[str] | None = None
