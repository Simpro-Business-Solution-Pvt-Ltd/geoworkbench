import { tickStep, ticks } from "d3-array";
import { format } from "d3-format";

export type DepthTick = {
  depth: number;
  label: string;
  major: boolean;
};

function formatDepth(depth: number, step: number): string {
  const safeStep = Math.abs(step) || 1;
  const decimals = safeStep < 1 ? Math.min(3, Math.ceil(-Math.log10(safeStep))) : safeStep < 10 ? 1 : 0;
  return `${format(`.${decimals}f`)(depth)}m`;
}

export function generateDepthTicks(args: {
  fromDepth: number;
  toDepth: number;
  targetPixelSpacing: number;
  pixelsPerMeter: number;
}): DepthTick[] {
  const span = Math.max(0.001, args.toDepth - args.fromDepth);
  const targetTickCount = Math.max(2, Math.ceil((span * Math.max(0.001, args.pixelsPerMeter)) / args.targetPixelSpacing));
  const minorStep = Math.abs(tickStep(args.fromDepth, args.toDepth, targetTickCount)) || 1;
  const majorStep = minorStep * 5;
  const ticks: DepthTick[] = [];

  for (const depth of ticksForRange(args.fromDepth, args.toDepth, targetTickCount)) {
    const roundedDepth = Number(depth.toFixed(4));
    const major = Math.abs((roundedDepth / majorStep) - Math.round(roundedDepth / majorStep)) < 0.0001;
    ticks.push({
      depth: roundedDepth,
      label: formatDepth(roundedDepth, minorStep),
      major,
    });
    if (ticks.length > span * 10 + 1000) break;
  }

  return ticks;
}

function ticksForRange(fromDepth: number, toDepth: number, targetTickCount: number) {
  const values = ticks(fromDepth, toDepth, targetTickCount);
  if (values.length > 0) return values;
  return [fromDepth, toDepth];
}
