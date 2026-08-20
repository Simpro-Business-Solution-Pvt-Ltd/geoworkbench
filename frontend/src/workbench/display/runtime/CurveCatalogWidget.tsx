import type { BoreholeWorkbench } from "../../../api/types";
import { curveFamilyLabel, curveMappingStatus, curveMnemonic } from "../../data/curveDictionary";
import { RuntimeWidgetFrame } from "./RuntimeWidgetFrame";

export function CurveCatalogWidget({ title, data }: { title: string; data: BoreholeWorkbench }) {
  return (
    <RuntimeWidgetFrame title={title}>
      <div className="curve-catalog">
        {data.curves.map((curve) => {
          const depths = curve.samples.map((sample) => sample.depth);
          const values = curve.samples.map((sample) => sample.value);
          const fromDepth = depths.length ? Math.min(...depths) : null;
          const toDepth = depths.length ? Math.max(...depths) : null;
          const min = values.length ? Math.min(...values) : null;
          const max = values.length ? Math.max(...values) : null;
          return (
            <article key={curve.id} className="curve-catalog-item">
              <i style={{ background: curve.color }} />
              <div>
                <strong>{curve.label}</strong>
                <span>
                  {curveMnemonic(curve)} · {curve.unit || "-"} · {curveFamilyLabel(curve)}
                </span>
                <small>
                  {fromDepth !== null && toDepth !== null
                    ? `${fromDepth.toFixed(1)}-${toDepth.toFixed(1)}m`
                    : "no coverage"}{" "}
                  · {curve.samples.length} samples · {curveMappingStatus(curve)}
                </small>
              </div>
              <b>
                {min !== null && max !== null ? `${min.toFixed(1)} / ${max.toFixed(1)}` : "-"}
              </b>
            </article>
          );
        })}
        {!data.curves.length && <div className="empty">No curves imported for this borehole.</div>}
      </div>
    </RuntimeWidgetFrame>
  );
}
