import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import AiSuggestion, Borehole, CoreImage, CorrectionAudit, Curve, LithologyInterval, ValidationIssue
from app.domains.quality.service import get_quality_settings_payload
from app.services.ai_provider import AiProviderUnavailable, ai_provider_status, local_chat_completion
from app.services.quality_config import ai_summary_settings, ai_suggestion_settings
from app.services.validation.borehole_validation import replace_validation_issues, validate_borehole


def _load_borehole(db: Session, borehole_id: int) -> Borehole:
    borehole = db.scalar(
        select(Borehole)
        .where(Borehole.id == borehole_id)
        .options(
            selectinload(Borehole.lithology_intervals),
            selectinload(Borehole.seam_intervals),
            selectinload(Borehole.curves).selectinload(Curve.samples),
            selectinload(Borehole.core_images),
            selectinload(Borehole.validation_issues),
            selectinload(Borehole.ai_suggestions),
        )
    )
    if borehole is None:
        raise ValueError("Borehole not found")
    return borehole


def _interval_by_id(borehole: Borehole, interval_id: str | None) -> LithologyInterval | None:
    if not interval_id:
        return None
    return next((item for item in borehole.lithology_intervals if item.id == interval_id), None)


def _previous_interval(borehole: Borehole, interval: LithologyInterval) -> LithologyInterval | None:
    intervals = sorted(borehole.lithology_intervals, key=lambda item: item.from_depth)
    for index, candidate in enumerate(intervals):
        if candidate.id == interval.id and index > 0:
            return intervals[index - 1]
    return None


