import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BookOpenText,
  Building2,
  Download,
  GitCompareArrows,
  Globe2,
  LayoutDashboard,
  PanelTop,
  Settings,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  approveBoreholeForExport,
  changePassword,
  cloneDisplayLayout,
  createRole,
  createSourceFile,
  createExportJob,
  createUser,
  deactivateUser,
  deleteDisplayLayout,
  acceptAiSuggestion,
  getExportReadiness,
  generateAiSuggestions,
  getWorkbench,
  getBoreholeAiSummary,
  getAiProviderStatus,
  getCurrentSession,
  getDiagnosticsHealth,
  getQualitySettings,
  getRoleAccess,
  importSourceFileAsBorehole,
  listPermissions,
  listRoles,
  mergeSourceFileIntoBorehole,
  listBoreholes,
  listExportJobs,
  listExportProfiles,
  listImportProfiles,
  listUsers,
  processSourceFile,
  resetQualitySettings,
  resetUserPassword,
  runValidation,
  login,
  logout,
  setAuthToken,
  startEntraLogin,
  uploadSourceFile,
  resetDisplayLayout,
  updateDisplayLayout,
  updateExportProfile,
  updateImportProfile,
  updateCurrentUserPreferences,
  updateAiSuggestionStatus,
  updateInterval,
  updateQualitySettings,
  updateRole,
  updateRoleAccess,
  updateUser,
} from "./api/client";
import type {
  AuthSession,
  BoreholeListItem,
  DisplayLayout,
  LithologyInterval,
  Permission,
  QualitySettings,
  QualitySettingsPayload,
  Role,
  User,
} from "./api/types";
import { CorrelationWorkspace } from "./workbench/correlation/CorrelationWorkspace";
import { DisplayEditorDialog } from "./workbench/display/DisplayEditorDialog";
import { DisplayRuntime } from "./workbench/display/DisplayRuntime";
import { useWorkbenchStore } from "./workbench/display/workbenchStore";
import { ExportCenter } from "./workbench/exports/ExportCenter";
import { ImportCenter } from "./workbench/imports/ImportCenter";
import {
  DEFAULT_USER_PREFERENCES,
  formatDateTimeWithPreferences,
  normalizeUserPreferences,
  type UserPreferences,
} from "./preferences/userPreferences";
import { PreferencesSettingsPanel } from "./settings/PreferencesSettingsPanel";
import { useWorkbenchRealtime } from "./realtime/useWorkbenchRealtime";

