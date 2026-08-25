import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import AiSuggestion, Borehole, CoreImage, CorrectionAudit, Curve, LithologyInterval, ValidationIssue
from app.domains.ai.review_focus import build_review_focus, review_focus_sentence
from app.domains.quality.service import get_quality_settings_payload
from app.services.ai_provider import AiProviderUnavailable, ai_provider_status, local_chat_completion
from app.services.quality_config import ai_summary_settings, ai_suggestion_settings
from app.services.validation.borehole_validation import replace_validation_issues, validate_borehole

MAX_DETAILED_SUGGESTIONS_PER_TYPE = 25


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
            selectinload(Borehole.source_imports),
            selectinload(Borehole.source_files),
        )
    )
    if borehole is None:
        raise ValueError("Borehole not found")
    return borehole


def _load_borehole_for_suggestions(db: Session, borehole_id: int, *, include_curve_samples: bool = False) -> Borehole:
    curve_loader = selectinload(Borehole.curves)
    if include_curve_samples:
        curve_loader = curve_loader.selectinload(Curve.samples)
    borehole = db.scalar(
        select(Borehole)
        .where(Borehole.id == borehole_id)
        .options(
            selectinload(Borehole.lithology_intervals),
            selectinload(Borehole.seam_intervals),
            curve_loader,
            selectinload(Borehole.core_images),
            selectinload(Borehole.validation_issues),
            selectinload(Borehole.ai_suggestions),
        )
    )
    if borehole is None:
        raise ValueError("Borehole not found")
    return borehole


