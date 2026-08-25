from copy import deepcopy
from typing import Any


VALIDATION_SEVERITIES = {"error", "warning", "info"}


DEFAULT_VALIDATION_RULES: list[dict[str, Any]] = [
    {
        "code": "interval_outside_borehole",
        "label": "Interval outside borehole",
        "description": "Flags lithology intervals that extend outside the borehole depth range.",
        "enabled": True,
        "severity": "error",
    },
    {
        "code": "invalid_interval_depth",
        "label": "Invalid interval depth",
        "description": "Flags intervals where to-depth is less than or equal to from-depth.",
        "enabled": True,
        "severity": "error",
    },
    {
        "code": "missing_lithology_code",
        "label": "Missing lithology code",
        "description": "Flags interpreted intervals without a lithology code.",
        "enabled": True,
        "severity": "error",
    },
    {
        "code": "missing_lithology_intervals",
        "label": "Missing lithology intervals",
        "description": "Flags boreholes with no interpreted lithology intervals.",
        "enabled": True,
        "severity": "error",
    },
    {
        "code": "interval_gap",
        "label": "Interval coverage gap",
        "description": "Flags gaps between interpreted lithology intervals.",
        "enabled": True,
        "severity": "warning",
    },
    {
        "code": "interval_overlap",
        "label": "Interval overlap",
        "description": "Flags overlapping lithology intervals.",
        "enabled": True,
        "severity": "error",
    },
    {
        "code": "recovery_exceeds_interval",
        "label": "Recovery exceeds thickness",
        "description": "Flags recovery values that exceed interval thickness.",
        "enabled": True,
        "severity": "warning",
    },
    {
        "code": "invalid_rqd",
        "label": "Invalid RQD",
        "description": "Flags RQD values outside the 0-100% range.",
        "enabled": True,
        "severity": "warning",
    },
    {
        "code": "coal_interval_without_seam",
        "label": "Coal interval without seam",
        "description": "Flags coal/carbonaceous intervals that do not have a seam label.",
        "enabled": True,
        "severity": "info",
    },
    {
        "code": "curve_has_no_samples",
        "label": "Curve has no samples",
        "description": "Flags imported curves that contain no samples.",
        "enabled": True,
        "severity": "warning",
    },
    {
        "code": "curve_depth_range_mismatch",
        "label": "Curve depth coverage",
        "description": "Flags curves that do not cover the full borehole depth range.",
        "enabled": True,
        "severity": "info",
    },
    {
        "code": "missing_core_image_link",
        "label": "Missing core image link",
        "description": "Flags missing interval-to-corebox links only after corebox images are available for the borehole.",
        "enabled": True,
        "severity": "info",
    },
    {
        "code": "missing_recovery_data",
        "label": "Missing recovery data",
        "description": "Flags intervals without recovery values.",
        "enabled": True,
        "severity": "warning",
    },
    {
        "code": "missing_rqd_data",
        "label": "Missing RQD data",
        "description": "Flags intervals without RQD values.",
        "enabled": True,
        "severity": "warning",
    },
    {
        "code": "curve_lithology_disagreement",
        "label": "Curve/lithology disagreement",
        "description": "Flags intervals where curve response and logged lithology disagree.",
        "enabled": True,
        "severity": "warning",
    },
    {
        "code": "caliper_washout_warning",
        "label": "Caliper washout warning",
        "description": "Flags possible washout zones from the caliper curve.",
        "enabled": True,
        "severity": "info",
    },
    {
        "code": "core_image_depth_mapping_missing",
        "label": "Core image mapping missing",
        "description": "Flags core images without a depth range.",
        "enabled": True,
        "severity": "info",
    },
    {
        "code": "core_image_depth_mapping_conflict",
        "label": "Core image mapping conflict",
        "description": "Flags core image depth ranges that are invalid or exceed borehole depth.",
        "enabled": True,
        "severity": "warning",
    },
]


DEFAULT_QUALITY_SETTINGS: dict[str, Any] = {
    "validation": {
        "rules": DEFAULT_VALIDATION_RULES,
    },
    "ai_suggestions": {
        "enabled": True,
        "refresh_validation_before_suggestions": True,
        "group_curve_coverage": True,
        "include_info_codes": [
            "coal_interval_without_seam",
            "curve_depth_range_mismatch",
            "caliper_washout_warning",
            "core_image_depth_mapping_missing",
        ],
    },
    "ai_summary": {
        "use_local_llm_when_available": True,
        "max_rule_findings": 6,
        "max_tokens": 800,
        "temperature": 0.15,
        "geologist_approval_note": "AI and rule-based findings are decision support only; final interpretation remains with the geologist.",
        "system_prompt": (
            "You are a cautious coal geology workflow assistant. "
            "Use only the provided JSON. Do not invent geology. "
            "Write only the final answer as 4-6 concise bullets with actionable review guidance. "
            "Do not include reasoning, analysis, or preamble. "
            "Always say that the geologist must approve corrections."
        ),
        "user_prompt_template": (
            "Create actionable insights for central geologist review from this borehole JSON:\n"
            "{borehole_json}"
        ),
    },
}


