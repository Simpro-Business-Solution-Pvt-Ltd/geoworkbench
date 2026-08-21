from datetime import datetime, timezone
from typing import Any


RAW_IMPORTED = "raw_imported"
FIELD_SUBMITTED = "field_submitted"
IMPORTED_INTERPRETED = "imported_interpreted"
SYSTEM_SUGGESTED = "system_suggested"
GEOLOGIST_CORRECTED = "geologist_corrected"
APPROVED_FINAL = "approved_final"

DATA_STAGE_LABELS = {
    RAW_IMPORTED: "Raw imported",
    FIELD_SUBMITTED: "Field submitted",
    IMPORTED_INTERPRETED: "Imported interpreted",
    SYSTEM_SUGGESTED: "System suggested",
    GEOLOGIST_CORRECTED: "Geologist corrected",
    APPROVED_FINAL: "Approved final",
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def merge_stage_metadata(
    existing: dict[str, Any] | None,
    stage: str,
    *,
    source_type: str | None = None,
    source_name: str | None = None,
    actor: str | None = None,
    note: str | None = None,
) -> dict[str, Any]:
    metadata = dict(existing or {})
    metadata["data_stage"] = stage
    metadata["data_stage_label"] = DATA_STAGE_LABELS.get(stage, stage.replace("_", " ").title())
    metadata["stage_updated_at"] = utc_now_iso()
    if source_type:
        metadata["stage_source_type"] = source_type
    if source_name:
        metadata["stage_source_name"] = source_name
    if actor:
        metadata["stage_actor"] = actor
    if note:
        metadata["stage_note"] = note
    return metadata

