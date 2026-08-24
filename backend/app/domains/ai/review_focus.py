from app.db.models import Borehole, ValidationIssue


def build_review_focus(
    borehole: Borehole,
    warnings: list[ValidationIssue],
    open_suggestion_count: int,
    curve_coverage: list[dict],
    core_image_status: str,
) -> list[dict]:
    focus: list[dict] = []

    for issue in warnings[:3]:
        focus.append(
            {
                "priority": "critical" if issue.severity == "error" else "review",
                "title": issue.code.replace("_", " "),
                "evidence": _depth_evidence(issue.from_depth, issue.to_depth),
                "action": issue.message,
            }
        )

    if open_suggestion_count:
        focus.append(
            {
                "priority": "review",
                "title": "Open AI/rule suggestions",
                "evidence": f"{open_suggestion_count} suggestion(s)",
                "action": "Review suggested corrections and accept, reject, or override with geologist judgement.",
            }
        )

    partial_curves = [
        item
        for item in curve_coverage
        if item.get("sample_count")
        and item.get("from_depth") is not None
        and item.get("to_depth") is not None
        and borehole.total_depth
        and ((float(item["to_depth"]) - float(item["from_depth"])) / borehole.total_depth) < 0.8
    ]
    if partial_curves:
        labels = ", ".join(str(item["label"]) for item in partial_curves[:3])
        focus.append(
            {
                "priority": "watch",
                "title": "Partial curve evidence",
                "evidence": labels,
                "action": "Use curves as supporting evidence only where depth coverage exists.",
            }
        )
    elif not any(item.get("sample_count") for item in curve_coverage):
        focus.append(
            {
                "priority": "review",
                "title": "Geophysical evidence missing",
                "evidence": "No curve samples",
                "action": "Import LAS/geophysical logs before relying on curve-based interpretation.",
            }
        )

    if not borehole.seam_intervals:
        focus.append(
            {
                "priority": "review",
                "title": "Seam markers missing",
                "evidence": f"{len(borehole.lithology_intervals)} lithology interval(s), 0 seam marker(s)",
                "action": "Confirm seam names/markers before using this borehole in correlation.",
            }
        )

    if not borehole.core_images:
        focus.append(
            {
                "priority": "watch",
                "title": "Core image package missing",
                "evidence": core_image_status,
                "action": "Attach/process corebox images when visual evidence is required for correction.",
            }
        )

    if not focus:
        focus.append(
            {
                "priority": "ready",
                "title": "Ready for central interpretation",
                "evidence": f"{len(borehole.lithology_intervals)} intervals, {len(borehole.curves)} curves",
                "action": "Proceed with geologist review, save corrections, and prepare export readiness.",
            }
        )

    return focus[:6]


def review_focus_sentence(focus: list[dict]) -> str:
    if not focus:
        return ""
    top_items = "; ".join(f"{item['title']} ({item['priority']})" for item in focus[:3])
    return f"Review focus: {top_items}. "


def _depth_evidence(from_depth: float | None, to_depth: float | None) -> str:
    if from_depth is None:
        return "Whole borehole"
    if to_depth is None or to_depth == from_depth:
        return f"{from_depth:.2f}m"
    return f"{from_depth:.2f}-{to_depth:.2f}m"
