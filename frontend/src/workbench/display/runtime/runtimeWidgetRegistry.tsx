import type { ReactNode } from "react";

import type { DisplayLayout } from "../../../api/types";
import { AiWorkflowPanel } from "../../ai/AiWorkflowPanel";
import { ExportPanel } from "../../exports/ExportPanel";
import { LogWidget } from "../../widgets/logWidget/LogWidget";
import { CurveCatalogWidget } from "./CurveCatalogWidget";
import { EvidenceCoverageWidget } from "./EvidenceCoverageWidget";
import { InterpretationQueueWidget } from "./InterpretationQueueWidget";
import { IntervalDetailsWidget } from "./IntervalDetailsWidget";
import { RuntimeWidgetFrame } from "./RuntimeWidgetFrame";
import { SingleValueWidget } from "./SingleValueWidget";
import { ValidationWidget } from "./ValidationWidget";
import type { DisplayRuntimeProps } from "./runtimeTypes";

type RuntimeWidget = NonNullable<DisplayLayout["settings"]["widgets"]>[string];

type RuntimeWidgetRenderArgs = {
  widgetId: string;
  widget: RuntimeWidget;
  props: DisplayRuntimeProps;
};

type RuntimeWidgetDefinition = {
  type: string;
  label: string;
  render: (args: RuntimeWidgetRenderArgs) => ReactNode;
};

const RUNTIME_WIDGET_DEFINITIONS: RuntimeWidgetDefinition[] = [
  {
    type: "singleValue",
    label: "Single Value",
    render: ({ widget, props }) => (
      <SingleValueWidget
        title={widget.title}
        metric={widget.metric ?? "total_depth"}
        data={props.data}
        preferences={props.preferences}
      />
    ),
  },
  {
    type: "logWidget",
    label: "Log Widget",
    render: ({ widgetId, widget, props }) => <LogWidget data={props.data} widgetKey={widgetId} widget={widget} />,
  },
  {
    type: "validationPanel",
    label: "Validation",
    render: ({ props }) => <ValidationWidget {...props} />,
  },
  {
    type: "interpretationQueue",
    label: "Interpretation Queue",
    render: ({ widget, props }) => <InterpretationQueueWidget title={widget.title} {...props} />,
  },
  {
    type: "evidenceCoverage",
    label: "Evidence Coverage",
    render: ({ widget, props }) => <EvidenceCoverageWidget title={widget.title} {...props} />,
  },
  {
    type: "aiWorkflow",
    label: "AI Workflow",
    render: ({ widget, props }) => (
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
    ),
  },
  {
    type: "exportPanel",
    label: "Export Panel",
    render: ({ widget, props }) => (
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
    ),
  },
  {
    type: "curveCatalog",
    label: "Curve Catalog",
    render: ({ widget, props }) => <CurveCatalogWidget title={widget.title} data={props.data} />,
  },
  {
    type: "intervalDetails",
    label: "Interval Details",
    render: ({ widget, props }) => <IntervalDetailsWidget title={widget.title} {...props} />,
  },
];

const runtimeWidgetsByType = new Map(RUNTIME_WIDGET_DEFINITIONS.map((definition) => [definition.type, definition]));

export function getRuntimeWidgetDefinition(type: string) {
  return runtimeWidgetsByType.get(type) ?? null;
}

export function renderRuntimeWidget(widgetId: string, widget: RuntimeWidget, props: DisplayRuntimeProps) {
  const definition = getRuntimeWidgetDefinition(widget.type);
  if (definition) {
    return definition.render({ widgetId, widget, props });
  }
  return (
    <RuntimeWidgetFrame title={widget.title}>
      <div className="empty">No runtime renderer is registered for {widget.type}.</div>
    </RuntimeWidgetFrame>
  );
}