const WIKI_MARKDOWN = {
  ...import.meta.glob("../../docs/wiki/**/*.md", { query: "?raw", import: "default", eager: true }),
  ...import.meta.glob("../../docs/import-export-template-user-manual.md", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  ...import.meta.glob("../../docs/stakeholder-value-discussion-guide.md", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  ...import.meta.glob("../../docs/demo-script-coal-borehole-workflow.md", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  ...import.meta.glob("../../docs/ai-assisted-coal-geology-use-cases.md", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
} as Record<string, string>;

const WIKI_PAGES = [
  { key: "../../docs/wiki/user-manual/reliance-uat-story-and-demo-script.md", title: "Reliance UAT Story", group: "User Guidance", audience: "user" },
  { key: "../../docs/wiki/user-manual/uat-interpretation-platform-plan.md", title: "UAT Interpretation Plan", group: "User Guidance", audience: "user" },
  { key: "../../docs/wiki/uat-demo-readiness.md", title: "UAT Demo Readiness", group: "User Guidance", audience: "user" },
  { key: "../../docs/import-export-template-user-manual.md", title: "Import, Merge, And Export", group: "User Guidance", audience: "user" },
  { key: "../../docs/wiki/user-manual/borehole-workbench.md", title: "Workbench User Manual", group: "User Guidance", audience: "user" },
  { key: "../../docs/stakeholder-value-discussion-guide.md", title: "Business Value Discussion", group: "Business Value", audience: "user" },
  { key: "../../docs/demo-script-coal-borehole-workflow.md", title: "Demo Workflow Script", group: "Business Value", audience: "user" },
  { key: "../../docs/ai-assisted-coal-geology-use-cases.md", title: "AI Use Cases", group: "Business Value", audience: "user" },
  { key: "../../docs/wiki/architecture/system-workflows.md", title: "System Workflows", group: "Developer", audience: "developer" },
  { key: "../../docs/wiki/architecture/backend-architecture.md", title: "Backend Architecture", group: "Developer", audience: "developer" },
  { key: "../../docs/wiki/architecture/frontend-architecture.md", title: "Frontend Architecture", group: "Developer", audience: "developer" },
  { key: "../../docs/wiki/architecture/workbench-interaction-architecture.md", title: "Workbench Interactions", group: "Developer", audience: "developer" },
  { key: "../../docs/wiki/architecture/geophysical-pdf-import.md", title: "Geophysical PDF Import", group: "Developer", audience: "developer" },
  { key: "../../docs/wiki/architecture/refinement-guide.md", title: "Refinement Guide", group: "Developer", audience: "developer" },
  { key: "../../docs/wiki/deployment/production-overview.md", title: "Production Overview", group: "Deployment", audience: "developer" },
  { key: "../../docs/wiki/deployment/windows-iis.md", title: "Windows IIS", group: "Deployment", audience: "developer" },
  { key: "../../docs/wiki/deployment/linux-nginx.md", title: "Linux Nginx", group: "Deployment", audience: "developer" },
  { key: "../../docs/wiki/deployment/local-postgres.md", title: "Local PostgreSQL", group: "Deployment", audience: "developer" },
].filter((page) => Boolean(WIKI_MARKDOWN[page.key]));

type AppView = "landing" | "workbench" | "correlation" | "import" | "export" | "settings" | "displayEditor" | "wiki";
type SettingsTab = "users" | "roles" | "access" | "quality" | "preferences";
type DisplayChoice = "saved" | "default";

type PersistedUserSettings = {
  selectedBoreholeId: number | null;
  selectedDisplayLayoutIds: Record<string, number | null>;
  displayChoice: DisplayChoice;
  preferences: UserPreferences;
};

const USER_SETTINGS_KEY = "geoworkbench.userSettings.v1";
const USER_SETTINGS_DEFAULT: PersistedUserSettings = {
  selectedBoreholeId: null,
  selectedDisplayLayoutIds: {},
  displayChoice: "saved",
  preferences: DEFAULT_USER_PREFERENCES,
};

const getUserSettingsCache = () => {
  const raw = window.localStorage.getItem(USER_SETTINGS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, PersistedUserSettings>;
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed;
  } catch {
    return {};
  }
};

const persistUserSettings = (userId: number, settings: Partial<PersistedUserSettings>) => {
  const cache = getUserSettingsCache();
  const nextSettings = {
    ...cache,
    [String(userId)]: {
      ...USER_SETTINGS_DEFAULT,
      ...(cache[String(userId)] ?? {}),
      ...settings,
    },
  } satisfies Record<string, PersistedUserSettings>;
  window.localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(nextSettings));
};

const readUserSettings = (userId: number): PersistedUserSettings => {
  const cache = getUserSettingsCache();
  const stored = cache[String(userId)];
  if (!stored) return USER_SETTINGS_DEFAULT;
  return {
    selectedBoreholeId: stored.selectedBoreholeId ?? USER_SETTINGS_DEFAULT.selectedBoreholeId,
    selectedDisplayLayoutIds:
      typeof stored.selectedDisplayLayoutIds === "object" && stored.selectedDisplayLayoutIds !== null
        ? stored.selectedDisplayLayoutIds
        : USER_SETTINGS_DEFAULT.selectedDisplayLayoutIds,
    displayChoice: stored.displayChoice === "default" ? "default" : "saved",
    preferences: normalizeUserPreferences(stored.preferences),
  };
};

const objectValue = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

const serializeUserSettings = (settings: PersistedUserSettings) => ({
  schemaVersion: 1,
  selectedBoreholeId: settings.selectedBoreholeId,
  selectedDisplayLayoutIds: settings.selectedDisplayLayoutIds,
  displayChoice: settings.displayChoice,
  preferences: settings.preferences,
});

const settingsFromUser = (user: User): PersistedUserSettings => {
  const local = readUserSettings(user.id);
  const raw = objectValue(user.preferences);
  if (!raw) return local;
  const nestedPreferences = objectValue(raw.preferences);
  const preferenceSource = nestedPreferences ?? raw;
  const selectedBoreholeId =
    typeof raw.selectedBoreholeId === "number" || raw.selectedBoreholeId === null
      ? raw.selectedBoreholeId
      : local.selectedBoreholeId;
  const rawLayoutIds = objectValue(raw.selectedDisplayLayoutIds);
  const selectedDisplayLayoutIds = rawLayoutIds
    ? Object.fromEntries(
        Object.entries(rawLayoutIds).filter((entry): entry is [string, number | null] => {
          const value = entry[1];
          return typeof value === "number" || value === null;
        }),
      )
    : local.selectedDisplayLayoutIds;
  const displayChoice = raw.displayChoice === "default" || raw.displayChoice === "saved" ? raw.displayChoice : local.displayChoice;
  return {
    selectedBoreholeId,
    selectedDisplayLayoutIds,
    displayChoice,
    preferences: normalizeUserPreferences(preferenceSource as Partial<UserPreferences>),
  };
};

export function App() {
  const queryClient = useQueryClient();
  const [boreholeId, setBoreholeId] = useState<number | null>(null);
  const [view, setView] = useState<
    AppView
  >("landing");
  const [wikiPageKey, setWikiPageKey] = useState(WIKI_PAGES[0]?.key ?? "");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("users");
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(true);
  const [selectedAccessRole, setSelectedAccessRole] = useState("system_admin");
  const [selectedDisplayLayoutIds, setSelectedDisplayLayoutIds] = useState<Record<string, number | null>>({});
  const [displayChoice, setDisplayChoice] = useState<DisplayChoice>("saved");
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [displayEditorOpen, setDisplayEditorOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.localStorage.getItem("geoworkbench.sidebar") === "collapsed",
  );
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (window.localStorage.getItem("geoworkbench.theme") as "dark" | "light" | null) ?? "dark",
  );
  const [accent, setAccent] = useState<"red" | "blue" | "teal" | "violet">(
    () => (window.localStorage.getItem("geoworkbench.accent") as "red" | "blue" | "teal" | "violet" | null) ?? "red",
  );
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const { selectedInterval, setSelectedInterval, selectedDepth, selectedImage, setSelectedImage } =
    useWorkbenchStore();
  const { selectedRemarkGroup, setSelectedRemarkGroup } = useWorkbenchStore();
  const updatePreferencesMutation = useMutation({
    mutationFn: updateCurrentUserPreferences,
    onSuccess: (user) => {
      const nextSettings = settingsFromUser(user);
      persistUserSettings(user.id, nextSettings);
      setUserPreferences(nextSettings.preferences);
      setSession((current) => (current ? { ...current, user: { ...current.user, preferences: user.preferences } } : current));
      queryClient.setQueryData<AuthSession>(["authSession"], (current) =>
        current ? { ...current, user: { ...current.user, preferences: user.preferences } } : current,
      );
    },
  });

  const setPersistedBorehole = (nextBoreholeId: number | null) => {
    setBoreholeId(nextBoreholeId);
    if (session) {
      const nextSettings = { ...readUserSettings(session.user.id), selectedBoreholeId: nextBoreholeId };
      persistUserSettings(session.user.id, nextSettings);
      updatePreferencesMutation.mutate(serializeUserSettings(nextSettings));
    }
  };

  const setPersistedDisplayChoice = (nextDisplayChoice: DisplayChoice) => {
    setDisplayChoice(nextDisplayChoice);
    if (session) {
      const nextSettings = { ...readUserSettings(session.user.id), displayChoice: nextDisplayChoice };
      persistUserSettings(session.user.id, nextSettings);
      updatePreferencesMutation.mutate(serializeUserSettings(nextSettings));
    }
  };

  const setPersistedDisplayLayoutId = (nextBoreholeId: number, nextLayoutId: number | null) => {
    const nextDisplayLayoutIds = { ...selectedDisplayLayoutIds, [String(nextBoreholeId)]: nextLayoutId };
    setSelectedDisplayLayoutIds(nextDisplayLayoutIds);
    if (session) {
      const nextSettings = {
        ...readUserSettings(session.user.id),
        selectedDisplayLayoutIds: nextDisplayLayoutIds,
      };
      persistUserSettings(session.user.id, nextSettings);
      updatePreferencesMutation.mutate(serializeUserSettings(nextSettings));
    }
  };

  const setPersistedPreferences = (nextPreferences: UserPreferences) => {
    const normalized = normalizeUserPreferences(nextPreferences);
    setUserPreferences(normalized);
    if (session) {
      const nextSettings = { ...readUserSettings(session.user.id), preferences: normalized };
      persistUserSettings(session.user.id, nextSettings);
      updatePreferencesMutation.mutate(serializeUserSettings(nextSettings));
    }
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("geoworkbench.theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    window.localStorage.setItem("geoworkbench.accent", accent);
  }, [accent]);

  useEffect(() => {
    window.localStorage.setItem("geoworkbench.sidebar", sidebarCollapsed ? "collapsed" : "expanded");
  }, [sidebarCollapsed]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("auth_token");
    const error = params.get("auth_error");
    if (!token && !error) return;
    if (token) {
      setAuthToken(token);
      setAuthError(null);
      queryClient.invalidateQueries({ queryKey: ["authSession"] });
    }
    if (error) {
      setAuthToken(null);
      setAuthError(error);
    }
    const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash}`;
    window.history.replaceState({}, document.title, cleanUrl);
  }, [queryClient]);

  const sessionQuery = useQuery({
    queryKey: ["authSession"],
    queryFn: getCurrentSession,
    retry: false,
  });
  const isAuthed = Boolean(session);
  const canViewDeveloperDocs = session?.user.role === "system_admin" || session?.user.role === "developer";
  const visibleWikiPages = WIKI_PAGES.filter((page) => page.audience === "user" || canViewDeveloperDocs);
  const boreholes = useQuery({ queryKey: ["boreholes"], queryFn: listBoreholes, enabled: isAuthed });
  const importProfiles = useQuery({ queryKey: ["importProfiles"], queryFn: listImportProfiles, enabled: isAuthed });
  const exportProfiles = useQuery({ queryKey: ["exportProfiles"], queryFn: listExportProfiles, enabled: isAuthed });
  const diagnostics = useQuery({
    queryKey: ["diagnosticsHealth"],
    queryFn: getDiagnosticsHealth,
    enabled: isAuthed && profileOpen,
    refetchInterval: profileOpen ? 15000 : false,
  });
  const activeId = boreholeId ?? boreholes.data?.[0]?.id;
  const selectedDisplayLayoutId = activeId ? selectedDisplayLayoutIds[String(activeId)] ?? null : null;
  const selectedBorehole = boreholes.data?.find((item) => item.id === activeId) ?? boreholes.data?.[0];
  const correlationIds = useMemo(() => (boreholes.data ?? []).slice(0, 5).map((item) => item.id), [boreholes.data]);
  const workbench = useQuery({
    queryKey: ["workbench", activeId, displayChoice === "saved" ? selectedDisplayLayoutId : null],
    queryFn: () => getWorkbench(activeId as number, displayChoice === "saved" ? selectedDisplayLayoutId : null),
    enabled: isAuthed && Boolean(activeId),
  });
  const aiSummary = useQuery({
    queryKey: ["aiSummary", activeId],
    queryFn: () => getBoreholeAiSummary(activeId as number),
    enabled: isAuthed && Boolean(activeId),
  });
  const aiProvider = useQuery({ queryKey: ["aiProvider"], queryFn: getAiProviderStatus, enabled: isAuthed });
  const exportReadiness = useQuery({
    queryKey: ["exportReadiness", activeId],
    queryFn: () => getExportReadiness(activeId as number),
    enabled: isAuthed && Boolean(activeId),
  });
  const exportJobs = useQuery({
    queryKey: ["exportJobs", activeId],
    queryFn: () => listExportJobs(activeId as number),
    enabled: isAuthed && Boolean(activeId),
  });
  const roles = useQuery({ queryKey: ["roles"], queryFn: listRoles, enabled: isAuthed });
  const permissions = useQuery({
    queryKey: ["permissions"],
    queryFn: listPermissions,
    enabled: isAuthed,
  });
  const roleAccess = useQuery({
    queryKey: ["roleAccess", selectedAccessRole],
    queryFn: () => getRoleAccess(selectedAccessRole),
    enabled: isAuthed && session?.user.role === "system_admin" && Boolean(selectedAccessRole),
  });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    enabled: isAuthed && session?.user.role === "system_admin",
  });
  const qualitySettings = useQuery({
    queryKey: ["qualitySettings"],
    queryFn: getQualitySettings,
    enabled: isAuthed && session?.user.role === "system_admin",
  });
  useWorkbenchRealtime({ boreholeId: activeId, enabled: isAuthed, queryClient });

  useEffect(() => {
    if (sessionQuery.data) {
      setSession(sessionQuery.data);
      setAuthError(null);
    } else if (sessionQuery.isError) {
      setSession(null);
      setAuthToken(null);
    }
  }, [sessionQuery.data, sessionQuery.isError]);

  useEffect(() => {
    if (!visibleWikiPages.length) return;
    if (!visibleWikiPages.some((page) => page.key === wikiPageKey)) {
      setWikiPageKey(visibleWikiPages[0].key);
    }
  }, [visibleWikiPages, wikiPageKey]);

  useEffect(() => {
    if (!session) return;
    const userSettings = settingsFromUser(session.user);
    setUserPreferences(userSettings.preferences);
    setSelectedDisplayLayoutIds(userSettings.selectedDisplayLayoutIds);
    persistUserSettings(session.user.id, userSettings);
  }, [session]);

  useEffect(() => {
    if (!session || !boreholes.data?.length) return;
    const userSettings = settingsFromUser(session.user);
    setUserPreferences(userSettings.preferences);
    setSelectedDisplayLayoutIds(userSettings.selectedDisplayLayoutIds);
    if (userSettings.displayChoice !== displayChoice) {
      setDisplayChoice(userSettings.displayChoice);
    }
    if (userSettings.selectedBoreholeId === null) return;
    const exists = boreholes.data.some((item) => item.id === userSettings.selectedBoreholeId);
    if (exists && userSettings.selectedBoreholeId !== boreholeId) {
      setBoreholeId(userSettings.selectedBoreholeId);
    }
  }, [boreholes.data?.length, boreholeId, displayChoice, session?.user.id, boreholes.data, session]);

  const saveInterval = useMutation({
    mutationFn: (payload: { intervalId: string; patch: Partial<LithologyInterval> }) =>
      updateInterval(payload.intervalId, payload.patch),
    onSuccess: (updated) => {
      setSelectedInterval(updated);
      queryClient.invalidateQueries({ queryKey: ["workbench", activeId] });
    },
  });
  const validateCurrent = useMutation({
    mutationFn: () => runValidation(activeId as number),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workbench", activeId] }),
  });
  const generateSuggestions = useMutation({
    mutationFn: () => generateAiSuggestions(activeId as number),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workbench", activeId] });
      queryClient.invalidateQueries({ queryKey: ["aiSummary", activeId] });
    },
  });
  const acceptSuggestion = useMutation({
    mutationFn: (suggestionId: number) => acceptAiSuggestion(suggestionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workbench", activeId] });
      queryClient.invalidateQueries({ queryKey: ["aiSummary", activeId] });
    },
  });
  const rejectSuggestion = useMutation({
    mutationFn: (suggestionId: number) => updateAiSuggestionStatus(suggestionId, "rejected"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workbench", activeId] }),
  });
  const createExport = useMutation({
    mutationFn: (payload:
      | string
      | {
          export_type: string;
          export_profile_id?: number | null;
          stage?: string | null;
          from_depth?: number | null;
          to_depth?: number | null;
          sections?: string[] | null;
        }) => createExportJob(activeId as number, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exportReadiness", activeId] });
      queryClient.invalidateQueries({ queryKey: ["exportJobs", activeId] });
    },
  });
  const approveExport = useMutation({
    mutationFn: () => approveBoreholeForExport(activeId as number),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boreholes"] });
      queryClient.invalidateQueries({ queryKey: ["workbench", activeId] });
      queryClient.invalidateQueries({ queryKey: ["exportReadiness", activeId] });
    },
  });
  const saveDisplayLayout = useMutation({
    mutationFn: (layout: DisplayLayout) =>
      updateDisplayLayout(layout.id, {
        name: layout.name,
        mode: layout.mode,
        settings: layout.settings,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workbench", activeId] }),
  });
  const resetCurrentLayout = useMutation({
    mutationFn: () => resetDisplayLayout(activeId as number),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workbench", activeId] }),
  });
  const cloneCurrentLayout = useMutation({
    mutationFn: (layout: DisplayLayout) => cloneDisplayLayout(layout.id, `${layout.name} Copy`),
    onSuccess: (layout) => {
      if (activeId) setPersistedDisplayLayoutId(activeId, layout.id);
      queryClient.invalidateQueries({ queryKey: ["workbench", activeId] });
    },
  });
  const deleteCurrentLayout = useMutation({
    mutationFn: (layout: DisplayLayout) => deleteDisplayLayout(layout.id),
    onSuccess: (layout) => {
      if (activeId) setPersistedDisplayLayoutId(activeId, layout.id);
      queryClient.invalidateQueries({ queryKey: ["workbench", activeId] });
    },
  });
  const registerSourceFile = useMutation({
    mutationFn: (payload: {
      file_type: string;
      original_name: string;
      storage_path?: string;
      file_metadata?: Record<string, unknown>;
    }) =>
      createSourceFile({
        borehole_id: activeId ?? null,
        file_type: payload.file_type,
        original_name: payload.original_name,
        storage_path: payload.storage_path ?? `registered://${payload.original_name}`,
        file_metadata: payload.file_metadata ?? { registration_mode: "manual_registration" },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workbench", activeId] }),
  });
  const saveImportProfile = useMutation({
    mutationFn: (payload: { profileId: number; name: string; description: string; mapping: Record<string, unknown> }) =>
      updateImportProfile(payload.profileId, {
        name: payload.name,
        description: payload.description,
        mapping: payload.mapping,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["importProfiles"] }),
  });
  const saveExportProfile = useMutation({
    mutationFn: (payload: { profileId: number; name: string; description: string; mapping: Record<string, unknown> }) =>
      updateExportProfile(payload.profileId, {
        name: payload.name,
        description: payload.description,
        mapping: payload.mapping,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exportProfiles"] }),
  });
  const uploadFile = useMutation({
    mutationFn: (payload: { file_type: string; file: File }) =>
      uploadSourceFile({
        borehole_id: activeId ?? null,
        file_type: payload.file_type,
        file: payload.file,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workbench", activeId] }),
  });
  const processFile = useMutation({
    mutationFn: (sourceFileId: number) => processSourceFile(sourceFileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workbench", activeId] }),
  });
  const importBoreholeFile = useMutation({
    mutationFn: (sourceFileId: number) => importSourceFileAsBorehole(sourceFileId),
    onSuccess: (result) => {
      setPersistedBorehole(result.borehole_id);
      queryClient.invalidateQueries({ queryKey: ["boreholes"] });
      queryClient.invalidateQueries({ queryKey: ["workbench"] });
    },
  });
  const mergeSourceFile = useMutation({
    mutationFn: (payload: {
      sourceFileId: number;
      options?: {
        interval_mode?: string;
        curve_mode?: string;
        from_depth?: number | null;
        to_depth?: number | null;
      };
    }) => mergeSourceFileIntoBorehole(payload.sourceFileId, payload.options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workbench", activeId] });
      queryClient.invalidateQueries({ queryKey: ["boreholes"] });
    },
  });
  const loginMutation = useMutation({
    mutationFn: (payload: { username: string; password: string }) => login(payload.username, payload.password),
    onSuccess: (result) => {
      setAuthToken(result.token);
      setSession({ user: result.user, expires_at: result.expires_at, client_type: "web" });
      setAuthError(null);
      queryClient.invalidateQueries({ queryKey: ["authSession"] });
      queryClient.invalidateQueries({ queryKey: ["boreholes"] });
    },
    onError: (error) => setAuthError(error instanceof Error ? error.message : "Login failed"),
  });
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      setAuthToken(null);
      setSession(null);
      setProfileOpen(false);
      setView("landing");
      queryClient.clear();
    },
  });
  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
  const updateUserMutation = useMutation({
    mutationFn: (payload: { userId: number; patch: Partial<User> }) =>
      updateUser(payload.userId, payload.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["authSession"] });
    },
  });
  const deactivateUserMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
  const resetPasswordMutation = useMutation({
    mutationFn: (payload: { userId: number; newPassword: string }) =>
      resetUserPassword(payload.userId, payload.newPassword),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
  const createRoleMutation = useMutation({
    mutationFn: createRole,
    onSuccess: (role) => {
      setSelectedAccessRole(role.key);
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });
  const updateRoleMutation = useMutation({
    mutationFn: (payload: { roleKey: string; patch: Partial<Role> }) =>
      updateRole(payload.roleKey, payload.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
  const updateRoleAccessMutation = useMutation({
    mutationFn: (payload: { roleKey: string; permissions: string[] }) =>
      updateRoleAccess(payload.roleKey, payload.permissions),
    onSuccess: (_, variables) =>
      queryClient.invalidateQueries({ queryKey: ["roleAccess", variables.roleKey] }),
  });
  const updateQualitySettingsMutation = useMutation({
    mutationFn: updateQualitySettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qualitySettings"] });
      queryClient.invalidateQueries({ queryKey: ["workbench", activeId] });
      queryClient.invalidateQueries({ queryKey: ["aiSummary", activeId] });
    },
  });
  const resetQualitySettingsMutation = useMutation({
    mutationFn: resetQualitySettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qualitySettings"] });
      queryClient.invalidateQueries({ queryKey: ["workbench", activeId] });
      queryClient.invalidateQueries({ queryKey: ["aiSummary", activeId] });
    },
  });
  const changePasswordMutation = useMutation({
    mutationFn: (payload: { currentPassword: string; newPassword: string }) =>
      changePassword(payload.currentPassword, payload.newPassword),
    onSuccess: () => setPasswordDialogOpen(false),
  });

  const selectedCoreImage = useMemo(() => {
    if (!workbench.data) return null;
    if (selectedDepth !== null) {
      return (
        workbench.data.core_images.find(
          (image) =>
            image.from_depth !== null &&
            image.to_depth !== null &&
            image.from_depth <= selectedDepth &&
            image.to_depth >= selectedDepth,
        ) ?? null
      );
    }
    if (!selectedInterval) return null;
    return (
      workbench.data.core_images.find((image) => image.box_number === selectedInterval.image_box) ??
      workbench.data.core_images.find(
        (image) =>
          image.from_depth !== null &&
          image.to_depth !== null &&
          image.from_depth <= selectedInterval.from_depth &&
          image.to_depth >= selectedInterval.from_depth,
      ) ??
      null
    );
  }, [selectedDepth, selectedInterval, workbench.data]);
  const runtimeWorkbenchData = useMemo(() => {
    if (!workbench.data || displayChoice !== "default") return workbench.data;
    return {
      ...workbench.data,
      layout: {
        id: workbench.data.layout?.id ?? 0,
        name: "Default Correction Display",
        mode: "runtime",
        settings: {},
      },
    };
  }, [displayChoice, workbench.data]);
  const displayLayoutOptions = workbench.data?.display_layouts ?? [];
  const activeDisplayLayoutName =
    displayChoice === "default"
      ? "Default correction display"
      : workbench.data?.layout?.name ?? "Saved borehole display";

  const openWorkbench = (id = activeId) => {
    if (id) {
      setPersistedBorehole(id);
      setView("workbench");
    }
  };

  const navigateTo = (nextView: typeof view) => {
    setView(nextView);
  };

  if (!session) {
    return (
      <LoginScreen
        theme={theme}
        busy={loginMutation.isPending || sessionQuery.isLoading}
        error={authError}
        onThemeChange={setTheme}
        onEntraLogin={startEntraLogin}
        onLogin={(username, password) => loginMutation.mutate({ username, password })}
      />
    );
  }

  return (
    <main className={`app-shell ${view === "landing" ? "landing-shell" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <header className="topbar">
        <div className="sidebar-brand">
          <button type="button" className="brand-lockup" onClick={() => setView("landing")}>
            <img className="brand-logo-full" src="/branding/simpro-logo.png" alt="Simpro" />
            <img className="brand-logo-mark" src="/branding/simpro-favicon.png" alt="Simpro" />
          </button>
          <button
            type="button"
            className="sidebar-toggle"
            title={sidebarCollapsed ? "Expand menu" : "Collapse menu"}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            {sidebarCollapsed ? ">" : "<"}
          </button>
        </div>
        <nav className="app-nav" aria-label="Primary">
          <button type="button" className={view === "landing" ? "active" : ""} onClick={() => navigateTo("landing")}>
            <span><LayoutDashboard size={17} strokeWidth={2.1} /></span><b>Dashboard</b>
          </button>
          <button type="button" className={view === "workbench" ? "active" : ""} disabled={!activeId} onClick={() => openWorkbench()}>
            <span><PanelTop size={17} strokeWidth={2.1} /></span><b>Workbench</b>
          </button>
          <button type="button" className={view === "import" ? "active" : ""} onClick={() => navigateTo("import")} disabled={!activeId}>
            <span><Upload size={17} strokeWidth={2.1} /></span><b>Import</b>
          </button>
          <button type="button" className={view === "export" ? "active" : ""} onClick={() => navigateTo("export")} disabled={!activeId}>
            <span><Download size={17} strokeWidth={2.1} /></span><b>Export</b>
          </button>
          <button type="button" className={view === "correlation" ? "active" : ""} onClick={() => navigateTo("correlation")} disabled={!correlationIds.length}>
            <span><GitCompareArrows size={17} strokeWidth={2.1} /></span><b>Correlation</b>
          </button>
          <div className={`nav-group ${view === "settings" ? "active" : ""}`}>
            <button
              type="button"
              className={view === "settings" ? "active" : ""}
              onClick={() => {
                setSettingsMenuOpen((open) => !open);
                if (view !== "settings") navigateTo("settings");
              }}
              disabled={session.user.role !== "system_admin"}
            >
              <span><Settings size={17} strokeWidth={2.1} /></span><b>Settings</b>
            </button>
            {settingsMenuOpen && (
              <div className="app-subnav" aria-label="Settings">
                <button
                  type="button"
                  className={view === "settings" && settingsTab === "users" ? "active" : ""}
                  onClick={() => {
                    setSettingsTab("users");
                    navigateTo("settings");
                  }}
                >
                  Users
                </button>
                <button
                  type="button"
                  className={view === "settings" && settingsTab === "roles" ? "active" : ""}
                  onClick={() => {
                    setSettingsTab("roles");
                    navigateTo("settings");
                  }}
                >
                  Roles
                </button>
                <button
                  type="button"
                  className={view === "settings" && settingsTab === "access" ? "active" : ""}
                  onClick={() => {
                    setSettingsTab("access");
                    navigateTo("settings");
                  }}
                >
                  Access Matrix
                </button>
                <button
                  type="button"
                  className={view === "settings" && settingsTab === "quality" ? "active" : ""}
                  onClick={() => {
                    setSettingsTab("quality");
                    navigateTo("settings");
                  }}
                >
                  Quality Rules
                </button>
                <button
                  type="button"
                  className={view === "settings" && settingsTab === "preferences" ? "active" : ""}
                  onClick={() => {
                    setSettingsTab("preferences");
                    navigateTo("settings");
                  }}
                >
                  Preferences
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className={view === "displayEditor" ? "active" : ""}
            disabled={!activeId}
            onClick={() => {
              setDisplayEditorOpen(true);
              navigateTo("displayEditor");
            }}
          >
            <span><SlidersHorizontal size={17} strokeWidth={2.1} /></span><b>Display setup</b>
          </button>
          <button type="button" className={view === "wiki" ? "active" : ""} onClick={() => navigateTo("wiki")}>
            <span><BookOpenText size={17} strokeWidth={2.1} /></span><b>Wiki</b>
          </button>
        </nav>
        <div className="sidebar-footer" aria-hidden="true" />
      </header>
      <section className="page-topbar">
        <div className="page-selection">
          {selectedBorehole ? (
            <div className="selected-summary">
              <div className="selected-borehole-stack">
                <span className="selected-code">{selectedBorehole.code}</span>
                <small>{activeDisplayLayoutName}</small>
              </div>
              {displayChoice === "saved" && displayLayoutOptions.length > 1 && activeId && (
                <label className="selected-display-select">
                  <span>Display</span>
                  <select
                    value={workbench.data?.layout?.id ?? ""}
                    onChange={(event) => setPersistedDisplayLayoutId(activeId, Number(event.target.value))}
                  >
                    {displayLayoutOptions.map((layout) => (
                      <option key={layout.id} value={layout.id}>
                        {layout.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <span className="selected-context">
                <Building2 size={14} strokeWidth={2} />
                {selectedBorehole.project_code} / {selectedBorehole.site_code}
              </span>
            </div>
          ) : (
            <span className="selected-empty">No borehole selected</span>
          )}
        </div>
        <div className="page-actions">
          <button type="button" className="utility-button" title="Notifications">
            <Bell size={19} strokeWidth={2.1} />
            <span>0</span>
          </button>
          <button type="button" className="utility-button" title="Language settings">
            <Globe2 size={19} strokeWidth={2.1} />
          </button>
          <div className="profile-menu-wrap">
            <button
              type="button"
              className="profile-chip"
              onClick={() => setProfileOpen((open) => !open)}
            >
              <span>{initials(session.user.display_name)}</span>
              <small>
                {session.user.display_name}
                <b>{roleLabel(session.user.role)}</b>
              </small>
            </button>
            {profileOpen && (
              <div className="profile-menu" role="menu">
                <div className="profile-menu-header">
                  <strong>{session.user.display_name}</strong>
                  <span>{session.user.username} · {roleLabel(session.user.role)}</span>
                </div>
                <div className="profile-theme-row">
                  <span>Theme</span>
                  <div className="login-theme-switch profile-theme-switch" aria-label="Theme">
                    <button
                      type="button"
                      className={theme === "light" ? "active" : ""}
                      title="Light theme"
                      onClick={() => setTheme("light")}
                    >
                      <SunIcon />
                    </button>
                    <button
                      type="button"
                      className={theme === "dark" ? "active" : ""}
                      title="Dark theme"
                      onClick={() => setTheme("dark")}
                    >
                      <MoonIcon />
                    </button>
                  </div>
                </div>
                <div className="profile-accent-row">
                  <span>Accent</span>
                  <div className="accent-switch" aria-label="Accent color">
                    {(["red", "blue", "teal", "violet"] as const).map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`accent-${item} ${accent === item ? "active" : ""}`}
                        title={`${item} accent`}
                        onClick={() => setAccent(item)}
                      />
                    ))}
                  </div>
                </div>
                <div className="profile-status-row">
                  {diagnostics.data ? (
                    <>
                      <span className="status-dot" />
                      <strong>Status</strong>
                      <small>
                        API {diagnostics.data.status} · DB {diagnostics.data.database.status} · AI{" "}
                        {diagnostics.data.ai.provider}
                      </small>
                    </>
                  ) : (
                    <>
                      <span className="status-dot pending" />
                      <strong>Status</strong>
                      <small>{diagnostics.isLoading ? "Checking health..." : "Open menu to refresh."}</small>
                    </>
                  )}
                </div>
                <button type="button" onClick={() => setPasswordDialogOpen(true)}>
                  Change password
                </button>
                <button type="button" onClick={() => logoutMutation.mutate()}>
                  {logoutMutation.isPending ? "Signing out..." : "Logout"}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {view === "landing" && (
        <LandingPage
          boreholes={boreholes.data ?? []}
          loading={boreholes.isLoading}
          activeId={selectedBorehole?.id ?? null}
          selectedBorehole={selectedBorehole ?? null}
          displayChoice={displayChoice}
          onSelect={(id) => setPersistedBorehole(id)}
          onDisplayChoice={(choice) => setPersistedDisplayChoice(choice)}
          onOpen={(id) => openWorkbench(id)}
          onManageDisplay={(id) => {
            setPersistedBorehole(id);
            setDisplayEditorOpen(true);
            setView("displayEditor");
          }}
        />
      )}

      {view === "correlation" && (
        <CorrelationWorkspace
          boreholes={boreholes.data ?? []}
          initialIds={correlationIds}
          onOpenWorkbench={(id) => {
            setPersistedBorehole(id);
            setView("workbench");
          }}
        />
      )}

      {view === "workbench" && workbench.isLoading && <div className="empty">Loading borehole workbench...</div>}
      {view === "workbench" && workbench.error && <div className="empty">Could not load workbench.</div>}
      {view === "workbench" && runtimeWorkbenchData && (
        <DisplayRuntime
          data={runtimeWorkbenchData}
          aiSummary={aiSummary.data}
          aiProvider={aiProvider.data}
          exportReadiness={exportReadiness.data}
          exportJobs={exportJobs.data}
          importProfiles={importProfiles.data}
          selectedInterval={selectedInterval}
          selectedCoreImage={selectedCoreImage}
          validationRunning={validateCurrent.isPending}
          aiGenerating={generateSuggestions.isPending}
          aiActing={acceptSuggestion.isPending || rejectSuggestion.isPending}
          exportCreating={createExport.isPending}
          exportApproving={approveExport.isPending}
          sourceRegistering={registerSourceFile.isPending}
          sourceUploading={uploadFile.isPending}
          sourceProcessing={processFile.isPending}
          sourceImporting={importBoreholeFile.isPending}
          sourceMerging={mergeSourceFile.isPending}
          intervalSaving={saveInterval.isPending}
          preferences={userPreferences}
          onRunValidation={() => validateCurrent.mutate()}
          onGenerateAi={() => generateSuggestions.mutate()}
          onAcceptSuggestion={(suggestionId) => acceptSuggestion.mutate(suggestionId)}
          onRejectSuggestion={(suggestionId) => rejectSuggestion.mutate(suggestionId)}
          onCreateExport={(exportType) => createExport.mutate(exportType)}
          onApproveExport={() => approveExport.mutate()}
          onRegisterSourceFile={(payload) =>
            registerSourceFile.mutate({
              file_type: payload.file_type,
              original_name: payload.original_name,
              storage_path: payload.storage_path,
              file_metadata: payload.file_metadata,
            })
          }
          onUploadSourceFile={(payload) => uploadFile.mutate(payload)}
          onProcessSourceFile={(sourceFileId) => processFile.mutate(sourceFileId)}
          onImportBoreholeFile={(sourceFileId) => importBoreholeFile.mutate(sourceFileId)}
          onMergeSourceFile={(sourceFileId) => mergeSourceFile.mutate({ sourceFileId })}
          onSaveInterval={(intervalId, patch) => saveInterval.mutate({ intervalId, patch })}
          onSelectImage={(image) => setSelectedImage(image)}
        />
      )}

      {view === "import" && workbench.isLoading && <div className="empty">Loading import center...</div>}
      {view === "import" && runtimeWorkbenchData && (
        <ImportCenter
          data={runtimeWorkbenchData}
          importProfiles={importProfiles.data}
          registering={registerSourceFile.isPending}
          uploading={uploadFile.isPending}
          processing={processFile.isPending}
          importing={importBoreholeFile.isPending}
          merging={mergeSourceFile.isPending}
          savingProfile={saveImportProfile.isPending}
          onRegisterSourceFile={(payload) =>
            registerSourceFile.mutate({
              file_type: payload.file_type,
              original_name: payload.original_name,
              storage_path: payload.storage_path,
              file_metadata: payload.file_metadata,
            })
          }
          onSaveImportProfile={(payload) => saveImportProfile.mutate(payload)}
          onUploadSourceFile={(payload) => uploadFile.mutate(payload)}
          onProcessSourceFile={(sourceFileId) => processFile.mutate(sourceFileId)}
          onImportBoreholeFile={(sourceFileId) => importBoreholeFile.mutate(sourceFileId)}
          onMergeSourceFile={(sourceFileId, options) => mergeSourceFile.mutate({ sourceFileId, options })}
          onOpenWorkbench={() => setView("workbench")}
        />
      )}

      {view === "export" && workbench.isLoading && <div className="empty">Loading export center...</div>}
      {view === "export" && runtimeWorkbenchData && (
        <ExportCenter
          data={runtimeWorkbenchData}
          readiness={exportReadiness.data}
          jobs={exportJobs.data}
          exportProfiles={exportProfiles.data}
          creating={createExport.isPending}
          approving={approveExport.isPending}
          savingProfile={saveExportProfile.isPending}
          onCreate={(payload) => createExport.mutate(payload)}
          onApprove={() => approveExport.mutate()}
          onSaveExportProfile={(payload) => saveExportProfile.mutate(payload)}
          onOpenWorkbench={() => setView("workbench")}
        />
      )}

      {view === "settings" && (
        <SettingsPage
          activeTab={settingsTab}
          users={users.data ?? []}
          roles={roles.data ?? []}
          permissions={permissions.data ?? []}
          qualitySettings={qualitySettings.data}
          preferences={userPreferences}
          selectedAccessRole={selectedAccessRole}
          selectedAccessPermissions={roleAccess.data?.permissions ?? []}
          currentUserId={session.user.id}
          loading={users.isLoading || roles.isLoading || permissions.isLoading || qualitySettings.isLoading}
          busy={
            createUserMutation.isPending ||
            updateUserMutation.isPending ||
            deactivateUserMutation.isPending ||
            resetPasswordMutation.isPending ||
            createRoleMutation.isPending ||
            updateRoleMutation.isPending ||
            updateRoleAccessMutation.isPending ||
            updateQualitySettingsMutation.isPending ||
            resetQualitySettingsMutation.isPending ||
            updatePreferencesMutation.isPending
          }
          error={
            users.error instanceof Error
              ? users.error.message
              : roles.error instanceof Error
                ? roles.error.message
                : permissions.error instanceof Error
                  ? permissions.error.message
                  : roleAccess.error instanceof Error
                    ? roleAccess.error.message
                    : qualitySettings.error instanceof Error
                      ? qualitySettings.error.message
                    : null
          }
          onAccessRoleChange={setSelectedAccessRole}
          onCreate={(payload) => createUserMutation.mutate(payload)}
          onUpdate={(userId, patch) => updateUserMutation.mutate({ userId, patch })}
          onDeactivate={(userId) => deactivateUserMutation.mutate(userId)}
          onResetPassword={(userId, newPassword) =>
            resetPasswordMutation.mutate({ userId, newPassword })
          }
          onCreateRole={(payload) => createRoleMutation.mutate(payload)}
          onUpdateRole={(roleKey, patch) => updateRoleMutation.mutate({ roleKey, patch })}
          onUpdateRoleAccess={(roleKey, nextPermissions) =>
            updateRoleAccessMutation.mutate({ roleKey, permissions: nextPermissions })
          }
          onSaveQualitySettings={(settings) => updateQualitySettingsMutation.mutate(settings)}
          onResetQualitySettings={() => resetQualitySettingsMutation.mutate()}
          onSavePreferences={setPersistedPreferences}
        />
      )}

      {view === "wiki" && (
        <WikiPage
          pages={visibleWikiPages}
          activeKey={wikiPageKey}
          markdown={WIKI_MARKDOWN[wikiPageKey] ?? ""}
          onSelect={setWikiPageKey}
          developerView={canViewDeveloperDocs}
        />
      )}

      {view === "displayEditor" && (
        <DisplayEditorDialog
          open={displayEditorOpen}
          data={workbench.data ?? null}
          layout={workbench.data?.layout ?? null}
          availableCurves={workbench.data?.curves ?? []}
          saving={saveDisplayLayout.isPending}
          cloning={cloneCurrentLayout.isPending}
          deleting={deleteCurrentLayout.isPending}
          resetting={resetCurrentLayout.isPending}
          canDelete={(workbench.data?.display_layouts ?? []).length > 1}
          onSave={(layout) =>
            saveDisplayLayout.mutate(layout, {
              onSuccess: () => {
                setDisplayEditorOpen(false);
                setView("workbench");
              },
            })
          }
          onClone={(layout) => cloneCurrentLayout.mutate(layout)}
          onDelete={(layout) => deleteCurrentLayout.mutate(layout)}
          onReset={() => resetCurrentLayout.mutate()}
          onClose={() => {
            setDisplayEditorOpen(false);
            setView("workbench");
          }}
        />
      )}

      {selectedImage && (
        <div className="image-modal" role="dialog" aria-modal="true">
          <div className="image-modal-header">
            <strong>
              Corebox {selectedImage.box_number}: {selectedImage.from_depth} m -{" "}
              {selectedImage.to_depth} m
            </strong>
            <button type="button" onClick={() => setSelectedImage(null)}>
              Close
            </button>
          </div>
          <img src={selectedImage.original_url ?? selectedImage.url} alt={`Corebox ${selectedImage.box_number}`} />
        </div>
      )}
      {selectedRemarkGroup && (
        <div className="remark-modal" role="dialog" aria-modal="true">
          <div className="image-modal-header">
            <strong>{selectedRemarkGroup.label ?? "Remarks"}</strong>
            <button type="button" onClick={() => setSelectedRemarkGroup(null)}>
              Close
            </button>
          </div>
          <div className="remark-list">
            {selectedRemarkGroup.remarks.map((remark, index) => (
              <div key={`${remark.depth}:${remark.sourceRow}:${index}`} className="remark-item">
                <strong>
                  {remark.depth.toFixed(1)}m · source row {remark.sourceRow ?? "-"}
                </strong>
                <span>{remark.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {passwordDialogOpen && (
        <PasswordDialog
          busy={changePasswordMutation.isPending}
          error={changePasswordMutation.error instanceof Error ? changePasswordMutation.error.message : null}
          onClose={() => setPasswordDialogOpen(false)}
          onSave={(currentPassword, newPassword) =>
            changePasswordMutation.mutate({ currentPassword, newPassword })
          }
        />
      )}
    </main>
  );
}

type LandingPageProps = {
  boreholes: BoreholeListItem[];
  loading: boolean;
  activeId: number | null;
  selectedBorehole: BoreholeListItem | null;
  displayChoice: DisplayChoice;
  onSelect: (id: number) => void;
  onDisplayChoice: (choice: DisplayChoice) => void;
  onOpen: (id: number) => void;
  onManageDisplay: (id: number) => void;
};

function LoginScreen({
  theme,
  busy,
  error,
  onThemeChange,
  onEntraLogin,
  onLogin,
}: {
  theme: "dark" | "light";
  busy: boolean;
  error: string | null;
  onThemeChange: (theme: "dark" | "light") => void;
  onEntraLogin: () => void;
  onLogin: (username: string, password: string) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onLogin(String(form.get("username") || ""), String(form.get("password") || ""));
  };
  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-brand">
          <img src="/branding/simpro-logo.png" alt="Simpro" />
          <span>
            <strong>GeoWorkbench</strong>
            <small>Borehole correction workspace</small>
          </span>
        </div>
        <div className="login-heading">
          <h1>Sign In</h1>
          <div className="login-theme-switch" aria-label="Theme">
            <button
              type="button"
              className={theme === "light" ? "active" : ""}
              title="Light theme"
              onClick={() => onThemeChange("light")}
            >
              <SunIcon />
            </button>
            <button
              type="button"
              className={theme === "dark" ? "active" : ""}
              title="Dark theme"
              onClick={() => onThemeChange("dark")}
            >
              <MoonIcon />
            </button>
          </div>
        </div>
        <button
          type="button"
          className="sso-button"
          title="OIDC configuration requires tenant id, client id, redirect URI, and allowed domain."
          onClick={onEntraLogin}
        >
          Sign in with Entra ID
        </button>
        <div className="login-separator"><span>or</span></div>
        <form className="login-form" onSubmit={submit}>
          <label>
            Username
            <input name="username" defaultValue="geologist" placeholder="e.g. geologist" autoComplete="username" />
          </label>
          <label>
            Password
            <span className="password-field">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                defaultValue="geologist123"
                placeholder="Use alphanumeric characters"
                autoComplete="current-password"
              />
              <button
                type="button"
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </span>
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Secure Sign-in"}
          </button>
        </form>
      </section>
    </main>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.4M12 19.6V22M4.93 4.93l1.7 1.7M17.37 17.37l1.7 1.7M2 12h2.4M19.6 12H22M4.93 19.07l1.7-1.7M17.37 6.63l1.7-1.7" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.4 14.8A8.2 8.2 0 0 1 9.2 3.6a8.7 8.7 0 1 0 11.2 11.2Z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true">
      <path
        d="M255.66 112c-77.94 0-157.89 45.11-220.83 135.33a16 16 0 0 0-.27 17.77C82.92 340.8 161.8 400 255.66 400c92.84 0 173.34-59.38 221.79-135.25a16.14 16.14 0 0 0 0-17.47C428.89 172.28 347.8 112 255.66 112z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="32"
      />
      <circle
        cx="256"
        cy="256"
        r="80"
        fill="none"
        stroke="currentColor"
        strokeMiterlimit="10"
        strokeWidth="32"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true">
      <path
        d="M432 448a15.92 15.92 0 0 1-11.31-4.69l-352-352a16 16 0 0 1 22.62-22.62l352 352A16 16 0 0 1 432 448z"
        fill="currentColor"
      />
      <path
        d="M255.66 384c-41.49 0-81.5-12.28-118.92-36.5-34.07-22-64.74-53.51-88.7-91v-.08c19.94-28.57 41.78-52.73 65.24-72.21a2 2 0 0 0 .14-2.94L93.5 161.38a2 2 0 0 0-2.71-.12c-24.92 21-48.05 46.76-69.08 76.92a31.92 31.92 0 0 0-.64 35.54c26.41 41.33 60.4 76.14 98.28 100.65C162 402 207.9 416 255.66 416a239.13 239.13 0 0 0 75.8-12.58 2 2 0 0 0 .77-3.31l-21.58-21.58a4 4 0 0 0-3.83-1 204.8 204.8 0 0 1-51.16 6.47z"
        fill="currentColor"
      />
      <path
        d="M490.84 238.6c-26.46-40.92-60.79-75.68-99.27-100.53C349 110.55 302 96 255.66 96a227.34 227.34 0 0 0-74.89 12.83 2 2 0 0 0-.75 3.31l21.55 21.55a4 4 0 0 0 3.88 1A192.82 192.82 0 0 1 255.66 128c40.69 0 80.58 12.43 118.55 37 34.71 22.4 65.74 53.88 89.76 91a.13.13 0 0 1 0 .16 310.72 310.72 0 0 1-64.12 72.73 2 2 0 0 0-.15 2.95l19.9 19.89a2 2 0 0 0 2.7.13 343.49 343.49 0 0 0 68.64-78.48 32.2 32.2 0 0 0-.1-34.78z"
        fill="currentColor"
      />
      <path
        d="M256 160a95.88 95.88 0 0 0-21.37 2.4 2 2 0 0 0-1 3.38l112.59 112.56a2 2 0 0 0 3.38-1A96 96 0 0 0 256 160zM165.78 233.66a2 2 0 0 0-3.38 1 96 96 0 0 0 115 115 2 2 0 0 0 1-3.38z"
        fill="currentColor"
      />
    </svg>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function roleLabel(role: string): string {
  return role
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function pageTitle(
  view: "landing" | "workbench" | "correlation" | "import" | "export" | "settings" | "displayEditor" | "wiki",
): string {
  if (view === "workbench") return "Workbench";
  if (view === "correlation") return "Correlation";
  if (view === "import") return "Import Center";
  if (view === "export") return "Export Center";
  if (view === "settings") return "Settings";
  if (view === "displayEditor") return "Display Editor";
  if (view === "wiki") return "Wiki";
  return "Dashboard";
}

type WikiDocPage = {
  key: string;
  title: string;
  group: string;
  audience: string;
};

function WikiPage({
  pages,
  activeKey,
  markdown,
  onSelect,
  developerView,
}: {
  pages: WikiDocPage[];
  activeKey: string;
  markdown: string;
  onSelect: (key: string) => void;
  developerView: boolean;
}) {
  const activePage = pages.find((page) => page.key === activeKey) ?? pages[0];
  const groupedPages = pages.reduce<Record<string, WikiDocPage[]>>((groups, page) => {
    groups[page.group] = [...(groups[page.group] ?? []), page];
    return groups;
  }, {});

  return (
    <section className="wiki-page">
      <aside className="wiki-sidebar" aria-label="Wiki pages">
        <div className="wiki-sidebar-header">
          <strong>GeoWorkbench Wiki</strong>
          <span>{developerView ? "Developer view" : "User view"} · {pages.length} pages</span>
        </div>
        {Object.entries(groupedPages).map(([group, groupPages]) => (
          <div key={group} className="wiki-page-group">
            <span>{group}</span>
            {groupPages.map((page) => (
              <button
                key={page.key}
                type="button"
                className={page.key === activePage?.key ? "active" : ""}
                onClick={() => onSelect(page.key)}
              >
                {page.title}
              </button>
            ))}
          </div>
        ))}
      </aside>
      <article className="wiki-document">
        <div className="wiki-document-header">
          <span>{activePage?.group ?? "Wiki"}</span>
          <h1>{activePage?.title ?? "Documentation"}</h1>
        </div>
        <div className="wiki-markdown">
          {markdown ? renderMarkdown(markdown) : <div className="empty">Documentation page not found.</div>}
        </div>
      </article>
    </section>
  );
}

function renderMarkdown(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const nodes = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      nodes.push(
        <pre key={`code-${index}`} className="wiki-code">
          {language && <span>{language}</span>}
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    if (trimmed.startsWith("|") && lines[index + 1]?.trim().match(/^\|?[\s:-]+\|/)) {
      const tableLines = [trimmed];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        tableLines.push(lines[index].trim());
        index += 1;
      }
      const [headerLine, ...bodyLines] = tableLines;
      const headers = splitMarkdownRow(headerLine);
      const rows = bodyLines.map(splitMarkdownRow);
      nodes.push(
        <div key={`table-${index}`} className="wiki-table-wrap">
          <table>
            <thead>
              <tr>{headers.map((cell, cellIndex) => <th key={cellIndex}>{renderInlineMarkdown(cell)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => <td key={cellIndex}>{renderInlineMarkdown(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (trimmed.startsWith("- ")) {
      const items = [];
      while (index < lines.length && lines[index].trim().startsWith("- ")) {
        items.push(lines[index].trim().slice(2));
        index += 1;
      }
      nodes.push(<ul key={`ul-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item)}</li>)}</ul>);
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s/, ""));
        index += 1;
      }
      nodes.push(<ol key={`ol-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item)}</li>)}</ol>);
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const Tag = (`h${Math.min(level, 4)}`) as "h1" | "h2" | "h3" | "h4";
      nodes.push(<Tag key={`heading-${index}`}>{renderInlineMarkdown(text)}</Tag>);
      index += 1;
      continue;
    }

    nodes.push(<p key={`p-${index}`}>{renderInlineMarkdown(trimmed)}</p>);
    index += 1;
  }

  return nodes;
}

function splitMarkdownRow(row: string) {
  return row
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    return <span key={index}>{part}</span>;
  });
}

function SettingsPage({
  activeTab,
  users,
  roles,
  permissions,
  qualitySettings,
  preferences,
  selectedAccessRole,
  selectedAccessPermissions,
  currentUserId,
  loading,
  busy,
  error,
  onAccessRoleChange,
  onCreate,
  onUpdate,
  onDeactivate,
  onResetPassword,
  onCreateRole,
  onUpdateRole,
  onUpdateRoleAccess,
  onSaveQualitySettings,
  onResetQualitySettings,
  onSavePreferences,
}: {
  activeTab: SettingsTab;
  users: User[];
  roles: Role[];
  permissions: Permission[];
  qualitySettings: QualitySettings | undefined;
  preferences: UserPreferences;
  selectedAccessRole: string;
  selectedAccessPermissions: string[];
  currentUserId: number;
  loading: boolean;
  busy: boolean;
  error: string | null;
  onAccessRoleChange: (roleKey: string) => void;
  onCreate: (payload: {
    username: string;
    display_name: string;
    role: string;
    password: string;
    email?: string | null;
    mobile_number?: string | null;
    is_active?: number;
  }) => void;
  onUpdate: (userId: number, patch: Partial<User>) => void;
  onDeactivate: (userId: number) => void;
  onResetPassword: (userId: number, newPassword: string) => void;
  onCreateRole: (payload: {
    key: string;
    label: string;
    description?: string | null;
    is_active?: number;
  }) => void;
  onUpdateRole: (roleKey: string, patch: Partial<Role>) => void;
  onUpdateRoleAccess: (roleKey: string, permissions: string[]) => void;
  onSaveQualitySettings: (settings: QualitySettingsPayload) => void;
  onResetQualitySettings: () => void;
  onSavePreferences: (preferences: UserPreferences) => void;
}) {
  const [editing, setEditing] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const defaultRole = roles.find((role) => role.is_active)?.key ?? "central_geologist";
  const create = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onCreate({
      username: String(form.get("username") || ""),
      display_name: String(form.get("display_name") || ""),
      email: String(form.get("email") || "") || null,
      mobile_number: String(form.get("mobile_number") || "") || null,
      role: String(form.get("role") || defaultRole),
      password: String(form.get("password") || ""),
      is_active: form.get("is_active") === "on" ? 1 : 0,
    });
    event.currentTarget.reset();
  };
  const createRoleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onCreateRole({
      key: String(form.get("key") || ""),
      label: String(form.get("label") || ""),
      description: String(form.get("description") || "") || null,
      is_active: form.get("is_active") === "on" ? 1 : 0,
    });
    event.currentTarget.reset();
  };
  const togglePermission = (permissionKey: string) => {
    const next = selectedAccessPermissions.includes(permissionKey)
      ? selectedAccessPermissions.filter((key) => key !== permissionKey)
      : [...selectedAccessPermissions, permissionKey];
    onUpdateRoleAccess(selectedAccessRole, next);
  };
  return (
    <section className="settings-page">
      {error && <div className="auth-error">{error}</div>}
      {activeTab === "users" && (
        <div className="iam-page">
          <div className="iam-panel">
            <div className="iam-panel-header">
              <div>
                <h1>Local Users</h1>
                <span>Database users, local passwords, active status, roles, and lockout state.</span>
              </div>
              <strong>{users.length} users</strong>
            </div>
            {loading ? (
              <div className="empty">Loading users...</div>
            ) : (
              <div className="iam-table-wrap">
                <table className="iam-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Provider</th>
                      <th>Status</th>
                      <th>Failed</th>
                      <th>Last Login</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td><strong>{user.display_name}</strong><span>{user.username}</span></td>
                        <td>{roleLabel(user.role)}</td>
                        <td>{user.auth_provider}</td>
                        <td>
                          <mark className={user.is_active ? "status-active" : "status-inactive"}>
                            {user.locked_until ? "Locked" : user.is_active ? "Active" : "Inactive"}
                          </mark>
                        </td>
                        <td>{user.failed_login_count}</td>
                        <td>{formatDateTime(user.last_login_at, preferences)}</td>
                        <td>
                          <div className="iam-row-actions">
                            <button type="button" onClick={() => setEditing(user)} disabled={busy}>Edit</button>
                            <button type="button" onClick={() => setResetting(user)} disabled={busy}>Reset</button>
                            <button
                              type="button"
                              onClick={() => user.is_active ? onDeactivate(user.id) : onUpdate(user.id, { is_active: 1 })}
                              disabled={busy || user.id === currentUserId}
                            >
                              {user.is_active ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <form className="iam-panel iam-form" onSubmit={create}>
            <div className="iam-panel-header"><div><h1>Create Local User</h1><span>For Entra users, first login can still auto-create the user profile.</span></div></div>
            <label>Username<input name="username" required placeholder="username or email" /></label>
            <label>Display name<input name="display_name" required placeholder="Central Geologist" /></label>
            <label>Email<input name="email" type="email" placeholder="user@example.com" /></label>
            <label>Mobile<input name="mobile_number" placeholder="+91..." /></label>
            <label>
              Role
              <select name="role" defaultValue={defaultRole}>
                {roles.filter((role) => role.is_active).map((role) => <option key={role.key} value={role.key}>{role.label}</option>)}
              </select>
            </label>
            <label>Initial password<input name="password" type="password" required minLength={8} /></label>
            <label className="iam-check"><input name="is_active" type="checkbox" defaultChecked /> Active</label>
            <button type="submit" disabled={busy}>Create User</button>
          </form>
        </div>
      )}
      {activeTab === "roles" && (
        <div className="iam-page">
          <div className="iam-panel">
            <div className="iam-panel-header">
              <div><h1>Roles</h1><span>Create customer-specific roles and keep system defaults protected.</span></div>
              <strong>{roles.length} roles</strong>
            </div>
            <div className="role-list">
              {roles.map((role) => (
                <div key={role.key} className="role-card">
                  <div><strong>{role.label}</strong><span>{role.key}</span><small>{role.description}</small></div>
                  <label className="iam-check">
                    <input
                      type="checkbox"
                      checked={Boolean(role.is_active)}
                      disabled={busy || Boolean(role.is_system)}
                      onChange={(event) => onUpdateRole(role.key, { is_active: event.currentTarget.checked ? 1 : 0 })}
                    />
                    Active
                  </label>
                  <mark>{role.is_system ? "System" : "Custom"}</mark>
                </div>
              ))}
            </div>
          </div>
          <form className="iam-panel iam-form" onSubmit={createRoleSubmit}>
            <div className="iam-panel-header"><div><h1>Create Role</h1><span>Role key is stable for access mapping and audit trails.</span></div></div>
            <label>Role key<input name="key" required placeholder="quality_reviewer" /></label>
            <label>Label<input name="label" required placeholder="Quality Reviewer" /></label>
            <label>Description<textarea name="description" rows={4} /></label>
            <label className="iam-check"><input name="is_active" type="checkbox" defaultChecked /> Active</label>
            <button type="submit" disabled={busy}>Create Role</button>
          </form>
        </div>
      )}
      {activeTab === "access" && (
        <div className="iam-page iam-page-single">
          <div className="iam-panel access-panel">
            <div className="iam-panel-header">
              <div><h1>Role Access Mapping</h1><span>Configure role access. Enforcement can be deepened per feature as workflows mature.</span></div>
            </div>
            <div className="access-layout">
              <div className="permission-grid">
                {permissions.map((permission) => (
                  <label key={permission.key} className="permission-card">
                    <input type="checkbox" checked={selectedAccessPermissions.includes(permission.key)} disabled={busy} onChange={() => togglePermission(permission.key)} />
                    <span>{permission.category}</span>
                    <strong>{permission.label}</strong>
                    <small>{permission.description}</small>
                  </label>
                ))}
              </div>
              <aside className="access-role-panel">
                <label>
                  <strong>Role</strong>
                  <select value={selectedAccessRole} onChange={(event) => onAccessRoleChange(event.target.value)}>
                    {roles.map((role) => <option key={role.key} value={role.key}>{role.label}</option>)}
                  </select>
                </label>
                <div>
                  <span>Assigned access</span>
                  <b>{selectedAccessPermissions.length} permissions</b>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
      {activeTab === "quality" && (
        <QualitySettingsPanel
          qualitySettings={qualitySettings}
          loading={loading}
          busy={busy}
          preferences={preferences}
          onSave={onSaveQualitySettings}
          onReset={onResetQualitySettings}
        />
      )}
      {activeTab === "preferences" && (
        <PreferencesSettingsPanel preferences={preferences} busy={busy} onSave={onSavePreferences} />
      )}
      {editing && (
        <UserEditDialog
          user={editing}
          roles={roles}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            onUpdate(editing.id, patch);
            setEditing(null);
          }}
        />
      )}
      {resetting && (
        <ResetPasswordDialog
          user={resetting}
          busy={busy}
          onClose={() => setResetting(null)}
          onSave={(newPassword) => {
            onResetPassword(resetting.id, newPassword);
            setResetting(null);
          }}
        />
      )}
    </section>
  );
}

function cloneQualitySettings(settings: QualitySettingsPayload): QualitySettingsPayload {
  return JSON.parse(JSON.stringify(settings)) as QualitySettingsPayload;
}

function QualitySettingsPanel({
  qualitySettings,
  loading,
  busy,
  preferences,
  onSave,
  onReset,
}: {
  qualitySettings: QualitySettings | undefined;
  loading: boolean;
  busy: boolean;
  preferences: UserPreferences;
  onSave: (settings: QualitySettingsPayload) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState<QualitySettingsPayload | null>(
    () => (qualitySettings ? cloneQualitySettings(qualitySettings.settings) : null),
  );

  useEffect(() => {
    if (qualitySettings) setDraft(cloneQualitySettings(qualitySettings.settings));
  }, [qualitySettings]);

  if (loading && !draft) {
    return (
      <div className="iam-page iam-page-single">
        <div className="iam-panel"><div className="empty">Loading quality rules...</div></div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="iam-page iam-page-single">
        <div className="iam-panel"><div className="empty">Quality rules are not available.</div></div>
      </div>
    );
  }

  const updateRule = (code: string, patch: Partial<QualitySettingsPayload["validation"]["rules"][number]>) => {
    setDraft({
      ...draft,
      validation: {
        ...draft.validation,
        rules: draft.validation.rules.map((rule) => (rule.code === code ? { ...rule, ...patch } : rule)),
      },
    });
  };

  const updateSuggestions = (patch: Partial<QualitySettingsPayload["ai_suggestions"]>) => {
    setDraft({ ...draft, ai_suggestions: { ...draft.ai_suggestions, ...patch } });
  };

  const updateSummary = (patch: Partial<QualitySettingsPayload["ai_summary"]>) => {
    setDraft({ ...draft, ai_summary: { ...draft.ai_summary, ...patch } });
  };

  const toggleInfoCode = (code: string) => {
    const current = draft.ai_suggestions.include_info_codes;
    updateSuggestions({
      include_info_codes: current.includes(code) ? current.filter((item) => item !== code) : [...current, code],
    });
  };

  const infoRules = draft.validation.rules.filter((rule) => rule.severity === "info");

  return (
    <div className="iam-page iam-page-single quality-settings-page">
      <div className="iam-panel quality-settings-panel">
        <div className="iam-panel-header">
          <div>
            <h1>Validation And AI Rules</h1>
            <span>
              Default profile used by validation runs, AI review generation, and AI summary prompts.
            </span>
          </div>
          <strong>{qualitySettings?.updated_at ? formatDateTime(qualitySettings.updated_at, preferences) : "Default"}</strong>
        </div>
        <div className="quality-settings-actions">
          <button type="button" disabled={busy} onClick={() => onSave(draft)}>
            Save Rules
          </button>
          <button type="button" disabled={busy} onClick={onReset}>
            Reset Defaults
          </button>
        </div>
        <div className="quality-settings-grid">
          <section className="quality-card quality-card-wide">
            <div className="quality-card-header">
              <strong>Validation Rules</strong>
              <span>{draft.validation.rules.filter((rule) => rule.enabled).length} enabled</span>
            </div>
            <div className="quality-rule-list">
              {draft.validation.rules.map((rule) => (
                <article key={rule.code} className="quality-rule-row">
                  <label className="iam-check">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      disabled={busy}
                      onChange={(event) => updateRule(rule.code, { enabled: event.currentTarget.checked })}
                    />
                    Enabled
                  </label>
                  <div>
                    <strong>{rule.label}</strong>
                    <span>{rule.description}</span>
                    <code>{rule.code}</code>
                  </div>
                  <select
                    value={rule.severity}
                    disabled={busy || !rule.enabled}
                    onChange={(event) => updateRule(rule.code, { severity: event.target.value })}
                  >
                    <option value="error">Error</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                  </select>
                </article>
              ))}
            </div>
          </section>
          <section className="quality-card">
            <div className="quality-card-header">
              <strong>AI Suggestions</strong>
              <span>Rule based</span>
            </div>
            <label className="iam-check">
              <input
                type="checkbox"
                checked={draft.ai_suggestions.enabled}
                disabled={busy}
                onChange={(event) => updateSuggestions({ enabled: event.currentTarget.checked })}
              />
              Generate rule-based suggestions
            </label>
            <label className="iam-check">
              <input
                type="checkbox"
                checked={draft.ai_suggestions.refresh_validation_before_suggestions}
                disabled={busy}
                onChange={(event) =>
                  updateSuggestions({ refresh_validation_before_suggestions: event.currentTarget.checked })
                }
              />
              Run validation before suggestions
            </label>
            <label className="iam-check">
              <input
                type="checkbox"
                checked={draft.ai_suggestions.group_curve_coverage}
                disabled={busy}
                onChange={(event) => updateSuggestions({ group_curve_coverage: event.currentTarget.checked })}
              />
              Group curve coverage findings
            </label>
            <div className="quality-info-code-list">
              <strong>Info findings allowed as AI suggestions</strong>
              {infoRules.map((rule) => (
                <label key={rule.code} className="iam-check">
                  <input
                    type="checkbox"
                    checked={draft.ai_suggestions.include_info_codes.includes(rule.code)}
                    disabled={busy || !rule.enabled}
                    onChange={() => toggleInfoCode(rule.code)}
                  />
                  {rule.label}
                </label>
              ))}
            </div>
          </section>
          <section className="quality-card">
            <div className="quality-card-header">
              <strong>AI Summary</strong>
              <span>Prompt</span>
            </div>
            <label className="iam-check">
              <input
                type="checkbox"
                checked={draft.ai_summary.use_local_llm_when_available}
                disabled={busy}
                onChange={(event) => updateSummary({ use_local_llm_when_available: event.currentTarget.checked })}
              />
              Use local LLM when available
            </label>
            <div className="quality-number-grid">
              <label>
                Max findings
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={draft.ai_summary.max_rule_findings}
                  disabled={busy}
                  onChange={(event) => updateSummary({ max_rule_findings: Number(event.target.value) })}
                />
              </label>
              <label>
                Max tokens
                <input
                  type="number"
                  min={200}
                  max={2000}
                  step={50}
                  value={draft.ai_summary.max_tokens}
                  disabled={busy}
                  onChange={(event) => updateSummary({ max_tokens: Number(event.target.value) })}
                />
              </label>
              <label>
                Temperature
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={draft.ai_summary.temperature}
                  disabled={busy}
                  onChange={(event) => updateSummary({ temperature: Number(event.target.value) })}
                />
              </label>
            </div>
            <label>
              Approval note
              <textarea
                rows={3}
                value={draft.ai_summary.geologist_approval_note}
                disabled={busy}
                onChange={(event) => updateSummary({ geologist_approval_note: event.target.value })}
              />
            </label>
            <label>
              System prompt
              <textarea
                rows={6}
                value={draft.ai_summary.system_prompt}
                disabled={busy}
                onChange={(event) => updateSummary({ system_prompt: event.target.value })}
              />
            </label>
            <label>
              User prompt template
              <textarea
                rows={6}
                value={draft.ai_summary.user_prompt_template}
                disabled={busy}
                onChange={(event) => updateSummary({ user_prompt_template: event.target.value })}
              />
            </label>
          </section>
        </div>
      </div>
    </div>
  );
}

function UserEditDialog({
  user,
  roles,
  busy,
  onClose,
  onSave,
}: {
  user: User;
  roles: Role[];
  busy: boolean;
  onClose: () => void;
  onSave: (patch: Partial<User>) => void;
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave({
      display_name: String(form.get("display_name") || ""),
      email: String(form.get("email") || "") || null,
      mobile_number: String(form.get("mobile_number") || "") || null,
      role: String(form.get("role") || user.role),
      is_active: form.get("is_active") === "on" ? 1 : 0,
    });
  };
  return (
    <div className="iam-dialog-backdrop" role="dialog" aria-modal="true">
      <form className="iam-dialog" onSubmit={submit}>
        <header>
          <strong>Edit User</strong>
          <button type="button" onClick={onClose}>Close</button>
        </header>
        <label>
          Display name
          <input name="display_name" defaultValue={user.display_name} required />
        </label>
        <label>
          Email
          <input name="email" type="email" defaultValue={user.email ?? ""} />
        </label>
        <label>
          Mobile
          <input name="mobile_number" defaultValue={user.mobile_number ?? ""} />
        </label>
        <label>
          Role
          <select name="role" defaultValue={user.role}>
            {roles.map((role) => (
              <option key={role.key} value={role.key}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
        <label className="iam-check">
          <input name="is_active" type="checkbox" defaultChecked={Boolean(user.is_active)} /> Active
        </label>
        <button type="submit" disabled={busy}>Save User</button>
      </form>
    </div>
  );
}

function ResetPasswordDialog({
  user,
  busy,
  onClose,
  onSave,
}: {
  user: User;
  busy: boolean;
  onClose: () => void;
  onSave: (newPassword: string) => void;
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave(String(form.get("new_password") || ""));
  };
  return (
    <div className="iam-dialog-backdrop" role="dialog" aria-modal="true">
      <form className="iam-dialog" onSubmit={submit}>
        <header>
          <strong>Reset Password</strong>
          <button type="button" onClick={onClose}>Close</button>
        </header>
        <p>{user.display_name} · {user.username}</p>
        <label>
          New password
          <input name="new_password" type="password" required minLength={8} />
        </label>
        <button type="submit" disabled={busy}>Reset Password</button>
      </form>
    </div>
  );
}

function PasswordDialog({
  busy,
  error,
  onClose,
  onSave,
}: {
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (currentPassword: string, newPassword: string) => void;
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave(String(form.get("current_password") || ""), String(form.get("new_password") || ""));
  };
  return (
    <div className="iam-dialog-backdrop" role="dialog" aria-modal="true">
      <form className="iam-dialog" onSubmit={submit}>
        <header>
          <strong>Change Password</strong>
          <button type="button" onClick={onClose}>Close</button>
        </header>
        {error && <div className="auth-error">{error}</div>}
        <label>
          Current password
          <input name="current_password" type="password" required />
        </label>
        <label>
          New password
          <input name="new_password" type="password" required minLength={8} />
        </label>
        <button type="submit" disabled={busy}>Change Password</button>
      </form>
    </div>
  );
}

function formatDateTime(value: string | null, preferences = DEFAULT_USER_PREFERENCES): string {
  return formatDateTimeWithPreferences(value, preferences);
}

function LandingPage({
  boreholes,
  loading,
  activeId,
  selectedBorehole,
  displayChoice,
  onSelect,
  onDisplayChoice,
  onOpen,
  onManageDisplay,
}: LandingPageProps) {
  const active = boreholes.filter((item) => item.workflow_status !== "approved_for_export");
  const historic = boreholes.filter((item) => item.workflow_status === "approved_for_export");
  const totalDepth = boreholes.reduce((sum, item) => sum + item.total_depth, 0);

  return (
    <section className="landing-page">
      <div className="dashboard-column dashboard-column-main">
        <div className="landing-workflow-card dashboard-widget">
          <div className="landing-workflow-title">
            <h1>Borehole Dashboard</h1>
            <span>Configurable dashboard widgets</span>
          </div>
          <div className="dashboard-kpis">
            <DashboardKpi label="Active" value={String(active.length)} />
            <DashboardKpi label="Historic" value={String(historic.length)} />
            <DashboardKpi label="Total depth" value={`${Math.round(totalDepth).toLocaleString()} m`} />
            <DashboardKpi label="Selected" value={selectedBorehole?.code ?? "-"} />
          </div>
        </div>
        {loading && <div className="empty">Loading boreholes...</div>}
        {!loading && (
          <BoreholeGroup
            title="Active Boreholes"
            boreholes={active}
            pageSize={5}
            activeId={activeId}
            onSelect={onSelect}
            onOpen={onOpen}
            onManageDisplay={onManageDisplay}
          />
        )}
      </div>

      <div className="dashboard-column dashboard-column-side">
        <div className="landing-settings workspace-setup-card dashboard-widget">
          <div className="project-default-header">
            <strong>Workspace Setup</strong>
            <span>{selectedBorehole ? selectedBorehole.workflow_status.replaceAll("_", " ") : "Select borehole"}</span>
          </div>
          <label>
            Borehole
            <select
              value={activeId ?? ""}
              onChange={(event) => onSelect(Number(event.target.value))}
            >
              {boreholes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.workflow_status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Display
              <select
                value={displayChoice}
                onChange={(event) => onDisplayChoice(event.target.value as DisplayChoice)}
              >
              <option value="saved">Saved borehole display</option>
              <option value="default">Default correction display</option>
            </select>
          </label>
          <div className="setup-actions">
            <button type="button" disabled={!selectedBorehole} onClick={() => selectedBorehole && onOpen(selectedBorehole.id)}>
              Open Workbench
            </button>
            <button
              type="button"
              disabled={!selectedBorehole}
              onClick={() => selectedBorehole && onManageDisplay(selectedBorehole.id)}
            >
              Manage Display
            </button>
          </div>
        </div>
        {!loading && (
          <BoreholeGroup
            title="Historic Boreholes"
            boreholes={historic}
            pageSize={4}
            activeId={activeId}
            onSelect={onSelect}
            onOpen={onOpen}
            onManageDisplay={onManageDisplay}
          />
        )}
      </div>
    </section>
  );
}

function DashboardKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="dashboard-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function BoreholeGroup({
  title,
  boreholes,
  pageSize,
  activeId,
  onSelect,
  onOpen,
  onManageDisplay,
}: {
  title: string;
  boreholes: BoreholeListItem[];
  pageSize: number;
  activeId: number | null;
  onSelect: (id: number) => void;
  onOpen: (id: number) => void;
  onManageDisplay: (id: number) => void;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(boreholes.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visibleBoreholes = boreholes.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <section className="borehole-group dashboard-widget">
      <div className="borehole-group-header">
        <h2>{title}</h2>
        <div className="borehole-group-tools">
          <span>
            {boreholes.length} boreholes
            {pageCount > 1 ? ` · page ${safePage + 1}/${pageCount}` : ""}
          </span>
          {pageCount > 1 && (
            <span className="pager-buttons">
              <button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                Prev
              </button>
              <button
                type="button"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
              >
                Next
              </button>
            </span>
          )}
        </div>
      </div>
      <div className="borehole-table" role="table" aria-label={title}>
        <div className="borehole-table-head" role="row">
          <span>Project / Site</span>
          <span>Borehole</span>
          <span>Depth</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {visibleBoreholes.map((item) => (
          <div
            key={item.id}
            className={`borehole-row ${item.id === activeId ? "selected" : ""}`}
            onClick={() => onSelect(item.id)}
            onDoubleClick={() => onOpen(item.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(item.id);
              }
            }}
            role="row"
            tabIndex={0}
          >
            <span className="borehole-project" role="cell">
              <span>{item.project_code} / {item.site_code}</span>
              <small>{item.title}</small>
            </span>
            <strong role="cell">{item.code}</strong>
            <b role="cell">{item.total_depth} m</b>
            <em role="cell">{item.workflow_status.replaceAll("_", " ")}</em>
            <span className="borehole-row-actions" role="cell">
              {item.id === activeId && <mark>Selected</mark>}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(item.id);
                }}
              >
                Select
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onManageDisplay(item.id);
                }}
              >
                Manage Display
              </button>
            </span>
          </div>
        ))}
        {!boreholes.length && <div className="empty">No boreholes in this group.</div>}
      </div>
    </section>
  );
}
