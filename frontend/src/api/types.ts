export type BoreholeListItem = {
  id: number;
  code: string;
  title: string;
  total_depth: number;
  workflow_status: string;
  site_code: string;
  project_code: string;
};

export type User = {
  id: number;
  username: string;
  display_name: string;
  role: string;
  email: string | null;
  auth_provider: string;
  mobile_number: string | null;
  is_active: number;
  failed_login_count: number;
  locked_until: string | null;
  last_login_at: string | null;
  preferences: Record<string, unknown> | null;
};

export type Role = {
  key: string;
  label: string;
  description: string | null;
  is_system: number;
  is_active: number;
};

export type Permission = {
  key: string;
  label: string;
  description: string;
  category: string;
};

export type RoleAccess = {
  role_key: string;
  permissions: string[];
};

export type AuthToken = {
  token: string;
  user: User;
  expires_at: string;
};

export type AuthSession = {
  user: User;
  expires_at: string;
  client_type: string;
};

export type DiagnosticsHealth = {
  status: string;
  service: string;
  checked_at: string;
  database: { status: string; detail: string };
  ai: { provider: string; model: string };
  uploads: string;
  exports: string;
  observability: {
    request_timing_header: string;
    otel_ready: boolean;
  };
};

export type BoreholeStatus = {
  id: number;
  code: string;
  workflow_status: string;
  message: string;
};

export type LithologyInterval = {
  id: string;
  source_row: number | null;
  from_depth: number;
  to_depth: number;
  lithology_code: string | null;
  lithology_label: string;
  display_color: string | null;
  logged_color: string | null;
  seam_name: string | null;
  recovery: number | null;
  recovery_percent: number | null;
  rqd: number | null;
  structural_features: string | null;
  remark: string | null;
  image_box: number | null;
  image_file: string | null;
  attributes?: Record<string, unknown> | null;
};

export type SeamInterval = {
  id: string;
  name: string;
  from_depth: number;
  to_depth: number;
  thickness: number | null;
  lithology_code: string | null;
  lithology_label: string | null;
  image_box: number | null;
  attributes?: Record<string, unknown> | null;
};

export type CurveSample = {
  depth: number;
  value: number;
};

export type Curve = {
  id: number;
  key: string;
  label: string;
  unit: string;
  source_type: string;
  color: string;
  curve_metadata?: Record<string, unknown> | null;
  samples: CurveSample[];
};

export type CoreImage = {
  box_number: number;
  name: string;
  file_path: string;
  from_depth: number | null;
  to_depth: number | null;
  url: string;
  original_url: string;
  strip_url: string | null;
  strip_preview_url?: string | null;
  strip_metadata?: Record<string, unknown> | null;
  image_metadata?: Record<string, unknown> | null;
};

export type DisplayLayout = {
  id: number;
  name: string;
  mode: string;
  settings: {
    schemaVersion?: number;
    mode?: string;
    regions?: Record<string, string[]>;
    grid?: DisplayGrid;
    widgets?: Record<string, DisplayWidget>;
  };
};

export type DisplayGrid = {
  columns: number;
  rowHeight: number;
  items: DisplayGridItem[];
};