def _suggestion_for_issue(
    borehole: Borehole, issue: ValidationIssue, settings: dict | None = None
) -> dict | None:
    patch = None
    entity_id = issue.entity_id
    entity_type = issue.entity_type
    title = issue.code.replace("_", " ").title()
    action = "Review the source row and adjust the interval before approving export."
    rationale = issue.message
    confidence = 0.72
    from_depth = issue.from_depth
    to_depth = issue.to_depth

    suggestion_config = ai_suggestion_settings(settings)
    include_info_codes = set(suggestion_config["include_info_codes"])
    if issue.severity == "info" and issue.code not in include_info_codes:
        return None

    if issue.code == "missing_lithology_code":
        interval = _interval_by_id(borehole, issue.entity_id)
        previous = _previous_interval(borehole, interval) if interval else None
        if previous:
            patch = {
                "lithology_code": previous.lithology_code,
                "lithology_label": previous.lithology_label,
            }
            action = f"Use previous interval lithology `{previous.lithology_code}` if source row supports it."
            confidence = 0.58
        title = "Missing lithology code"

    elif issue.code == "recovery_exceeds_interval":
        interval = _interval_by_id(borehole, issue.entity_id)
        if interval:
            thickness = round(interval.to_depth - interval.from_depth, 3)
            if thickness > 0:
                patch = {"recovery": thickness, "recovery_percent": 100}
                action = "Cap recovery to interval thickness after checking the source workbook."
                confidence = 0.82
            else:
                action = "Fix the invalid depth range first; recovery cannot be corrected safely while thickness is negative."
                confidence = 0.9
        title = "Recovery exceeds interval thickness"

    elif issue.code == "invalid_rqd":
        interval = _interval_by_id(borehole, issue.entity_id)
        if interval and interval.rqd is not None and interval.rqd > 1:
            patch = {"rqd": 1}
            action = "Cap RQD at 100% after checking whether the source value is a data entry error."
            confidence = 0.86
        title = "RQD format needs review"

    elif issue.code == "interval_overlap":
        next_id = (issue.issue_metadata or {}).get("next_interval_id")
        previous_id = (issue.issue_metadata or {}).get("previous_interval_id")
        previous = _interval_by_id(borehole, previous_id)
        current = _interval_by_id(borehole, next_id)
        entity_id = next_id
        entity_type = "lithology_interval"
        if previous and current:
            patch = {"from_depth": round(previous.to_depth, 3)}
            action = "Align the later interval start depth to the previous interval end if source rows confirm continuity."
            confidence = 0.76
        title = "Overlapping lithology intervals"

    elif issue.code == "interval_gap":
        title = "Gap in lithology coverage"
        action = "Inspect adjacent rows and add a missing interval or adjust the boundary."
        confidence = 0.68

    elif issue.code == "invalid_interval_depth":
        title = "Invalid interval depth range"
        action = "Check from-depth, thickness, and to-depth. Do not auto-apply because the source row is contradictory."
        confidence = 0.9

    elif issue.code == "coal_interval_without_seam":
        title = "Coal interval has no seam label"
        action = "Review whether this coal/carbonaceous interval should inherit a seam name or remain local/non-seam coal."
        confidence = 0.52

    elif issue.code == "curve_depth_range_mismatch":
        entity_id = None
        entity_type = "curve"
        title = "Geophysical curve coverage needs review"
        action = (
            "Treat the imported geophysical curve as partial evidence. Confirm whether the missing "
            "depth coverage is expected for this source before using it for correction."
        )
        confidence = 0.64
        from_depth = None
        to_depth = None

    elif issue.code == "missing_recovery_data":
        title = "Recovery data missing"
        action = "Ask the site log or core run sheet to confirm recovery before approving this interval."
        confidence = 0.74

    elif issue.code == "missing_rqd_data":
        title = "RQD data missing"
        action = "Confirm whether RQD was not measured, not applicable, or omitted during field logging."
        confidence = 0.72

    elif issue.code == "curve_lithology_disagreement":
        interval = _interval_by_id(borehole, issue.entity_id)
        metadata = issue.issue_metadata or {}
        interpretation = metadata.get("interpretation")
        title = "Lithology and geophysical curves disagree"
        if interpretation == "coal_like_curve_response":
            action = (
                "Review this interval as a possible coal/carbonaceous candidate. Compare core image, "
                "remarks, gamma, resistivity, and density before changing lithology."
            )
            patch = {"lithology_code": "COAL", "lithology_label": "Coal"} if interval else None
            confidence = 0.7
        elif interpretation == "shale_like_curve_response":
            action = (
                "Review whether this coal interval includes shale/clay parting or whether the lithology "
                "boundary should be adjusted."
            )
            confidence = 0.66
        else:
            action = "Compare the interval against curve response and core image before final correction."
            confidence = 0.62

    elif issue.code == "caliper_washout_warning":
        title = "Possible washout from caliper curve"
        action = (
            "Treat recovery/RQD and lithology confidence cautiously in this interval. Check core condition, "
            "remarks, and drilling notes."
        )
        confidence = 0.63

    elif issue.code == "core_image_depth_mapping_missing":
        title = "Core image needs depth mapping"
        action = "Map the core image to box/run depth before relying on it as visual evidence."
        confidence = 0.7

    elif issue.code == "core_image_depth_mapping_conflict":
        title = "Core image depth mapping conflict"
        action = "Check the image box number and run depths; this image may be attached to the wrong depth range."
        confidence = 0.78

    return {
        "validation_issue_id": issue.id,
        "suggestion_type": issue.code,
        "title": title,
        "rationale": rationale,
        "recommended_action": action,
        "confidence": confidence,
        "from_depth": from_depth,
        "to_depth": to_depth,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "patch": patch,
        "evidence": {
            "validation_code": issue.code,
            "severity": issue.severity,
            "metadata": issue.issue_metadata or {},
            "provider_note": "Generated by deterministic validation assistant.",
        },
    }