def _load_boreholes_for_correlation(db: Session, borehole_ids: list[int]) -> list[Borehole]:
    requested = list(dict.fromkeys(borehole_ids))
    if not requested:
        return []
    boreholes = db.scalars(
        select(Borehole)
        .where(Borehole.id.in_(requested))
        .options(
            selectinload(Borehole.lithology_intervals),
            selectinload(Borehole.seam_intervals),
            selectinload(Borehole.curves),
            selectinload(Borehole.source_imports),
            selectinload(Borehole.source_files),
            selectinload(Borehole.core_images),
        )
    ).all()
    by_id = {item.id: item for item in boreholes}
    return [by_id[item] for item in requested if item in by_id]


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
    borehole = _load_borehole_for_suggestions(db, borehole_id, include_curve_samples=False)
    quality_settings = get_quality_settings_payload(db)
    suggestion_config = ai_suggestion_settings(quality_settings)
    for suggestion in list(borehole.ai_suggestions):
        if suggestion.provider == "rule_based" and suggestion.status == "open":
            borehole.ai_suggestions.remove(suggestion)
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

    # Large LAS-backed boreholes can contain hundreds of thousands of samples.
    # Use the current validation snapshot when it exists; users can run validation
    # explicitly before generating a fresh review.
    if suggestion_config["refresh_validation_before_suggestions"] and not borehole.validation_issues:
        borehole = _load_borehole_for_suggestions(db, borehole_id, include_curve_samples=True)
        replace_validation_issues(borehole, validate_borehole(borehole, quality_settings))
        db.flush()
        db.expire(borehole, ["validation_issues", "ai_suggestions"])

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
    emitted_by_code: dict[str, int] = {}
    skipped_by_code: dict[str, list[ValidationIssue]] = {}
    for issue in borehole.validation_issues:
        if issue.id in existing_issue_ids:
            continue
        payload = _suggestion_for_issue(borehole, issue, quality_settings)
        if payload is None:
            continue
        emitted = emitted_by_code.get(issue.code, 0)
        if emitted >= MAX_DETAILED_SUGGESTIONS_PER_TYPE:
            skipped_by_code.setdefault(issue.code, []).append(issue)
            continue
        emitted_by_code[issue.code] = emitted + 1
        borehole.ai_suggestions.append(AiSuggestion(borehole_id=borehole.id, provider="rule_based", **payload))

    for code, issues in skipped_by_code.items():
        first_issue = issues[0]
        title = first_issue.code.replace("_", " ").title()
        borehole.ai_suggestions.append(
            AiSuggestion(
                borehole_id=borehole.id,
                provider="rule_based",
                validation_issue_id=None,
                suggestion_type=code,
                title=f"{len(issues)} additional {title} finding(s)",
                rationale=(
                    f"{len(issues)} more {code.replace('_', ' ')} validation finding(s) exist after the first "
                    f"{MAX_DETAILED_SUGGESTIONS_PER_TYPE} detailed suggestions."
                ),
                recommended_action=(
                    "Use the validation layer and depth filters to review the remaining occurrences in batches. "
                    "Do not bulk-apply corrections without source verification."
                ),
                confidence=0.6,
                from_depth=min((item.from_depth for item in issues if item.from_depth is not None), default=None),
                to_depth=max((item.to_depth for item in issues if item.to_depth is not None), default=None),
                entity_type="borehole",
                entity_id=None,
                patch=None,
                evidence={
                    "validation_code": code,
                    "severity": first_issue.severity,
                    "grouped_count": len(issues),
                    "provider_note": "Grouped deterministic validation assistant finding.",
                },
            )
        )

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
    open_suggestions = [item for item in borehole.ai_suggestions if item.status == "open"]
    coal_thickness = round(
        sum(max(0, item.to_depth - item.from_depth) for item in coal),
        2,
    )
    seam_names = sorted(
        {
            name.strip()
            for name in [
                *[item.seam_name or "" for item in intervals],
                *[item.name or "" for item in borehole.seam_intervals],
            ]
            if name and name.strip()
        }
    )
    curve_coverage = [_curve_coverage_summary(curve) for curve in borehole.curves]
    curve_coverage_text = _curve_coverage_sentence(curve_coverage)
    core_image_status = (
        f"{len(borehole.core_images)} core image record(s) available"
        if borehole.core_images
        else "corebox image package not supplied"
    )
    top_codes: dict[str, int] = {}
    for interval in intervals:
        code = interval.lithology_code or "UNKNOWN"
        top_codes[code] = top_codes.get(code, 0) + 1
    common = sorted(top_codes.items(), key=lambda item: item[1], reverse=True)[:5]
    review_focus = build_review_focus(
        borehole,
        warnings,
        len(open_suggestions),
        curve_coverage,
        core_image_status,
    )
    deterministic_summary = (
        f"{borehole.code} covers {borehole.total_depth:.1f}m with {len(intervals)} lithology intervals. "
        f"Coal/carbonaceous intervals appear in {len(coal)} rows with about {coal_thickness:.2f}m combined thickness. "
        f"{len(seam_names)} seam marker(s) are available"
        f"{': ' + ', '.join(seam_names[:6]) if seam_names else ''}. "
        f"{curve_coverage_text} Source evidence includes {len(borehole.source_imports)} import batch(es), "
        f"{len(borehole.source_files)} source file(s), and {core_image_status}. "
        f"Current validation has {len(warnings)} error/warning items and {len(open_suggestions)} open AI/rule suggestion(s). "
        f"{review_focus_sentence(review_focus)}"
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
                "core_images": len(borehole.core_images),
                "source_imports": len(borehole.source_imports),
                "source_files": len(borehole.source_files),
            },
            "top_lithology_codes": common,
            "coal_carbonaceous": {
                "interval_count": len(coal),
                "combined_thickness_m": coal_thickness,
            },
            "seam_markers": seam_names,
            "curve_coverage": curve_coverage,
            "source_evidence": {
                "source_imports": len(borehole.source_imports),
                "source_files": len(borehole.source_files),
                "core_image_status": core_image_status,
            },
            "validation_error_warning_count": len(warnings),
            "open_suggestion_count": len(open_suggestions),
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
            "review_focus": review_focus,
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
                summary = _guardrail_correlation_summary(ai_text)
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
            "core_images": len(borehole.core_images),
            "source_imports": len(borehole.source_imports),
            "source_files": len(borehole.source_files),
            "coal_interval_count": len(coal),
            "coal_combined_thickness_m": coal_thickness,
            "seam_markers": seam_names,
            "curve_coverage": curve_coverage,
            "core_image_status": core_image_status,
            "validation_error_warning_count": len(warnings),
            "open_suggestion_count": len(open_suggestions),
            "top_lithology_codes": common,
            "deterministic_summary": deterministic_summary,
            "ai_provider": provider,
            "review_focus": review_focus,
        },
    }