export type DisplayGridItem = {
  widgetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type DisplayWidget = {
  type: string;
  title: string;
  tracks?: DisplayTrack[];
  metric?: "total_depth" | "interval_count" | "curve_count" | "corebox_count" | string;
  sourceWidgetId?: string;
  settings?: Record<string, unknown>;
};

export type DisplayTrack = {
  id: string;
  type: string;
  title: string;
  visible: boolean;
  width: number;
  header?: {
    visible?: boolean;
    showTitle?: boolean;
    height?: number;
  };
  interaction?: {
    tooltipEnabled?: boolean;
    contextMenuEnabled?: boolean;
    selectable?: boolean;
  };
  renderer?: Record<string, unknown>;
  curves?: Array<{
    curveKey: string;
    label: string;
    unit: string;
    color: string;
    visible: boolean;
    tooltipEnabled?: boolean;
    lineStyle?: "solid" | "dashed" | "dotted" | string;
    scale: { mode: string; min: number; max: number };
  }>;
  valueField?: "recovery_percent" | "rqd";
  unit?: string;
  min?: number;
  max?: number;
  valueMultiplier?: number;
  color?: string;
};

export type ValidationIssue = {
  id: number;
  code: string;
  severity: "error" | "warning" | "info" | string;
  message: string;
  from_depth: number | null;
  to_depth: number | null;
  entity_type: string | null;
  entity_id: string | null;
  status: string;
  issue_metadata: Record<string, unknown> | null;
};

export type AiSuggestion = {
  id: number;
  validation_issue_id: number | null;
  suggestion_type: string;
  title: string;
  rationale: string;
  recommended_action: string;
  confidence: number | null;
  status: string;
  provider: string;
  from_depth: number | null;
  to_depth: number | null;
  entity_type: string | null;
  entity_id: string | null;
  patch: Record<string, unknown> | null;
  evidence: Record<string, unknown> | null;
};

export type BoreholeAiSummary = {
  borehole_id: number;
  title: string;
  summary: string;
  metrics: Record<string, unknown>;
};

export type ValidationRuleConfig = {
  code: string;
  label: string;
  description: string;
  enabled: boolean;
  severity: "error" | "warning" | "info" | string;
};

export type QualitySettingsPayload = {
  validation: {
    rules: ValidationRuleConfig[];
  };
  ai_suggestions: {
    enabled: boolean;
    refresh_validation_before_suggestions: boolean;
    group_curve_coverage: boolean;
    include_info_codes: string[];
  };
  ai_summary: {
    use_local_llm_when_available: boolean;
    max_rule_findings: number;
    max_tokens: number;
    temperature: number;
    geologist_approval_note: string;
    system_prompt: string;
    user_prompt_template: string;
  };
};

export type QualitySettings = {
  key: string;
  settings: QualitySettingsPayload;
  updated_at: string | null;
};

export type SourceImport = {
  id: number;
  import_type: string;
  source_name: string;
  status: string;
  summary: Record<string, unknown> | null;
};

export type FieldSubmission = {
  id: number;
  submission_type: string;
  status: string;
  submitted_by: string | null;
  payload: Record<string, unknown> | null;
};

export type SourceFile = {
  id: number;
  borehole_id: number | null;
  source_import_id: number | null;
  file_type: string;
  original_name: string;
  storage_path: string;
  status: string;
  file_metadata: Record<string, unknown> | null;
};

export type ImportProfile = {
  id: number;
  name: string;
  profile_type: string;
  description: string | null;
  mapping: Record<string, unknown>;
};

export type ExportReadiness = {
  borehole_id: number;
  ready: boolean;
  status: string;
  checks: Array<{
    key: string;
    label: string;
    status: "pass" | "warning" | "fail" | string;
    detail: string;
  }>;
  counts: Record<string, number>;
};

export type ExportJob = {
  id: number;
  borehole_id: number;
  export_type: string;
  status: string;
  file_path: string;
  file_name: string;
  summary: Record<string, unknown> | null;
};

export type ExportProfile = {
  id: number;
  name: string;
  export_type: string;
  description: string | null;
  mapping: Record<string, unknown>;
};

export type BoreholeWorkbench = {
  id: number;
  code: string;
  title: string;
  state: string | null;
  total_depth: number;
  closure_note: string | null;
  source_workbook: string | null;
  source_sheet: string | null;
  workflow_status: string;
  attributes?: Record<string, unknown> | null;
  lithology_intervals: LithologyInterval[];
  seam_intervals: SeamInterval[];
  curves: Curve[];
  core_images: CoreImage[];
  layout: DisplayLayout | null;
  display_layouts?: DisplayLayout[];
  validation_issues: ValidationIssue[];
  ai_suggestions: AiSuggestion[];
  source_imports: SourceImport[];
  field_submissions: FieldSubmission[];
  source_files: SourceFile[];
};
