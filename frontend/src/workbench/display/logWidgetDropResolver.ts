import type { BoreholeWorkbench, DisplayWidget } from "../../api/types";
import type { BoreholeExplorerDragPayload } from "../explorer/boreholeExplorerModel";
import { addCurvesToLogWidget, ensureCatalogTrackOnLogWidget } from "./logWidgetConfigModel";

export type LogWidgetDropResult =
  | {
      status: "changed";
      widget: DisplayWidget;
      message: string;
    }
  | {
      status: "ignored";
      widget: DisplayWidget;
      message: string;
    };

export function resolveLogWidgetDrop(
  widget: DisplayWidget,
  payload: BoreholeExplorerDragPayload,
  data: BoreholeWorkbench,
): LogWidgetDropResult {
  if (widget.type !== "logWidget") {
    return { status: "ignored", widget, message: "Target widget is not a LogWidget." };
  }

  if (payload.kind === "curve") {
    return addCurves(widget, [payload.curveKey], data);
  }

  if (payload.kind === "curveGroup") {
    return addCurves(widget, payload.curveKeys, data);
  }

  if (payload.kind === "intervalSet") {
    return ensureTrack(widget, payload.intervalType === "seam" ? "seam" : "lithology");
  }

  if (payload.kind === "intervalField") {
    if (payload.field === "recovery_percent") {
      return ensureTrack(widget, "recovery");
    }
    if (payload.field === "rqd") {
      return ensureTrack(widget, "rqd");
    }
    if (payload.field === "remark" || payload.field === "structural_features") {
      return ensureTrack(widget, "remarks");
    }
    if (payload.field === "seam_name") {
      return ensureTrack(widget, "seam");
    }
    return { status: "ignored", widget, message: `No LogWidget track mapping exists for ${payload.field}.` };
  }

  if (payload.kind === "image" || payload.kind === "imageGroup") {
    return ensureTrack(widget, "core-images");
  }

  if (payload.kind === "qualityIssue" || payload.kind === "aiSuggestion") {
    return ensureTrack(widget, "ai-suggestions");
  }

  return { status: "ignored", widget, message: "This explorer item is available for inspection only." };
}

function addCurves(widget: DisplayWidget, curveKeys: string[], data: BoreholeWorkbench): LogWidgetDropResult {
  const curvesByKey = new Map(data.curves.map((curve) => [curve.key, curve]));
  const curves = curveKeys.map((key) => curvesByKey.get(key)).filter((curve): curve is NonNullable<typeof curve> => Boolean(curve));
  return addCurvesToLogWidget(widget, curves);
}

function ensureTrack(widget: DisplayWidget, catalogId: string): LogWidgetDropResult {
  return ensureCatalogTrackOnLogWidget(widget, catalogId);
}