def summarize_correlation(db: Session, borehole_ids: list[int], focus_seam: str | None = None, align_mode: str = "depth") -> dict:
    boreholes = _load_boreholes_for_correlation(db, borehole_ids)
    if not boreholes:
        raise ValueError("No boreholes found for correlation")

    summary_config = ai_summary_settings(get_quality_settings_payload(db))
    seam_rows = _correlation_seam_rows(boreholes)
    focus = _find_focus_seam(seam_rows, focus_seam)
    interpretable_seams = [row for row in seam_rows if not _is_generic_seam_name(row["seam_name"])]
    common = [
        row for row in interpretable_seams if row["present_count"] >= max(2, round(len(boreholes) * 0.6))
    ]
    missing = [row for row in interpretable_seams if row["missing_count"] > 0 and row["present_count"] >= 2]
    top_spread = [
        row
        for row in interpretable_seams
        if row["present_count"] >= 2 and (row["max_top"] - row["min_top"]) >= 10
    ]
    thickness_spread = [
        row
        for row in interpretable_seams
        if row["present_count"] >= 2 and (row["max_thickness"] - row["min_thickness"]) >= 1
    ]
    borehole_facts = [_correlation_borehole_fact(item) for item in boreholes]
    missing_coordinates = [item["code"] for item in borehole_facts if not item["has_coordinates"]]
    default_rl = [item["code"] for item in borehole_facts if item["rl_source"] == "default"]
    gamma_ready = [item["code"] for item in borehole_facts if item["has_gamma"]]
    core_ready = [item["code"] for item in borehole_facts if item["core_images"]]

    deterministic_summary = _correlation_rule_summary(
        boreholes,
        focus,
        missing,
        top_spread,
        thickness_spread,
        gamma_ready,
        missing_coordinates,
        default_rl,
        summary_config["geologist_approval_note"],
    )
    summary = deterministic_summary
    provider = ai_provider_status()

    prompt = {
        "selected_boreholes": [
            {
                "code": item["code"],
                "total_depth": item["total_depth"],
                "seam_intervals": item["seam_intervals"],
                "has_gamma": item["has_gamma"],
                "rl_source": item["rl_source"],
                "has_coordinates": item["has_coordinates"],
            }
            for item in borehole_facts
        ],
        "align_mode": align_mode if align_mode in {"depth", "rl"} else "depth",
        "focus_seam": _thin_seam_row(focus) if focus else None,
        "top_common_seams": [_thin_seam_row(row) for row in common[:3]],
        "missing_marker_reviews": [_thin_seam_row(row) for row in _rank_missing_seams(missing)[:3]],
        "top_depth_spread_reviews": [_thin_seam_row(row) for row in _rank_top_spread_seams(top_spread)[:3]],
        "thickness_variation_reviews": [_thin_seam_row(row) for row in _rank_thickness_spread_seams(thickness_spread)[:3]],
        "evidence_readiness": {
            "gamma_ready_count": len(gamma_ready),
            "corebox_images_available_count": len(core_ready),
            "missing_coordinates": missing_coordinates,
            "estimated_rl": default_rl,
        },
    }
    if summary_config["use_local_llm_when_available"] and provider.get("enabled") and provider.get("reachable"):
        try:
            ai_text = local_chat_completion(
                [
                    {
                        "role": "system",
                        "content": (
                            "You are a cautious coal geology correlation assistant. Use only the provided JSON. "
                            "Do not invent missing seams, coordinates, faults, resources, or predictions. "
                            "Do not diagnose or mention fault, structural displacement, reserve, or prediction. "
                            "If evidence varies, say only that the seam/depth/label needs geologist review. "
                            "Write only the final answer as 4-6 concise bullets. Include practical geologist actions, "
                            "what evidence supports them, and what must be confirmed manually."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            "Create actionable correlation insights for central geologist review from this JSON:\n"
                            f"{json.dumps(prompt, ensure_ascii=True)}"
                        ),
                    },
                ],
                max_tokens=min(650, summary_config["max_tokens"]),
                temperature=summary_config["temperature"],
            )
            if ai_text:
                summary = _guardrail_correlation_summary(ai_text)
                provider["used_for_summary"] = True
            else:
                provider["used_for_summary"] = False
                provider["summary_error"] = "AI provider returned an empty final response."
        except AiProviderUnavailable as exc:
            provider["used_for_summary"] = False
            provider["summary_error"] = str(exc)

    return {
        "title": "Correlation AI insights",
        "summary": summary,
        "metrics": {
            "borehole_count": len(boreholes),
            "boreholes": [item.code for item in boreholes],
            "align_mode": align_mode,
            "focus_seam": focus,
            "common_seam_count": len(common),
            "missing_marker_review_count": len(missing),
            "top_depth_spread_review_count": len(top_spread),
            "thickness_variation_review_count": len(thickness_spread),
            "gamma_ready_count": len(gamma_ready),
            "corebox_ready_count": len(core_ready),
            "missing_coordinates": missing_coordinates,
            "estimated_rl": default_rl,
            "ai_provider": provider,
            "deterministic_summary": deterministic_summary,
        },
    }