def generate_suggestions(db: Session, borehole_id: int) -> list[AiSuggestion]:
    borehole = _load_borehole(db, borehole_id)
    quality_settings = get_quality_settings_payload(db)
    suggestion_config = ai_suggestion_settings(quality_settings)
    for suggestion in list(borehole.ai_suggestions):
        if suggestion.provider == "rule_based" and suggestion.status == "open":
            db.delete(suggestion)
    db.flush()

    if not suggestion_config["enabled"]:
        db.commit()
        db.refresh(borehole)
        return sorted(
            borehole.ai_suggestions,
            key=lambda item: (
                {"open": 0, "accepted": 1, "rejected": 2}.get(item.status, 3),
                item.from_depth if item.from_depth is not None else -1,
                item.id,
            ),
        )

    if suggestion_config["refresh_validation_before_suggestions"]:
        replace_validation_issues(borehole, validate_borehole(borehole, quality_settings))
        db.flush()
        db.refresh(borehole)

    existing_issue_ids = {
        item.validation_issue_id for item in borehole.ai_suggestions if item.validation_issue_id is not None
    }
    curve_coverage_issues = [
        issue for issue in borehole.validation_issues if issue.code == "curve_depth_range_mismatch"
    ]
    if suggestion_config["group_curve_coverage"] and curve_coverage_issues:
        labels = [
            (issue.issue_metadata or {}).get("curve_label")
            or (issue.issue_metadata or {}).get("curve_key")
            or issue.message
            for issue in curve_coverage_issues
        ]
        borehole.ai_suggestions.append(
            AiSuggestion(
                borehole_id=borehole.id,
                provider="rule_based",
                validation_issue_id=curve_coverage_issues[0].id,
                suggestion_type="curve_depth_range_mismatch",
                title="Geophysical curve coverage needs review",
                rationale=(
                    f"{len(curve_coverage_issues)} imported curve(s) do not cover the full borehole "
                    "depth range."
                ),
                recommended_action=(
                    "Treat these imported geophysical curves as partial evidence. Confirm whether "
                    "the missing depth coverage is expected before using them for correction."
                ),
                confidence=0.64,
                from_depth=None,
                to_depth=None,
                entity_type="curve",
                entity_id=None,
                patch=None,
                evidence={
                    "validation_code": "curve_depth_range_mismatch",
                    "severity": "info",
                    "curves": labels,
                    "provider_note": "Grouped deterministic validation assistant finding.",
                },
            )
        )
        existing_issue_ids.update(issue.id for issue in curve_coverage_issues)
    for issue in borehole.validation_issues:
        if issue.id in existing_issue_ids:
            continue
        payload = _suggestion_for_issue(borehole, issue, quality_settings)
        if payload is None:
            continue
        borehole.ai_suggestions.append(AiSuggestion(borehole_id=borehole.id, provider="rule_based", **payload))

    db.add(borehole)
    db.commit()
    db.refresh(borehole)
    return sorted(
        borehole.ai_suggestions,
        key=lambda item: (
            {"open": 0, "accepted": 1, "rejected": 2}.get(item.status, 3),
            item.from_depth if item.from_depth is not None else -1,
            item.id,
        ),
    )


def update_suggestion_status(db: Session, suggestion_id: int, status: str) -> AiSuggestion:
    suggestion = db.get(AiSuggestion, suggestion_id)
    if suggestion is None:
        raise ValueError("AI suggestion not found")
    if status not in {"open", "accepted", "rejected"}:
        raise ValueError("Unsupported suggestion status")
    suggestion.status = status
    suggestion.resolved_at = datetime.now(timezone.utc) if status in {"accepted", "rejected"} else None
    db.add(suggestion)
    db.commit()
    db.refresh(suggestion)
    return suggestion


def accept_suggestion(db: Session, suggestion_id: int) -> AiSuggestion:
    suggestion = db.get(AiSuggestion, suggestion_id)
    if suggestion is None:
        raise ValueError("AI suggestion not found")
    if suggestion.patch and suggestion.entity_type == "lithology_interval" and suggestion.entity_id:
        interval = db.get(LithologyInterval, suggestion.entity_id)
        if interval is not None:
            before_values = {field: getattr(interval, field) for field in suggestion.patch}
            for field, value in suggestion.patch.items():
                setattr(interval, field, value)
            after_values = {field: getattr(interval, field) for field in suggestion.patch}
            db.add(
                CorrectionAudit(
                    borehole_id=suggestion.borehole_id,
                    interval_id=interval.id,
                    entity_type="lithology_interval",
                    changed_by="ai-suggestion-review",
                    change_reason=f"Accepted suggestion {suggestion.id}",
                    before_values=before_values,
                    after_values=after_values,
                )
            )
            db.add(interval)
    suggestion.status = "accepted"
    suggestion.resolved_at = datetime.now(timezone.utc)
    db.add(suggestion)
    db.commit()
    db.refresh(suggestion)
    return suggestion


