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


class ExportProfilePatch(BaseModel):
    name: str | None = None
    description: str | None = None
    mapping: dict | None = None


class ExportRequest(BaseModel):
    export_type: str = "corrected_lithology_csv"