def _curve_coverage_summary(curve: Curve) -> dict:
    depths = [sample.depth for sample in curve.samples]
    if not depths:
        return {
            "key": curve.key,
            "label": curve.label,
            "sample_count": 0,
            "from_depth": None,
            "to_depth": None,
        }
    return {
        "key": curve.key,
        "label": curve.label,
        "sample_count": len(depths),
        "from_depth": round(min(depths), 3),
        "to_depth": round(max(depths), 3),
    }


def _curve_coverage_sentence(curve_coverage: list[dict]) -> str:
    available = [item for item in curve_coverage if item["sample_count"]]
    if not available:
        return "No geophysical curve samples are available. "
    labels = ", ".join(str(item["label"]) for item in available[:4])
    sample_count = sum(int(item["sample_count"]) for item in available)
    return f"{len(available)} curve(s) are available ({labels}) with {sample_count} sample point(s). "


def _correlation_borehole_fact(borehole: Borehole) -> dict:
    metadata = _metadata_for_borehole(borehole)
    curve_labels = [curve.label for curve in borehole.curves]
    return {
        "id": borehole.id,
        "code": borehole.code,
        "total_depth": borehole.total_depth,
        "lithology_intervals": len(borehole.lithology_intervals),
        "seam_intervals": len(borehole.seam_intervals),
        "curve_count": len(curve_labels),
        "curves": curve_labels[:8],
        "has_gamma": any(_is_gamma_curve(curve) for curve in borehole.curves),
        "core_images": len(borehole.core_images),
        "source_files": len(borehole.source_files),
        "rl": metadata["rl"],
        "rl_source": metadata["rl_source"],
        "has_coordinates": metadata["x"] is not None and metadata["y"] is not None,
        "water_level": metadata["water_level"],
    }


def _correlation_seam_rows(boreholes: list[Borehole]) -> list[dict]:
    groups: dict[str, list[dict]] = {}
    for borehole in boreholes:
        for seam in borehole.seam_intervals:
            name = (seam.name or "Unnamed seam").strip().upper()
            top = float(seam.from_depth)
            bottom = float(seam.to_depth)
            groups.setdefault(name, []).append(
                {
                    "borehole": borehole.code,
                    "top": round(top, 3),
                    "bottom": round(bottom, 3),
                    "thickness": round(max(0.0, bottom - top), 3),
                }
            )
    rows = []
    for seam_name, items in groups.items():
        tops = [item["top"] for item in items]
        thicknesses = [item["thickness"] for item in items]
        present_count = len({item["borehole"] for item in items})
        rows.append(
            {
                "seam_name": seam_name,
                "present_count": present_count,
                "missing_count": max(0, len(boreholes) - present_count),
                "min_top": min(tops),
                "max_top": max(tops),
                "min_thickness": min(thicknesses),
                "max_thickness": max(thicknesses),
                "items": items[:20],
            }
        )
    return sorted(rows, key=lambda item: (-item["present_count"], item["min_top"], item["seam_name"]))