def _coerce_bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    return default


def _coerce_int(value: Any, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, parsed))


def _coerce_float(value: Any, default: float, minimum: float, maximum: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, parsed))


def _validation_rules_by_code(settings: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    rules = (((settings or {}).get("validation") or {}).get("rules") or [])
    return {str(rule.get("code")): rule for rule in rules if isinstance(rule, dict) and rule.get("code")}


def normalize_quality_settings(settings: dict[str, Any] | None = None) -> dict[str, Any]:
    source = settings if isinstance(settings, dict) else {}
    normalized = deepcopy(DEFAULT_QUALITY_SETTINGS)

    configured_rules = _validation_rules_by_code(source)
    next_rules: list[dict[str, Any]] = []
    for default_rule in DEFAULT_VALIDATION_RULES:
        configured = configured_rules.get(default_rule["code"], {})
        severity = configured.get("severity", default_rule["severity"])
        if severity not in VALIDATION_SEVERITIES:
            severity = default_rule["severity"]
        next_rules.append(
            {
                **default_rule,
                "enabled": _coerce_bool(configured.get("enabled"), default_rule["enabled"]),
                "severity": severity,
            }
        )
    normalized["validation"]["rules"] = next_rules

    suggestions = source.get("ai_suggestions") if isinstance(source.get("ai_suggestions"), dict) else {}
    default_suggestions = DEFAULT_QUALITY_SETTINGS["ai_suggestions"]
    include_info_codes = suggestions.get("include_info_codes", default_suggestions["include_info_codes"])
    if not isinstance(include_info_codes, list):
        include_info_codes = default_suggestions["include_info_codes"]
    known_codes = {rule["code"] for rule in DEFAULT_VALIDATION_RULES}
    normalized["ai_suggestions"] = {
        "enabled": _coerce_bool(suggestions.get("enabled"), default_suggestions["enabled"]),
        "refresh_validation_before_suggestions": _coerce_bool(
            suggestions.get("refresh_validation_before_suggestions"),
            default_suggestions["refresh_validation_before_suggestions"],
        ),
        "group_curve_coverage": _coerce_bool(
            suggestions.get("group_curve_coverage"),
            default_suggestions["group_curve_coverage"],
        ),
        "include_info_codes": [
            str(code)
            for code in include_info_codes
            if isinstance(code, str) and code in known_codes
        ],
    }

    summary = source.get("ai_summary") if isinstance(source.get("ai_summary"), dict) else {}
    default_summary = DEFAULT_QUALITY_SETTINGS["ai_summary"]
    normalized["ai_summary"] = {
        "use_local_llm_when_available": _coerce_bool(
            summary.get("use_local_llm_when_available"),
            default_summary["use_local_llm_when_available"],
        ),
        "max_rule_findings": _coerce_int(summary.get("max_rule_findings"), default_summary["max_rule_findings"], 1, 20),
        "max_tokens": _coerce_int(summary.get("max_tokens"), default_summary["max_tokens"], 200, 2000),
        "temperature": _coerce_float(summary.get("temperature"), default_summary["temperature"], 0, 1),
        "geologist_approval_note": str(
            summary.get("geologist_approval_note") or default_summary["geologist_approval_note"]
        ),
        "system_prompt": str(summary.get("system_prompt") or default_summary["system_prompt"]),
        "user_prompt_template": str(summary.get("user_prompt_template") or default_summary["user_prompt_template"]),
    }
    return normalized


def validation_rule_lookup(settings: dict[str, Any] | None = None) -> dict[str, dict[str, Any]]:
    return _validation_rules_by_code(normalize_quality_settings(settings))


def ai_suggestion_settings(settings: dict[str, Any] | None = None) -> dict[str, Any]:
    return normalize_quality_settings(settings)["ai_suggestions"]


def ai_summary_settings(settings: dict[str, Any] | None = None) -> dict[str, Any]:
    return normalize_quality_settings(settings)["ai_summary"]
