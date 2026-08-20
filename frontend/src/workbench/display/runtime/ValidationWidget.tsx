import { useWorkbenchStore } from "../workbenchStore";
import { RuntimeWidgetFrame } from "./RuntimeWidgetFrame";
import type { DisplayRuntimeProps } from "./runtimeTypes";

export function ValidationWidget(props: DisplayRuntimeProps) {
  const errors = props.data.validation_issues.filter((issue) => issue.severity === "error").length;
  const warnings = props.data.validation_issues.filter((issue) => issue.severity === "warning").length;
  const info = props.data.validation_issues.filter((issue) => issue.severity === "info").length;
  return (
    <RuntimeWidgetFrame title="Validation">
      <button
        type="button"
        className="full-width-action"
        disabled={props.validationRunning}
        onClick={props.onRunValidation}
      >
        {props.validationRunning ? "Running validation..." : "Run validation"}
      </button>
      <div className="validation-summary">
        <span>{errors} errors</span>
        <span>{warnings} warnings</span>
        <span>{info} info</span>
      </div>
      <div className="validation-list">
        {props.data.validation_issues.slice(0, 8).map((issue) => (
          <button
            key={issue.id}
            type="button"
            className={`validation-item ${issue.severity}`}
            onClick={() => {
              if (issue.from_depth !== null) {
                useWorkbenchStore.getState().setSelectedDepth(issue.from_depth);
              }
            }}
          >
            <strong>{issue.severity}</strong>
            <span>{issue.message}</span>
          </button>
        ))}
      </div>
    </RuntimeWidgetFrame>
  );
}
