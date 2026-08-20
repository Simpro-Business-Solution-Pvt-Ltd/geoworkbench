import re
from dataclasses import dataclass


@dataclass(frozen=True)
class CurveDefinition:
    key: str
    family: str
    label: str
    unit: str
    color: str
    mnemonics: tuple[str, ...]


CURVE_DEFINITIONS: tuple[CurveDefinition, ...] = (
    CurveDefinition("gamma", "gamma-ray", "Natural Gamma", "API", "#ef4444", ("NG", "NGAM", "GR", "GAMMA", "CGR", "SGR")),
    CurveDefinition("resistivity", "resistivity", "Resistivity", "ohm.m", "#2563eb", ("RS", "RES", "RESD", "RESS", "HRD", "SPR", "16N", "64N")),
    CurveDefinition("density", "density", "Density", "g/cc", "#16a34a", ("DENS", "DEN", "RHOB", "LSD")),
    CurveDefinition("caliper", "caliper", "Caliper", "mm", "#d97706", ("CL", "CAL", "CALI", "CALP", "CALIPER")),
    CurveDefinition("sp", "spontaneous-potential", "Spontaneous Potential", "mV", "#7c3aed", ("SP",)),
    CurveDefinition("point_resistance", "point-resistance", "Point Resistance", "ohm.m", "#f97316", ("PR",)),
    CurveDefinition("bed_resolution_density", "bed-resolution-density", "Bed Resolution Density", "cps", "#22c55e", ("BD",)),
    CurveDefinition("neutron", "neutron", "Neutron", "cps", "#84cc16", ("NN",)),
    CurveDefinition("inclination", "deviation", "Inclination", "deg", "#0f766e", ("DV", "INC", "INCL", "INCLINATION")),
    CurveDefinition("azimuth", "azimuth", "Azimuth", "deg", "#0891b2", ("AZ", "AZIM", "AZI", "AZIMUTH")),
    CurveDefinition("sonic", "sonic", "Sonic", "usec", "#a855f7", ("TT", "DT", "PDEL", "SVEL")),
)

_BY_MNEMONIC = {
    mnemonic: definition
    for definition in CURVE_DEFINITIONS
    for mnemonic in definition.mnemonics
}


def curve_definition_for(mnemonic: str, description: str = "") -> CurveDefinition | None:
    code = mnemonic.upper()
    text = f"{code} {description}".upper()
    if code in {"DEPT", "DEPTH", "MD"}:
        return CurveDefinition("depth", "depth", "Depth", "m", "#94a3b8", ("DEPT", "DEPTH", "MD"))
    if definition := _BY_MNEMONIC.get(code):
        return definition
    if "GAMMA" in text:
        return _BY_MNEMONIC["GAMMA"]
    if "RESIST" in text:
        return _BY_MNEMONIC["RES"]
    if "DENS" in text:
        return _BY_MNEMONIC["DENS"]
    if code.startswith("TT"):
        return _BY_MNEMONIC["TT"]
    return None


def normalize_curve_key(mnemonic: str, description: str = "") -> str:
    definition = curve_definition_for(mnemonic, description)
    if definition is not None:
        return definition.key
    clean = re.sub(r"[^a-z0-9]+", "_", mnemonic.lower()).strip("_")
    return clean or "curve"


def curve_presentation(mnemonic: str, unit: str, description: str = "") -> tuple[str, str, str, dict]:
    definition = curve_definition_for(mnemonic, description)
    if definition is None:
        return description or mnemonic, unit, "#64748b", {
            "curve_family": "unmapped",
            "mapping_status": "unmapped",
        }
    return definition.label, unit or definition.unit, definition.color, {
        "curve_family": definition.family,
        "mapping_status": "mapped",
        "canonical_key": definition.key,
    }
