from dataclasses import dataclass, field, replace
from bisect import bisect_left, bisect_right

from app.db.models import Borehole, Curve, LithologyInterval, ValidationIssue
from app.services.quality_config import validation_rule_lookup


@dataclass
class ValidationFinding:
    code: str
    severity: str
    message: str
    from_depth: float | None = None
    to_depth: float | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    metadata: dict = field(default_factory=dict)


COAL_CODES = {"COAL", "SHCOAL", "CARBSHL", "CARBSHH", "CARBCLAY"}


def validate_borehole(borehole: Borehole, settings: dict | None = None) -> list[ValidationFinding]:
    findings: list[ValidationFinding] = []
    intervals = sorted(borehole.lithology_intervals, key=lambda item: (item.from_depth, item.to_depth))

    findings.extend(validate_interval_ranges(borehole, intervals))
    findings.extend(validate_interval_coverage(borehole, intervals))
    findings.extend(validate_recovery_and_rqd(intervals))
    findings.extend(validate_seam_labels(intervals))
    findings.extend(validate_curve_ranges(borehole, borehole.curves))
    findings.extend(validate_core_image_links(borehole, intervals))
    findings.extend(validate_required_interval_metrics(intervals))
    findings.extend(validate_curve_lithology_alignment(borehole, intervals, borehole.curves))
    findings.extend(validate_caliper_washout(borehole, borehole.curves))
    findings.extend(validate_core_image_depth_mapping(borehole))
    return apply_validation_settings(findings, settings)


def apply_validation_settings(
    findings: list[ValidationFinding], settings: dict | None = None
) -> list[ValidationFinding]:
    rules = validation_rule_lookup(settings)
    configured: list[ValidationFinding] = []
    for finding in findings:
        rule = rules.get(finding.code)
        if rule is not None and not rule.get("enabled", True):
            continue
        configured.append(replace(finding, severity=str((rule or {}).get("severity") or finding.severity)))
    return configured


def validate_interval_ranges(
    borehole: Borehole, intervals: list[LithologyInterval]
) -> list[ValidationFinding]:
    findings: list[ValidationFinding] = []
    for interval in intervals:
        if interval.from_depth < 0 or interval.to_depth > borehole.total_depth:
            findings.append(
                ValidationFinding(
                    code="interval_outside_borehole",
                    severity="error",
                    message=f"Interval {interval.id} is outside borehole depth range.",
                    from_depth=interval.from_depth,
                    to_depth=interval.to_depth,
                    entity_type="lithology_interval",
                    entity_id=interval.id,
                )
            )
        if interval.to_depth <= interval.from_depth:
            findings.append(
                ValidationFinding(
                    code="invalid_interval_depth",
                    severity="error",
                    message=f"Interval {interval.id} has invalid from/to depths.",
                    from_depth=interval.from_depth,
                    to_depth=interval.to_depth,
                    entity_type="lithology_interval",
                    entity_id=interval.id,
                )
            )
        if not interval.lithology_code:
            findings.append(
                ValidationFinding(
                    code="missing_lithology_code",
                    severity="error",
                    message=f"Interval {interval.id} is missing lithology code.",
                    from_depth=interval.from_depth,
                    to_depth=interval.to_depth,
                    entity_type="lithology_interval",
                    entity_id=interval.id,
                )
            )
    return findings


def validate_interval_coverage(
    borehole: Borehole, intervals: list[LithologyInterval]
) -> list[ValidationFinding]:
    findings: list[ValidationFinding] = []
    if not intervals:
        return [
            ValidationFinding(
                code="missing_lithology_intervals",
                severity="error",
                message="No lithology intervals are available for this borehole.",
                from_depth=0,
                to_depth=borehole.total_depth,
            )
        ]

    tolerance = 0.01
    first = intervals[0]
    if first.from_depth > tolerance:
        findings.append(
            ValidationFinding(
                code="interval_gap",
                severity="warning",
                message=f"Gap from 0.00m to {first.from_depth:.2f}m before first lithology interval.",
                from_depth=0,
                to_depth=first.from_depth,
            )
        )

    for previous, current in zip(intervals, intervals[1:]):
        if current.from_depth > previous.to_depth + tolerance:
            findings.append(
                ValidationFinding(
                    code="interval_gap",
                    severity="warning",
                    message=f"Gap between intervals {previous.id} and {current.id}.",
                    from_depth=previous.to_depth,
                    to_depth=current.from_depth,
                    metadata={"previous_interval_id": previous.id, "next_interval_id": current.id},
                )
            )
        if current.from_depth < previous.to_depth - tolerance:
            findings.append(
                ValidationFinding(
                    code="interval_overlap",
                    severity="error",
                    message=f"Overlap between intervals {previous.id} and {current.id}.",
                    from_depth=current.from_depth,
                    to_depth=previous.to_depth,
                    metadata={"previous_interval_id": previous.id, "next_interval_id": current.id},
                )
            )

    last = intervals[-1]
    if last.to_depth < borehole.total_depth - tolerance:
        findings.append(
            ValidationFinding(
                code="interval_gap",
                severity="warning",
                message=f"Gap from {last.to_depth:.2f}m to final depth {borehole.total_depth:.2f}m.",
                from_depth=last.to_depth,
                to_depth=borehole.total_depth,
            )
        )
    return findings