def _find_focus_seam(seam_rows: list[dict], focus_seam: str | None) -> dict | None:
    if not seam_rows:
        return None
    if focus_seam:
        normalized = focus_seam.strip().upper()
        for row in seam_rows:
            if row["seam_name"] == normalized:
                return row
    return next((row for row in seam_rows if not _is_generic_seam_name(row["seam_name"])), seam_rows[0])


def _is_generic_seam_name(name: str) -> bool:
    normalized = name.strip().upper()
    return normalized in {"BAND", "UNNAMED"} or len(normalized) <= 2


def _correlation_rule_summary(
    boreholes: list[Borehole],
    focus: dict | None,
    missing: list[dict],
    top_spread: list[dict],
    thickness_spread: list[dict],
    gamma_ready: list[str],
    missing_coordinates: list[str],
    default_rl: list[str],
    approval_note: str,
) -> str:
    bullets = [
        (
            f"* **Correlation set:** {len(boreholes)} boreholes selected "
            f"({', '.join(item.code for item in boreholes)}); gamma evidence is available in "
            f"{len(gamma_ready)}/{len(boreholes)} boreholes."
        )
    ]
    if focus:
        bullets.append(
            f"* **Focus seam {focus['seam_name']}:** present in {focus['present_count']}/{len(boreholes)} boreholes; "
            f"top range {focus['min_top']:.2f}-{focus['max_top']:.2f}m and thickness range "
            f"{focus['min_thickness']:.2f}-{focus['max_thickness']:.2f}m need manual continuity confirmation."
        )
    for row in _rank_top_spread_seams(top_spread)[:2]:
        bullets.append(
            f"* **Depth spread review:** {row['seam_name']} top varies by "
            f"{row['max_top'] - row['min_top']:.2f}m; compare lithology and gamma response before accepting the marker correlation."
        )
    if missing:
        names = ", ".join(row["seam_name"] for row in _rank_missing_seams(missing)[:4])
        bullets.append(
            f"* **Missing marker review:** {names} are absent in at least one selected borehole; confirm true absence versus naming or logging gap."
        )
    for row in _rank_thickness_spread_seams(thickness_spread)[:1]:
        bullets.append(
            f"* **Thickness review:** {row['seam_name']} thickness range is "
            f"{row['min_thickness']:.2f}-{row['max_thickness']:.2f}m; inspect whether partings or merged intervals explain the variation."
        )
    if missing_coordinates or default_rl:
        bullets.append(
            f"* **Datum readiness:** coordinates missing for {len(missing_coordinates)} borehole(s), "
            f"RL estimated for {len(default_rl)} borehole(s); confirm survey/collar metadata before RL-based interpretation."
        )
    bullets.append(f"* **Approval:** {approval_note}")
    return "\n".join(bullets[:6])


def _rank_top_spread_seams(rows: list[dict]) -> list[dict]:
    return sorted(rows, key=lambda row: row["max_top"] - row["min_top"], reverse=True)


def _rank_thickness_spread_seams(rows: list[dict]) -> list[dict]:
    return sorted(rows, key=lambda row: row["max_thickness"] - row["min_thickness"], reverse=True)


def _rank_missing_seams(rows: list[dict]) -> list[dict]:
    return sorted(rows, key=lambda row: (-row["present_count"], row["min_top"], row["seam_name"]))


def _thin_seam_row(row: dict | None) -> dict | None:
    if not row:
        return None
    return {
        "seam_name": row["seam_name"],
        "present_count": row["present_count"],
        "missing_count": row["missing_count"],
        "top_range_m": [round(row["min_top"], 2), round(row["max_top"], 2)],
        "top_spread_m": round(row["max_top"] - row["min_top"], 2),
        "thickness_range_m": [round(row["min_thickness"], 2), round(row["max_thickness"], 2)],
        "thickness_spread_m": round(row["max_thickness"] - row["min_thickness"], 2),
        "boreholes": [item["borehole"] for item in row.get("items", [])[:8]],
    }


