import type {
  BoreholeListItem,
  BoreholeAiSummary,
  BoreholeWorkbench,
  BoreholeStatus,
  CurveSampleWindow,
  DisplayLayout,
  ExportJob,
  ExportProfile,
  CorrelationObservation,
  ExportReadiness,
  ImportProfile,
  LithologyInterval,
  Permission,
  QualitySettings,
  QualitySettingsPayload,
  Role,
  RoleAccess,
  SourceFile,
  ValidationIssue,
  AiSuggestion,
  AuthSession,
  AuthToken,
  DiagnosticsHealth,
  User,
} from "./types";

const API_BASE = "/api";
const TOKEN_KEY = "geoworkbench.auth.token";

export function getAuthToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    ...init,
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export function login(username: string, password: string): Promise<AuthToken> {
  return request<AuthToken>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function startEntraLogin(): void {
  window.location.assign(`${API_BASE}/auth/entra/login`);
}

export function getCurrentSession(): Promise<AuthSession> {
  return request<AuthSession>("/auth/me");
}

export function logout(): Promise<{ status: string }> {
  return request<{ status: string }>("/auth/logout", { method: "POST" });
}

export function getDiagnosticsHealth(): Promise<DiagnosticsHealth> {
  return request<DiagnosticsHealth>("/diagnostics/health");
}

export function listRoles(): Promise<Role[]> {
  return request<Role[]>("/auth/roles");
}

export function createRole(payload: {
  key: string;
  label: string;
  description?: string | null;
  is_active?: number;
}): Promise<Role> {
  return request<Role>("/auth/roles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateRole(roleKey: string, payload: Partial<Role>): Promise<Role> {
  return request<Role>(`/auth/roles/${roleKey}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function listPermissions(): Promise<Permission[]> {
  return request<Permission[]>("/auth/permissions");
}

export function getRoleAccess(roleKey: string): Promise<RoleAccess> {
  return request<RoleAccess>(`/auth/roles/${roleKey}/access`);
}

export function updateRoleAccess(roleKey: string, permissions: string[]): Promise<RoleAccess> {
  return request<RoleAccess>(`/auth/roles/${roleKey}/access`, {
    method: "PUT",
    body: JSON.stringify({ permissions }),
  });
}

export function listUsers(): Promise<User[]> {
  return request<User[]>("/auth/users");
}

export function createUser(payload: {
  username: string;
  display_name: string;
  role: string;
  password: string;
  email?: string | null;
  mobile_number?: string | null;
  is_active?: number;
}): Promise<User> {
  return request<User>("/auth/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateUser(userId: number, payload: Partial<User>): Promise<User> {
  return request<User>(`/auth/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deactivateUser(userId: number): Promise<User> {
  return request<User>(`/auth/users/${userId}`, { method: "DELETE" });
}

export function resetUserPassword(userId: number, newPassword: string): Promise<User> {
  return request<User>(`/auth/users/${userId}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ new_password: newPassword }),
  });
}

export function updateCurrentUserPreferences(preferences: object): Promise<User> {
  return request<User>("/auth/me/preferences", {
    method: "PATCH",
    body: JSON.stringify({ preferences }),
  });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<{ status: string }> {
  return request<{ status: string }>("/auth/password/change", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export function listBoreholes(): Promise<BoreholeListItem[]> {
  return request<BoreholeListItem[]>("/boreholes");
}

export function getWorkbench(boreholeId: number, displayLayoutId?: number | null): Promise<BoreholeWorkbench> {
  const query = displayLayoutId ? `?display_layout_id=${displayLayoutId}` : "";
  return request<BoreholeWorkbench>(`/boreholes/${boreholeId}/workbench${query}`);
}

export function getCurveSampleWindow(
  boreholeId: number,
  curveKey: string,
  fromDepth: number,
  toDepth: number,
  maxSamples?: number | null,
): Promise<CurveSampleWindow> {
  const params = new URLSearchParams({
    from_depth: String(fromDepth),
    to_depth: String(toDepth),
  });
  if (maxSamples !== undefined && maxSamples !== null) {
    params.set("max_samples", String(maxSamples));
  }
  return request<CurveSampleWindow>(
    `/boreholes/${boreholeId}/curves/${encodeURIComponent(curveKey)}/samples?${params.toString()}`,
  );
}

export function updateInterval(
  intervalId: string,
  patch: Partial<LithologyInterval>,
): Promise<LithologyInterval> {
  return request<LithologyInterval>(`/boreholes/intervals/${intervalId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function listImportProfiles(): Promise<ImportProfile[]> {
  return request<ImportProfile[]>("/imports/profiles");
}

export function updateImportProfile(
  profileId: number,
  payload: Partial<Pick<ImportProfile, "name" | "description" | "mapping">>,
): Promise<ImportProfile> {
  return request<ImportProfile>(`/imports/profiles/${profileId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function runValidation(boreholeId: number): Promise<ValidationIssue[]> {
  return request<ValidationIssue[]>(`/validation/boreholes/${boreholeId}/run`, {
    method: "POST",
  });
}

export function generateAiSuggestions(boreholeId: number): Promise<AiSuggestion[]> {
  return request<AiSuggestion[]>(`/ai/boreholes/${boreholeId}/suggestions/generate`, {
    method: "POST",
  });
}

export function acceptAiSuggestion(suggestionId: number): Promise<AiSuggestion> {
  return request<AiSuggestion>(`/ai/suggestions/${suggestionId}/accept`, { method: "POST" });
}

export function updateAiSuggestionStatus(
  suggestionId: number,
  status: "open" | "accepted" | "rejected",
): Promise<AiSuggestion> {
  return request<AiSuggestion>(`/ai/suggestions/${suggestionId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function getBoreholeAiSummary(boreholeId: number): Promise<BoreholeAiSummary> {
  return request<BoreholeAiSummary>(`/ai/boreholes/${boreholeId}/summary`);
}

export function getAiProviderStatus(): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>("/ai/provider-status");
}

export function getQualitySettings(): Promise<QualitySettings> {
  return request<QualitySettings>("/quality-settings/default");
}

export function updateQualitySettings(settings: QualitySettingsPayload): Promise<QualitySettings> {
  return request<QualitySettings>("/quality-settings/default", {
    method: "PUT",
    body: JSON.stringify({ settings }),
  });
}

export function resetQualitySettings(): Promise<QualitySettings> {
  return request<QualitySettings>("/quality-settings/default/reset", { method: "POST" });
}

export function createSourceFile(payload: {
  borehole_id: number | null;
  file_type: string;
  original_name: string;
  storage_path: string;
  file_metadata?: Record<string, unknown> | null;
}): Promise<SourceFile> {
  return request<SourceFile>("/imports/source-files", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function uploadSourceFile(payload: {
  borehole_id: number | null;
  file_type: string;
  file: File;
}): Promise<SourceFile> {
  const form = new FormData();
  form.append("file", payload.file);
  form.append("file_type", payload.file_type);
  if (payload.borehole_id !== null) {
    form.append("borehole_id", String(payload.borehole_id));
  }
  const token = getAuthToken();
  const response = await fetch(`${API_BASE}/imports/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<SourceFile>;
}

export function processSourceFile(sourceFileId: number): Promise<{
  source_file: SourceFile;
  source_import_id: number;
  summary: Record<string, unknown>;
}> {
  return request(`/imports/source-files/${sourceFileId}/process`, { method: "POST" });
}

export function updateDisplayLayout(
  layoutId: number,
  patch: Partial<DisplayLayout>,
): Promise<DisplayLayout> {
  return request<DisplayLayout>(`/boreholes/display-layouts/${layoutId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function cloneDisplayLayout(layoutId: number, name?: string): Promise<DisplayLayout> {
  return request<DisplayLayout>(`/boreholes/display-layouts/${layoutId}/clone`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function deleteDisplayLayout(layoutId: number): Promise<DisplayLayout> {
  return request<DisplayLayout>(`/boreholes/display-layouts/${layoutId}`, {
    method: "DELETE",
  });
}

export function resetDisplayLayout(boreholeId: number): Promise<DisplayLayout> {
  return request<DisplayLayout>(`/boreholes/${boreholeId}/display-layout/reset`, {
    method: "POST",
  });
}

export function approveBoreholeForExport(boreholeId: number): Promise<BoreholeStatus> {
  return request<BoreholeStatus>(`/boreholes/${boreholeId}/approve-export`, {
    method: "POST",
  });
}

export function importSourceFileAsBorehole(sourceFileId: number): Promise<{
  source_file: SourceFile;
  borehole_id: number;
  borehole_code: string;
  summary: Record<string, unknown>;
}> {
  return request(`/imports/source-files/${sourceFileId}/import-borehole`, { method: "POST" });
}

export function mergeSourceFileIntoBorehole(
  sourceFileId: number,
  options?: {
    interval_mode?: string;
    curve_mode?: string;
    from_depth?: number | null;
    to_depth?: number | null;
  },
): Promise<{
  source_file: SourceFile;
  borehole_id: number;
  status: string;
  summary: Record<string, unknown>;
}> {
  return request(`/imports/source-files/${sourceFileId}/merge`, {
    method: "POST",
    body: JSON.stringify(options ?? {}),
  });
}

export function getExportReadiness(boreholeId: number): Promise<ExportReadiness> {
  return request<ExportReadiness>(`/exports/boreholes/${boreholeId}/readiness`);
}

export function listExportProfiles(): Promise<ExportProfile[]> {
  return request<ExportProfile[]>("/exports/profiles");
}

export function updateExportProfile(
  profileId: number,
  payload: Partial<Pick<ExportProfile, "name" | "description" | "mapping">>,
): Promise<ExportProfile> {
  return request<ExportProfile>(`/exports/profiles/${profileId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function listExportJobs(boreholeId: number): Promise<ExportJob[]> {
  return request<ExportJob[]>(`/exports/boreholes/${boreholeId}/jobs`);
}

export function createExportJob(
  boreholeId: number,
  payload:
    | string
    | {
        export_type: string;
        export_profile_id?: number | null;
        stage?: string | null;
        from_depth?: number | null;
        to_depth?: number | null;
        sections?: string[] | null;
      },
): Promise<ExportJob> {
  const body =
    typeof payload === "string"
      ? { export_type: payload }
      : payload;
  return request<ExportJob>(`/exports/boreholes/${boreholeId}/jobs`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function exportDownloadUrl(exportJobId: number): string {
  return `${API_BASE}/exports/jobs/${exportJobId}/download`;
}

export function listCorrelationObservations(boreholeIds: number[]): Promise<CorrelationObservation[]> {
  const ids = boreholeIds.slice().sort((a, b) => a - b).join(",");
  return request<CorrelationObservation[]>(`/correlation/observations?borehole_ids=${encodeURIComponent(ids)}`);
}

export function createCorrelationObservation(payload: {
  borehole_ids: number[];
  text: string;
  observation_metadata?: Record<string, unknown> | null;
}): Promise<CorrelationObservation> {
  return request<CorrelationObservation>("/correlation/observations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
