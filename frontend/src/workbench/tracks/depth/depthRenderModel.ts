import type { DepthScale } from "../../core/depthScale";
import { generateDepthTicks } from "../../core/ticks";

export type DepthTickRenderModel = {
  key: string;
  depth: number;
  label: string;
  className: string;
  style: { top: string };
};

export function buildDepthTickRenderModels(
  scale: DepthScale,
  options: { targetPixelSpacing: number },
): DepthTickRenderModel[] {
  const pixelsPerMeter = scale.drawableHeight / scale.domainSpan;
  return generateDepthTicks({
    fromDepth: scale.fromDepth,
    toDepth: scale.toDepth,
    targetPixelSpacing: options.targetPixelSpacing,
    pixelsPerMeter,
  }).map((tick) => ({
    key: String(tick.depth),
    depth: tick.depth,
    label: tick.label,
    className: `depth-mark ${tick.major ? "major" : "minor"}`,
    style: { top: `${scale.depthToY(tick.depth)}px` },
  }));
}