def _compact_seam_row(row: dict | None) -> dict | None:
    if not row:
        return None
    items = row.get("items") if isinstance(row.get("items"), list) else []
    return {
        "seam_name": row["seam_name"],
        "present_count": row["present_count"],
        "missing_count": row["missing_count"],
        "top_range_m": [row["min_top"], row["max_top"]],
        "top_spread_m": round(row["max_top"] - row["min_top"], 3),
        "thickness_range_m": [row["min_thickness"], row["max_thickness"]],
        "thickness_spread_m": round(row["max_thickness"] - row["min_thickness"], 3),
        "sample_picks": [
            {
                "borehole": item["borehole"],
                "top": item["top"],
                "bottom": item["bottom"],
                "thickness": item["thickness"],
            }
            for item in items[:8]
        ],
    }


def _guardrail_correlation_summary(summary: str) -> str:
    replacements = {
        "major structural displacement": "large depth variation requiring review",
        "structural displacement": "depth variation requiring review",
        "structural dipping or geological complexity": "depth variation, naming differences, or data gaps",
        "structural dipping": "depth variation",
        "fault": "depth offset requiring review",
        "3D structural models": "correlation sections",
        "3D correlation model": "correlation section",
        "prediction": "review note",
        "predictions": "review notes",
        "reserve": "resource review",
        "reserves": "resource reviews",
    }
    guarded = summary
    for source, target in replacements.items():
        guarded = guarded.replace(source, target).replace(source.title(), target)
    return guarded


def _is_gamma_curve(curve: Curve) -> bool:
    key = "".join(ch for ch in curve.key.lower() if ch.isalnum())
    label = curve.label.lower()
    return key in {"gamma", "ngam", "ngamma", "gr"} or "gamma" in label


def _metadata_for_borehole(borehole: Borehole) -> dict:
    attributes = _object_value(borehole.attributes)
    collar = _object_value(attributes.get("collar"))
    import_metadata: dict = {}
    legacy_summary: dict = {}
    for source_import in borehole.source_imports:
        summary = _object_value(source_import.summary)
        import_metadata.update(_object_value(summary.get("metadata")))
        import_metadata.update(_object_value(summary.get("collar")))
        if summary.get("rl_m") is not None:
            legacy_summary = summary
    collar_rl = _first_number(collar, ["reduced_level", "rl", "rl_m"])
    import_rl = _first_number(import_metadata, ["reduced_level", "rl", "rl_m"])
    legacy_rl = _number_value(legacy_summary.get("rl_m"))
    rl = collar_rl if collar_rl is not None else import_rl if import_rl is not None else legacy_rl if legacy_rl is not None else 220
    rl_source = "collar" if collar_rl is not None else "import" if import_rl is not None or legacy_rl is not None else "default"
    return {
        "rl": rl,
        "rl_source": rl_source,
        "x": _first_available_number(
            _first_number(collar, ["coalgrid_easting", "utm_easting", "collar_x"]),
            _first_number(import_metadata, ["coalgrid_easting", "utm_easting", "collar_x"]),
            _number_value(legacy_summary.get("collar_x")),
        ),
        "y": _first_available_number(
            _first_number(collar, ["coalgrid_northing", "utm_northing", "collar_y"]),
            _first_number(import_metadata, ["coalgrid_northing", "utm_northing", "collar_y"]),
            _number_value(legacy_summary.get("collar_y")),
        ),
        "water_level": _first_available_number(
            _first_number(collar, ["water_level", "water_level_m"]),
            _first_number(import_metadata, ["water_level", "water_level_m"]),
            _number_value(legacy_summary.get("water_level_m")),
        ),
    }


def _object_value(value) -> dict:
    return value if isinstance(value, dict) else {}


def _first_number(source: dict, keys: list[str]) -> float | None:
    for key in keys:
        value = _number_value(source.get(key))
        if value is not None:
            return value
    return None


def _first_available_number(*values: float | None) -> float | None:
    for value in values:
        if value is not None:
            return value
    return None


def _number_value(value) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str) and value.strip():
        try:
            return float(value)
        except ValueError:
            return None
    return None


def provider_status() -> dict:
    return ai_provider_status()
