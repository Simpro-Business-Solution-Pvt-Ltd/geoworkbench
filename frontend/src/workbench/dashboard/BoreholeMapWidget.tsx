import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Layers } from "lucide-react";

import type { BoreholeListItem } from "../../api/types";
import { buildBoreholeMapModel, type BoreholeMapPoint } from "./boreholeSpatialModel";

type Props = {
  boreholes: BoreholeListItem[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onOpen: (id: number) => void;
};

type BaseMapKey = "osm" | "hot" | "imagery";

const BASE_MAPS: Record<BaseMapKey, { label: string; url: string; attribution: string; maxZoom?: number }> = {
  osm: {
    label: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  hot: {
    label: "OSM Humanitarian",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by HOT',
    maxZoom: 19,
  },
  imagery: {
    label: "World Imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    maxZoom: 19,
  },
};

export function BoreholeMapWidget({ boreholes, activeId, onSelect, onOpen }: Props) {
  const [baseMap, setBaseMap] = useState<BaseMapKey>("osm");
  const model = useMemo(() => buildBoreholeMapModel(boreholes), [boreholes]);
  const activePoint = model.points.find((point) => point.id === activeId);
  const geographicPoints = useMemo(
    () => model.points.filter((point) => point.latitude !== null && point.longitude !== null),
    [model.points],
  );
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelect);
  const onOpenRef = useRef(onOpen);

  useEffect(() => {
    onSelectRef.current = onSelect;
    onOpenRef.current = onOpen;
  }, [onOpen, onSelect]);

  useEffect(() => {
    if (!stageRef.current || !geographicPoints.length || mapRef.current) return;
    mapRef.current = L.map(stageRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    });
    markerLayerRef.current = L.layerGroup().addTo(mapRef.current);
    setTimeout(() => mapRef.current?.invalidateSize(), 0);
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      tileRef.current = null;
      markerLayerRef.current = null;
    };
  }, [geographicPoints.length]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    tileRef.current?.remove();
    const config = BASE_MAPS[baseMap];
    tileRef.current = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom ?? 19,
    }).addTo(map);
  }, [baseMap]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds: L.LatLngTuple[] = [];
    for (const point of geographicPoints) {
      const latLng: L.LatLngTuple = [point.latitude!, point.longitude!];
      bounds.push(latLng);
      const marker = L.marker(latLng, {
        icon: boreholeMarkerIcon(point.id === activeId),
        title: point.code,
        keyboard: true,
      })
        .bindPopup(popupHtml(point))
        .on("click", () => onSelectRef.current(point.id))
        .on("dblclick", () => onOpenRef.current(point.id));
      marker.addTo(layer);
    }
    if (bounds.length === 1) map.setView(bounds[0], 13);
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [22, 22], maxZoom: 14 });
    setTimeout(() => map.invalidateSize(), 0);
  }, [activeId, geographicPoints]);

  return (
    <section className="borehole-map-widget dashboard-widget">
      <div className="borehole-map-header">
        <div>
          <strong>Borehole Map</strong>
          <span>{mapSubtitle(model.coordinateSystem, geographicPoints.length)}</span>
        </div>
        <label className="borehole-basemap-select">
          <Layers size={15} strokeWidth={2.1} />
          <select value={baseMap} onChange={(event) => setBaseMap(event.target.value as BaseMapKey)}>
            {Object.entries(BASE_MAPS).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="borehole-map-stage" ref={stageRef}>
        {!geographicPoints.length && (
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

function mapSubtitle(coordinateSystem: string | null, count: number): string {
  if (!coordinateSystem || !count) return "Coordinates pending";
  if (coordinateSystem === "utm") return "Leaflet map · EPSG:32644 WGS 84 / UTM zone 44N";
  return `Leaflet map · ${coordinateSystem.toUpperCase()} coordinates`;
}

function boreholeMarkerIcon(selected: boolean) {
  return L.divIcon({
    className: `borehole-leaflet-marker ${selected ? "selected" : ""}`,
    html: `<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-5.5 7-12a7 7 0 1 0-14 0c0 6.5 7 12 7 12Z"/><circle cx="12" cy="10" r="2.6"/></svg></span>`,
    iconSize: selected ? [34, 34] : [28, 28],
    iconAnchor: selected ? [17, 33] : [14, 27],
    popupAnchor: [0, -28],
  });
}

function popupHtml(point: BoreholeMapPoint): string {
  return `
    <strong>${escapeHtml(point.code)}</strong>
    <span>${escapeHtml(point.projectCode)} / ${escapeHtml(point.siteCode)}</span>
    <span>${escapeHtml(point.xLabel)}: ${point.x.toFixed(2)}</span>
    <span>${escapeHtml(point.yLabel)}: ${point.y.toFixed(2)}</span>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
