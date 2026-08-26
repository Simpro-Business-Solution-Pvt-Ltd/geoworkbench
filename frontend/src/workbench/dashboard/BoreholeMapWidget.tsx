import { MapPin } from "lucide-react";

import type { BoreholeListItem } from "../../api/types";
import { buildBoreholeMapModel, projectBoreholePoint } from "./boreholeSpatialModel";

type Props = {
  boreholes: BoreholeListItem[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onOpen: (id: number) => void;
};

const MAP_WIDTH = 420;
const MAP_HEIGHT = 210;

export function BoreholeMapWidget({ boreholes, activeId, onSelect, onOpen }: Props) {
  const model = buildBoreholeMapModel(boreholes);
  const activePoint = model.points.find((point) => point.id === activeId);

  return (
    <section className="borehole-map-widget dashboard-widget">
      <div className="borehole-map-header">
        <div>
          <strong>Borehole Map</strong>
          <span>{model.coordinateSystem ? `${model.coordinateSystem.toUpperCase()} coordinate plot` : "Coordinates pending"}</span>
        </div>
        <MapPin size={18} strokeWidth={2.1} />
      </div>
      <div className="borehole-map-stage">
        {model.bounds ? (
          <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img" aria-label="Borehole coordinate map">
            <rect className="borehole-map-bg" x="1" y="1" width={MAP_WIDTH - 2} height={MAP_HEIGHT - 2} rx="8" />
            <line className="borehole-map-axis" x1="28" y1={MAP_HEIGHT - 26} x2={MAP_WIDTH - 24} y2={MAP_HEIGHT - 26} />
            <line className="borehole-map-axis" x1="28" y1="24" x2="28" y2={MAP_HEIGHT - 26} />
            {model.points.map((point) => {
              const projected = projectBoreholePoint(point, model.bounds!, MAP_WIDTH, MAP_HEIGHT, 32);
              const selected = point.id === activeId;
              return (
                <g
                  key={point.id}
                  className={`borehole-map-point ${selected ? "selected" : ""}`}
                  transform={`translate(${projected.x} ${projected.y})`}
                  onClick={() => onSelect(point.id)}
                  onDoubleClick={() => onOpen(point.id)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Select borehole ${point.code}`}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(point.id);
                    }
                  }}
                >
                  <circle r={selected ? 8 : 6} />
                  <text x="10" y="4">{point.code}</text>
                  <title>
                    {point.code} - {point.xLabel}: {point.x.toFixed(2)}, {point.yLabel}: {point.y.toFixed(2)}
                  </title>
                </g>
              );
            })}
          </svg>
        ) : (
          <div className="borehole-map-empty">No coordinate metadata available for selected boreholes.</div>
        )}
      </div>
      <div className="borehole-map-footer">
        <span>
          {model.points.length} plotted
          {model.missing.length ? ` · ${model.missing.length} missing coordinates` : ""}
        </span>
        <strong>{activePoint ? `${activePoint.code} selected` : "Select a point"}</strong>
      </div>
    </section>
  );
}
