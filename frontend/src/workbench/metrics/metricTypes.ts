export type BoreholeMetric = {
  key: string;
  label: string;
  value: string;
  rawValue: unknown;
  unit?: string;
  category: "identity" | "collar" | "interval" | "curve" | "quality" | "ai";
  source: "excel" | "las" | "mobile" | "derived" | "rules" | "ai" | "unknown";
  confidence?: number;
};
