import { RuntimeWidgetFrame } from "./RuntimeWidgetFrame";
import { buildEvidenceCoverage } from "./evidenceCoverageModel";
import type { DisplayRuntimeProps } from "./runtimeTypes";

export function EvidenceCoverageWidget(props: DisplayRuntimeProps & { title: string }) {
  const rows = buildEvidenceCoverage(props.data);

  return (
    <RuntimeWidgetFrame title={props.title}>
      <div className="evidence-coverage">
        {rows.map((row) => (
          <article key={row.id} className={`evidence-coverage-item ${row.status}`}>
            <div>
              <strong>{row.label}</strong>
              <span>{row.detail}</span>
            </div>
            <b>{row.value}</b>
          </article>
        ))}
      </div>
    </RuntimeWidgetFrame>
  );
}
