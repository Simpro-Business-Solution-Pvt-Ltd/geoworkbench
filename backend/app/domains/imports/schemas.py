from pydantic import BaseModel, ConfigDict


class ImportProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    profile_type: str
    description: str | None
    mapping: dict


class ImportProfilePatch(BaseModel):
    name: str | None = None
    description: str | None = None
    mapping: dict | None = None


class SourceFileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    borehole_id: int | None
    source_import_id: int | None
    file_type: str
    original_name: str
    storage_path: str
    status: str
    file_metadata: dict | None


class SourceFileCreate(BaseModel):
    borehole_id: int | None = None
    file_type: str
    original_name: str
    storage_path: str
    file_metadata: dict | None = None


class SourceFileStatusPatch(BaseModel):
    status: str


class SourceFileMergeRequest(BaseModel):
    interval_mode: str | None = None
    curve_mode: str | None = None
    from_depth: float | None = None
    to_depth: float | None = None


class SourceFileProcessOut(BaseModel):
    source_file: SourceFileOut
    source_import_id: int
    summary: dict


class SourceFileImportOut(BaseModel):
    source_file: SourceFileOut
    borehole_id: int
    borehole_code: str
    summary: dict


class SourceFileMergeOut(BaseModel):
    source_file: SourceFileOut
    borehole_id: int
    status: str
    summary: dict
