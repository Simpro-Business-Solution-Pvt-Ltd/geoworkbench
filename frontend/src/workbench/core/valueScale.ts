export type NumericDomain = {
  min: number;
  max: number;
};

export type AffineValueScale = {
  toPercent: (value: number) => number;
  toValue: (percent: number) => number;
  min: number;
  max: number;
};

export function createValueScale({ min, max }: NumericDomain): AffineValueScale {
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) && max !== safeMin ? max : safeMin + 1;
  const span = safeMax - safeMin;
  const scale = 100 / span;
  const offset = -safeMin * scale;

  return {
    min: safeMin,
    max: safeMax,
    toPercent: (value: number) => {
      if (!Number.isFinite(value)) return 50;
      const percent = (value * scale) + offset;
      return Math.max(0, Math.min(100, percent));
    },
    toValue: (percent: number) => (Math.max(0, Math.min(100, percent)) - offset) / scale,
  };
}

export function valueToPercent(value: number, min: number, max: number) {
  return createValueScale({ min, max }).toPercent(value);
}