def validate_recovery_and_rqd(intervals: list[LithologyInterval]) -> list[ValidationFinding]:
    findings: list[ValidationFinding] = []
    for interval in intervals:
        thickness = interval.to_depth - interval.from_depth
        if interval.recovery is not None and interval.recovery > thickness + 0.01:
            findings.append(
                ValidationFinding(
                    code="recovery_exceeds_interval",
                    severity="warning",
                    message=f"Recovery exceeds interval thickness for {interval.id}.",
                    from_depth=interval.from_depth,
                    to_depth=interval.to_depth,
                    entity_type="lithology_interval",
                    entity_id=interval.id,
                    metadata={"recovery": interval.recovery, "thickness": thickness},
                )
            )
        if interval.rqd is not None and (interval.rqd < 0 or interval.rqd > 1):
            findings.append(
                ValidationFinding(
                    code="invalid_rqd",
                    severity="warning",
                    message=f"RQD value is outside 0-100% for {interval.id}.",
                    from_depth=interval.from_depth,
                    to_depth=interval.to_depth,
                    entity_type="lithology_interval",
                    entity_id=interval.id,
                    metadata={"rqd": interval.rqd},
                )
            )
    return findings


def validate_seam_labels(intervals: list[LithologyInterval]) -> list[ValidationFinding]:
    findings: list[ValidationFinding] = []
    for interval in intervals:
        if interval.lithology_code in COAL_CODES and not interval.seam_name:
            findings.append(
                ValidationFinding(
                    code="coal_interval_without_seam",
                    severity="info",
                    message=f"Coal/carbonaceous interval {interval.id} has no seam label.",
                    from_depth=interval.from_depth,
                    to_depth=interval.to_depth,
                    entity_type="lithology_interval",
                    entity_id=interval.id,
                )
            )
    return findings


def validate_curve_ranges(borehole: Borehole, curves: list[Curve]) -> list[ValidationFinding]:
    findings: list[ValidationFinding] = []
    for curve in curves:
        if not curve.samples:
            findings.append(
                ValidationFinding(
                    code="curve_has_no_samples",
                    severity="warning",
                    message=f"Curve {curve.label} has no samples.",
                    entity_type="curve",
                    entity_id=str(curve.id),
                )
            )
            continue
        min_depth = min(sample.depth for sample in curve.samples)
        max_depth = max(sample.depth for sample in curve.samples)
        if min_depth > 0.5 or max_depth < borehole.total_depth - 0.5:
            findings.append(
                ValidationFinding(
                    code="curve_depth_range_mismatch",
                    severity="info",
                    message=f"Curve {curve.label} does not cover the full borehole depth range.",
                    from_depth=min_depth,
                    to_depth=max_depth,
                    entity_type="curve",
                    entity_id=str(curve.id),
                    metadata={"curve_key": curve.key, "total_depth": borehole.total_depth},
                )
            )
    return findings


def validate_core_image_links(borehole: Borehole, intervals: list[LithologyInterval]) -> list[ValidationFinding]:
    findings: list[ValidationFinding] = []
    if not borehole.core_images and all(interval.image_box is None for interval in intervals):
        return []
    for interval in intervals:
        if interval.image_box is None:
            findings.append(
                ValidationFinding(
                    code="missing_core_image_link",
                    severity="info",
                    message=f"Interval {interval.id} has no linked core image.",
                    from_depth=interval.from_depth,
                    to_depth=interval.to_depth,
                    entity_type="lithology_interval",
                    entity_id=interval.id,
                )
            )
    return findings


