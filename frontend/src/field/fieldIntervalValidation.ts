// Checks run while a site geologist fills in the field interval form, so mistakes are
// caught at the rig rather than at central review. Errors block "Sync interval";
// warnings are shown but allowed (the geologist may have a reason).

export type FieldIntervalInput = {
  fromDepth: string;
  toDepth: string;
  lithologyCode: string;
  recovery: string;
  recoveryPercent: string;
  rqd: string;
  currentDepth: string;
};

export type FieldName = keyof FieldIntervalInput;

export type FieldIntervalCheck = {
  /** Shown under the field; any error blocks sync. */
  errors: Partial<Record<FieldName, string>>;
  /** Shown under the field; sync is still allowed. */
  warnings: Partial<Record<FieldName, string>>;
  /** What still has to be filled in before sync (empty required fields). */
  missing: string[];
  canSync: boolean;
};

/** Recovery m and Recovery % may disagree by this many percentage points before warning. */
const RECOVERY_AGREEMENT_POINTS = 5;

function parse(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : "invalid";
}

export function checkFieldInterval(input: FieldIntervalInput): FieldIntervalCheck {
  const errors: FieldIntervalCheck["errors"] = {};
  const warnings: FieldIntervalCheck["warnings"] = {};
  const missing: string[] = [];

  const from = parse(input.fromDepth);
  const to = parse(input.toDepth);
  const recovery = parse(input.recovery);
  const recoveryPercent = parse(input.recoveryPercent);
  const rqd = parse(input.rqd);
  const current = parse(input.currentDepth);

  if (from === null) missing.push("From depth");
  else if (from === "invalid") errors.fromDepth = "Enter a number in metres.";
  else if (from < 0) errors.fromDepth = "Depth cannot be negative.";

  if (to === null) missing.push("To depth");
  else if (to === "invalid") errors.toDepth = "Enter a number in metres.";
  else if (typeof from === "number" && to <= from) errors.toDepth = `Must be deeper than From depth (${from} m).`;

  if (!input.lithologyCode.trim()) missing.push("Lithology code");

  const thickness = typeof from === "number" && typeof to === "number" && to > from ? to - from : null;

  if (recovery === "invalid") errors.recovery = "Enter a number in metres.";
  else if (typeof recovery === "number") {
    if (recovery < 0) errors.recovery = "Recovery cannot be negative.";
    else if (thickness !== null && recovery > thickness + 0.01) {
      errors.recovery = `Cannot exceed the interval thickness (${round(thickness)} m).`;
    }
  }

  if (recoveryPercent === "invalid") errors.recoveryPercent = "Enter a percentage.";
  else if (typeof recoveryPercent === "number" && (recoveryPercent < 0 || recoveryPercent > 100)) {
    errors.recoveryPercent = "Must be between 0 and 100.";
  }

  if (rqd === "invalid") errors.rqd = "Enter a percentage.";
  else if (typeof rqd === "number" && (rqd < 0 || rqd > 100)) errors.rqd = "Must be between 0 and 100.";

  if (current === "invalid") errors.currentDepth = "Enter a number in metres.";
  else if (typeof current === "number") {
    if (current < 0) errors.currentDepth = "Depth cannot be negative.";
    else if (typeof to === "number" && to > current) {
      warnings.toDepth = `Deeper than the current drilled depth (${current} m). Check both values.`;
    }
  }

  if (
    thickness !== null &&
    typeof recovery === "number" &&
    typeof recoveryPercent === "number" &&
    !errors.recovery &&
    !errors.recoveryPercent
  ) {
    const implied = (recovery / thickness) * 100;
    if (Math.abs(implied - recoveryPercent) > RECOVERY_AGREEMENT_POINTS) {
      warnings.recoveryPercent = `Recovery ${recovery} m over ${round(thickness)} m is ${round(implied, 1)} %, not ${recoveryPercent} %.`;
    }
  }

  return { errors, warnings, missing, canSync: missing.length === 0 && Object.keys(errors).length === 0 };
}

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
