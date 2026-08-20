import { useMemo } from "react";

import type {
  BoreholeWorkbench,
  DisplayLayout,
} from "../../api/types";
import { AiWorkflowPanel } from "../ai/AiWorkflowPanel";
import { ExportPanel } from "../exports/ExportPanel";
import { LogWidget } from "../widgets/LogWidget";
import { normalizeDisplayLayout } from "./displayEditorModel";
import { CurveCatalogWidget } from "./runtime/CurveCatalogWidget";
import { IntervalDetailsWidget } from "./runtime/IntervalDetailsWidget";
import { RuntimeWidgetFrame } from "./runtime/RuntimeWidgetFrame";
import { SingleValueWidget } from "./runtime/SingleValueWidget";
import { ValidationWidget } from "./runtime/ValidationWidget";
import type { DisplayRuntimeProps } from "./runtime/runtimeTypes";

export function DisplayRuntime(props: DisplayRuntimeProps) {
  const layout = useMemo(
    () => (props.data.layout ? normalizeDisplayLayout(props.data.layout as DisplayLayout, props.data.curves) : null),
    [props.data.curves, props.data.layout],
  );
  const grid = layout?.settings.grid;
  const widgets = layout?.settings.widgets ?? {};

  if (!grid) {
    return <div className="empty">No display grid is configured.</div>;
  }

  return (
    <section className="runtime-display">
      <div
        className="runtime-grid"
        style={{
          gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`,
          gridAutoRows: `${grid.rowHeight}px`,
        }}
      >
        {grid.items.map((item) => {
          const widget = widgets[item.widgetId];
          if (!widget) return null;
          return (
            <section
              key={item.widgetId}
              className={`runtime-widget runtime-widget-${widget.type}`}
              style={{
                gridColumn: `${item.x + 1} / span ${item.w}`,
                gridRow: `${item.y + 1} / span ${item.h}`,
              }}
            >
              {renderWidget(item.widgetId, widget, props)}
            </section>
          );
        })}
      </div>
    </section>
  );
}

function renderWidget(
  widgetId: string,
  widget: NonNullable<DisplayLayout["settings"]["widgets"]>[string],
  props: DisplayRuntimeProps,
) {
  if (widget.type === "singleValue") {
    return (
      <SingleValueWidget
        title={widget.title}
        metric={widget.metric ?? "total_depth"}
        data={props.data}
        preferences={props.preferences}
      />
    );
  }
  if (widget.type === "logWidget") {
    return <LogWidget data={withRuntimeLogWidget(props.data, widgetId, widget)} />;
  }
  if (widget.type === "validationPanel") {
    return <ValidationWidget {...props} />;
  }
  if (widget.type === "aiWorkflow") {
    return (
      <RuntimeWidgetFrame title={widget.title}>
        <AiWorkflowPanel
          summary={props.aiSummary}
          provider={props.aiProvider}
          suggestions={props.data.ai_suggestions}
          generating={props.aiGenerating}
          acting={props.aiActing}
          onGenerate={props.onGenerateAi}
          onAccept={props.onAcceptSuggestion}
          onReject={props.onRejectSuggestion}
        />
      </RuntimeWidgetFrame>
    );
  }
  if (widget.type === "exportPanel") {
    return (
      <RuntimeWidgetFrame title={widget.title}>
        <ExportPanel
          data={props.data}
          readiness={props.exportReadiness}
          jobs={props.exportJobs}
          creating={props.exportCreating}
          approving={props.exportApproving}
          onCreate={props.onCreateExport}
          onApprove={props.onApproveExport}
        />
      </RuntimeWidgetFrame>
    );
  }
  if (widget.type === "curveCatalog") {
    return <CurveCatalogWidget title={widget.title} data={props.data} />;
  }
  if (widget.type === "intervalDetails") {
    return <IntervalDetailsWidget title={widget.title} {...props} />;
  }
  return (
    <RuntimeWidgetFrame title={widget.title}>
      <div className="empty">No runtime renderer is registered for {widget.type}.</div>
    </RuntimeWidgetFrame>
  );
}

function withRuntimeLogWidget(
  data: BoreholeWorkbench,
  widgetId: string,
  widget: NonNullable<DisplayLayout["settings"]["widgets"]>[string],
): BoreholeWorkbench {
  if (widgetId === "log-widget") return data;
  if (!data.layout) return data;
  const layout = structuredClone(data.layout);
  layout.settings.widgets = { ...(layout.settings.widgets ?? {}), "log-widget": widget };
  return { ...data, layout };
}
