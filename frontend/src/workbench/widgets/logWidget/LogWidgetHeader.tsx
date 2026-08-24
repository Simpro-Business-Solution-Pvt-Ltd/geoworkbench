import type { BoreholeWorkbench } from "../../../api/types";

type Props = {
  data: BoreholeWorkbench;
  visibleTracks: number;
  visibleCurves: number;
};

export function LogWidgetHeader({ data, visibleTracks, visibleCurves }: Props) {
  return (
    <div className="log-header">
      <div>
        <h1>{data.title}</h1>
        <p>
          {data.code} · {data.state ?? "Unknown state"} · {data.total_depth} m · {data.source_workbook}
        </p>
      </div>
      <span className="status-pill">
        {visibleTracks} tracks · {visibleCurves} curves
      </span>
    </div>
  );
}
