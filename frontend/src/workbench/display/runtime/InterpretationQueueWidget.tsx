import type { AiSuggestion } from "../../../api/types";
import { useWorkbenchStore } from "../workbenchStore";
import { RuntimeWidgetFrame } from "./RuntimeWidgetFrame";
import { buildInterpretationQueue, type InterpretationQueueItem } from "./interpretationQueueModel";
import type { DisplayRuntimeProps } from "./runtimeTypes";

export function InterpretationQueueWidget(props: DisplayRuntimeProps & { title: string }) {
  const queue = buildInterpretationQueue(props.data);

  const handleAction = (item: InterpretationQueueItem) => {
    if (item.action === "run-validation") {
      props.onRunValidation();
      return;
    }
    if (item.action === "generate-ai") {
      props.onGenerateAi();
      return;
    }
    if (item.depth !== null) {
      useWorkbenchStore.getState().setSelectedDepth(item.depth);
    }
    if (item.suggestionId) {
      const suggestion = props.data.ai_suggestions.find((candidate) => candidate.id === item.suggestionId);
      useWorkbenchStore.getState().setSelectedAiSuggestion((suggestion as AiSuggestion | undefined) ?? null);
    }
  };

  return (
    <RuntimeWidgetFrame title={props.title}>
      <div className="interpretation-queue">
        <div className="interpretation-queue-summary">
          <span>{queue.filter((item) => item.priority === "critical").length} critical</span>
          <span>{queue.filter((item) => item.priority === "review").length} review</span>
          <span>{queue.filter((item) => item.priority === "watch").length} watch</span>
        </div>
        <div className="interpretation-queue-list">
          {queue.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`interpretation-queue-item ${item.priority}`}
              onClick={() => handleAction(item)}
            >
              <span className="interpretation-queue-kicker">
                {item.priority} · {item.source}
              </span>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
              <small>{item.evidence}</small>
            </button>
          ))}
        </div>
      </div>
    </RuntimeWidgetFrame>
  );
}