def summarize_borehole(db: Session, borehole_id: int) -> dict:
    borehole = _load_borehole(db, borehole_id)
    summary_config = ai_summary_settings(get_quality_settings_payload(db))
    intervals = borehole.lithology_intervals
    coal = [item for item in intervals if "COAL" in (item.lithology_code or "")]
    warnings = [item for item in borehole.validation_issues if item.severity in {"error", "warning"}]
    top_codes: dict[str, int] = {}
    for interval in intervals:
        code = interval.lithology_code or "UNKNOWN"
        top_codes[code] = top_codes.get(code, 0) + 1
    common = sorted(top_codes.items(), key=lambda item: item[1], reverse=True)[:5]
    deterministic_summary = (
        f"{borehole.code} covers {borehole.total_depth:.1f}m with {len(intervals)} lithology intervals. "
        f"Coal/carbonaceous intervals appear in {len(coal)} rows. "
        f"Current validation has {len(warnings)} error/warning items requiring review before export. "
        f"{summary_config['geologist_approval_note']}"
    )
    summary = deterministic_summary
    provider = ai_provider_status()
    if summary_config["use_local_llm_when_available"] and provider.get("enabled") and provider.get("reachable"):
        prompt = {
            "borehole": {
                "code": borehole.code,
                "title": borehole.title,
                "total_depth": borehole.total_depth,
                "lithology_intervals": len(intervals),
                "seam_intervals": len(borehole.seam_intervals),
                "curves": len(borehole.curves),
            },
            "top_lithology_codes": common,
            "validation_error_warning_count": len(warnings),
            "open_suggestion_count": len([item for item in borehole.ai_suggestions if item.status == "open"]),
            "important_rule_findings": [
                {
                    "code": item.code,
                    "severity": item.severity,
                    "message": item.message,
                    "from_depth": item.from_depth,
                    "to_depth": item.to_depth,
                }
                for item in warnings[: summary_config["max_rule_findings"]]
            ],
        }
        borehole_json = json.dumps(prompt, ensure_ascii=True)
        user_prompt = str(summary_config["user_prompt_template"])
        if "{borehole_json}" in user_prompt:
            user_prompt = user_prompt.replace("{borehole_json}", borehole_json)
        else:
            user_prompt = f"{user_prompt}\n{borehole_json}"
        try:
            ai_text = local_chat_completion(
                [
                    {
                        "role": "system",
                        "content": str(summary_config["system_prompt"]),
                    },
                    {
                        "role": "user",
                        "content": user_prompt,
                    },
                ],
                max_tokens=summary_config["max_tokens"],
                temperature=summary_config["temperature"],
            )
            if ai_text:
                summary = ai_text
                provider["used_for_summary"] = True
            else:
                provider["used_for_summary"] = False
                provider["summary_error"] = "AI provider returned an empty final response."
        except AiProviderUnavailable as exc:
            provider["used_for_summary"] = False
            provider["summary_error"] = str(exc)
    return {
        "borehole_id": borehole.id,
        "title": borehole.title,
        "summary": summary,
        "metrics": {
            "total_depth": borehole.total_depth,
            "lithology_intervals": len(intervals),
            "seam_intervals": len(borehole.seam_intervals),
            "curves": len(borehole.curves),
            "coal_interval_count": len(coal),
            "validation_error_warning_count": len(warnings),
            "top_lithology_codes": common,
            "deterministic_summary": deterministic_summary,
            "ai_provider": provider,
        },
    }


def provider_status() -> dict:
    return ai_provider_status()
