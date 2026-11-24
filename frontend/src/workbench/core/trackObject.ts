import type { AiSuggestion, CoreImage, Curve, CurveSample, LithologyInterval, SeamInterval } from "../../api/types";

export type TrackObjectKind =
  | "depth"
  | "lithology-interval"
  | "seam-interval"
  | "curve-sample"
  | "core-image"
  | "remark-group"
  | "ai-suggestion-group"
  | "empty";

export type TrackObject =
  | {
      kind: "lithology-interval";
      id: string;
      depth: number;
      interval: LithologyInterval;
    }
  | {
      kind: "seam-interval";
      id: string;
      depth: number;
      seam: SeamInterval;
    }
  | {
      kind: "curve-sample";
      id: string;
      depth: number;
      curve: Curve;
      sample: CurveSample;
      distance: number;
      screenXPercent: number;
      screenYPercent: number;
      relatedSamples?: Array<{
        curve: Curve;
        sample: CurveSample;
        distance: number;
        screenXPercent: number;
      }>;
    }
  | {
      kind: "core-image";
      id: string;
      depth: number;
      image: CoreImage;
    }
  | {
      kind: "remark-group";
      id: string;
      depth: number;
      label?: string;
      remarks: Array<{ depth: number; text: string; sourceRow: number | null }>;
    }
  | {
      kind: "ai-suggestion-group";
      id: string;
      depth: number;
      label?: string;
      suggestions: AiSuggestion[];
    }
  | {
      kind: "depth" | "empty";
      id: string;
      depth: number;
      label?: string;
      data?: unknown;
    };

export type TrackPointerEventType = "hover" | "click" | "contextmenu" | "dragstart" | "drag" | "dragend";

export type TrackPointerEvent = {
  type: TrackPointerEventType;
  trackId: string;
  trackType: string;
  depth: number;
  localX: number;
  localY: number;
  object: TrackObject;
  nativeEvent: React.MouseEvent | React.PointerEvent;
};

export function emptyTrackObject(depth: number): TrackObject {
  return { kind: "empty", id: `empty:${depth.toFixed(2)}`, depth };
}
