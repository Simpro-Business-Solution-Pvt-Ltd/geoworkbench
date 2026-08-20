import type { BoreholeWorkbench } from "../../../api/types";

export function buildBoreholeMetadata(data: BoreholeWorkbench) {
  const excelImport = data.source_imports.find((item) => item.import_type === "excel");
  const metadata = (excelImport?.summary?.metadata ?? {}) as Record<string, unknown>;
  const boreholeAttributes = (data.attributes ?? {}) as Record<string, unknown>;
  const collar = (boreholeAttributes.collar ?? {}) as Record<string, unknown>;
  const sourceDepthText = Array.isArray(metadata.source_depth_text)
    ? metadata.source_depth_text
        .map((item) =>
          typeof item === "object" && item !== null && "text" in item
            ? String((item as { text?: unknown }).text ?? "")
            : "",
        )
        .filter(Boolean)
        .join(" | ")
    : "";

  return [
    { label: "Borehole", value: data.code || "-" },
    { label: "State", value: data.state || "-" },
    { label: "Block", value: String(boreholeAttributes.block ?? metadata.block ?? data.source_sheet ?? "-") },
    { label: "Coalgrid Easting", value: String(collar.coalgrid_easting ?? "-") },
    { label: "Coalgrid Northing", value: String(collar.coalgrid_northing ?? "-") },
    { label: "UTM Easting", value: String(collar.utm_easting ?? "-") },
    { label: "UTM Northing", value: String(collar.utm_northing ?? "-") },
    { label: "Reduced level", value: String(metadata.reduced_level ?? metadata.rl ?? "-") },
    { label: "Water level", value: String(metadata.water_level ?? boreholeAttributes.water_level ?? "-") },
    { label: "Total depth", value: `${data.total_depth} m` },
    { label: "Status/depth text", value: sourceDepthText || data.closure_note || "-" },
    { label: "Source workbook", value: data.source_workbook || "-" },
  ];
}

export function MetadataField({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={`field ${full ? "full" : ""}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