def validate_required_interval_metrics(intervals: list[LithologyInterval]) -> list[ValidationFinding]:
    findings: list[ValidationFinding] = []
    missing_recovery = [
        interval
        for interval in intervals
        if interval.recovery is None or interval.recovery_percent is None
    ]
    missing_rqd = [interval for interval in intervals if interval.rqd is None]
    if missing_recovery:
        findings.append(
            ValidationFinding(
                code="missing_recovery_data",
                severity="warning",
                message=f"Recovery values are missing for {len(missing_recovery)} interval(s).",
                from_depth=missing_recovery[0].from_depth,
                to_depth=missing_recovery[-1].to_depth,
                entity_type="borehole",
                metadata={"missing_interval_count": len(missing_recovery)},
            )
        )
    if missing_rqd:
        findings.append(
            ValidationFinding(
                code="missing_rqd_data",
                severity="warning",
                message=f"RQD values are missing for {len(missing_rqd)} interval(s).",
                from_depth=missing_rqd[0].from_depth,
                to_depth=missing_rqd[-1].to_depth,
                entity_type="borehole",
                metadata={"missing_interval_count": len(missing_rqd)},
            )
        )
    return findings


def _curve_by_keys(curves: list[Curve], keys: set[str]) -> Curve | None:
    return next((curve for curve in curves if curve.key.lower() in keys), None)


def _sample_average(curve: Curve | None, from_depth: float, to_depth: float) -> float | None:
    if curve is None:
        return None
    values = [
        sample.value
        for sample in curve.samples
        if sample.depth >= from_depth and sample.depth <= to_depth
    ]
    if not values:
        return None
    return sum(values) / len(values)


def _sample_averages_by_interval(
    curve: Curve | None, intervals: list[LithologyInterval]
) -> dict[str, float | None]:
    if curve is None or not curve.samples:
        return {interval.id: None for interval in intervals}
    samples = sorted(curve.samples, key=lambda item: item.depth)
    depths = [sample.depth for sample in samples]
    prefix: list[float] = [0.0]
    for sample in samples:
        prefix.append(prefix[-1] + sample.value)

    averages: dict[str, float | None] = {}
    for interval in intervals:
        start = bisect_left(depths, interval.from_depth)
        end = bisect_right(depths, interval.to_depth)
        count = end - start
        averages[interval.id] = (prefix[end] - prefix[start]) / count if count else None
    return averages


def validate_curve_lithology_alignment(
    borehole: Borehole, intervals: list[LithologyInterval], curves: list[Curve]
) -> list[ValidationFinding]:
    gamma = _curve_by_keys(curves, {"gamma", "ngam", "natural_gamma"})
    resistivity = _curve_by_keys(curves, {"res", "resistivity", "16n", "64n", "spr"})
    density = _curve_by_keys(curves, {"dens", "density", "lsd"})
    if gamma is None and resistivity is None and density is None:
        return []

    findings: list[ValidationFinding] = []
    gamma_averages = _sample_averages_by_interval(gamma, intervals)
    resistivity_averages = _sample_averages_by_interval(resistivity, intervals)
    density_averages = _sample_averages_by_interval(density, intervals)
    for interval in intervals:
        if interval.to_depth - interval.from_depth < 1:
            continue
        gamma_avg = gamma_averages.get(interval.id)
        resistivity_avg = resistivity_averages.get(interval.id)
        density_avg = density_averages.get(interval.id)
        coal_like = (
            (gamma_avg is not None and gamma_avg < 55)
            and (resistivity_avg is None or resistivity_avg > 55)
            and (density_avg is None or density_avg < 1.85)
        )
        shale_like = gamma_avg is not None and gamma_avg > 95 and (resistivity_avg is None or resistivity_avg < 35)
        is_coal = (interval.lithology_code or "").upper() in COAL_CODES
        if coal_like and not is_coal:
            findings.append(
                ValidationFinding(
                    code="curve_lithology_disagreement",
                    severity="warning",
                    message=(
                        f"Curve response over {interval.id} is coal-like but the interval is logged as "
                        f"{interval.lithology_code or 'unknown'}."
                    ),
                    from_depth=interval.from_depth,
                    to_depth=interval.to_depth,
                    entity_type="lithology_interval",
                    entity_id=interval.id,
                    metadata={
                        "gamma_avg": round(gamma_avg, 2) if gamma_avg is not None else None,
                        "resistivity_avg": round(resistivity_avg, 2) if resistivity_avg is not None else None,
                        "density_avg": round(density_avg, 3) if density_avg is not None else None,
                        "interpretation": "coal_like_curve_response",
                    },
                )
            )
        if shale_like and is_coal:
            findings.append(
                ValidationFinding(
                    code="curve_lithology_disagreement",
                    severity="warning",
                    message=f"Curve response over {interval.id} is shale-like but the interval is logged as coal.",
                    from_depth=interval.from_depth,
                    to_depth=interval.to_depth,
                    entity_type="lithology_interval",
                    entity_id=interval.id,
                    metadata={
                        "gamma_avg": round(gamma_avg, 2) if gamma_avg is not None else None,
                        "resistivity_avg": round(resistivity_avg, 2) if resistivity_avg is not None else None,
                        "interpretation": "shale_like_curve_response",
                    },
                )
            )
    return findings


def validate_caliper_washout(borehole: Borehole, curves: list[Curve]) -> list[ValidationFinding]:
    caliper = _curve_by_keys(curves, {"cal", "caliper"})
    if caliper is None:
        return []
    samples = sorted(caliper.samples, key=lambda item: item.depth)
    if not samples:
        return []
    findings: list[ValidationFinding] = []
    in_zone = False
    start_depth = 0.0
    max_value = 0.0
    for sample in samples:
        if sample.value >= 150 and not in_zone:
            in_zone = True
            start_depth = sample.depth
            max_value = sample.value
        elif sample.value >= 150 and in_zone:
            max_value = max(max_value, sample.value)
        elif sample.value < 150 and in_zone:
            if sample.depth - start_depth >= 4:
                findings.append(
                    ValidationFinding(
                        code="caliper_washout_warning",
                        severity="info",
                        message=f"Caliper indicates possible washout from {start_depth:.1f}m to {sample.depth:.1f}m.",
                        from_depth=start_depth,
                        to_depth=sample.depth,
                        entity_type="curve",
                        metadata={"curve_key": caliper.key, "max_caliper": round(max_value, 2)},
                    )
                )
            in_zone = False
    if in_zone and borehole.total_depth - start_depth >= 4:
        findings.append(
            ValidationFinding(
                code="caliper_washout_warning",
                severity="info",
                message=f"Caliper indicates possible washout from {start_depth:.1f}m to final depth.",
                from_depth=start_depth,
                to_depth=borehole.total_depth,
                entity_type="curve",
                metadata={"curve_key": caliper.key, "max_caliper": round(max_value, 2)},
            )
        )
    return findings


def validate_core_image_depth_mapping(borehole: Borehole) -> list[ValidationFinding]:
    findings: list[ValidationFinding] = []
    for image in borehole.core_images:
        if image.from_depth is None or image.to_depth is None:
            findings.append(
                ValidationFinding(
                    code="core_image_depth_mapping_missing",
                    severity="info",
                    message=f"Core image {image.name} has no depth mapping.",
                    entity_type="core_image",
                    entity_id=str(image.id),
                    metadata={"box_number": image.box_number},
                )
            )
            continue
        if image.to_depth <= image.from_depth or image.from_depth < 0 or image.to_depth > borehole.total_depth + 0.01:
            findings.append(
                ValidationFinding(
                    code="core_image_depth_mapping_conflict",
                    severity="warning",
                    message=f"Core image {image.name} has a questionable depth range.",
                    from_depth=image.from_depth,
                    to_depth=image.to_depth,
                    entity_type="core_image",
                    entity_id=str(image.id),
                    metadata={"box_number": image.box_number},
                )
            )
    return findings


def replace_validation_issues(borehole: Borehole, findings: list[ValidationFinding]) -> None:
    borehole_id = borehole.id
    borehole.validation_issues.clear()
    for finding in findings:
        borehole.validation_issues.append(
            ValidationIssue(
                borehole_id=borehole_id,
                code=finding.code,
                severity=finding.severity,
                message=finding.message,
                from_depth=finding.from_depth,
                to_depth=finding.to_depth,
                entity_type=finding.entity_type,
                entity_id=finding.entity_id,
                status="open",
                issue_metadata=finding.metadata,
            )
        )
