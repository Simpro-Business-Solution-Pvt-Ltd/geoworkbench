import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  CloudUpload,
  FileUp,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  Smartphone,
  Sun,
} from "lucide-react";
import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  createMobileBorehole,
  getCurrentSession,
  listBoreholes,
  login,
  logout,
  setAuthToken,
  startEntraLogin,
  submitMobileFieldData,
  uploadMobileFile,
} from "../api/client";
import type { AuthSession, BoreholeListItem, MobileRuntimeParameter } from "../api/types";
import { appBranding } from "../branding/appBranding";

type FieldTheme = "light" | "dark";
type FieldStep = "borehole" | "interval" | "attachments";
type UploadStatus = { name: string; status: string; fileType: string };

const FIELD_THEME_KEY = "geoworkbench.field.theme";
const SELECTED_FIELD_BOREHOLE_KEY = "geoworkbench.field.selectedBorehole";

export function FieldPwaApp() {
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState<FieldTheme>(
    () => (window.localStorage.getItem(FIELD_THEME_KEY) as FieldTheme | null) ?? "light",
  );
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [username, setUsername] = useState("field");
  const [password, setPassword] = useState("");
  const [selectedBoreholeId, setSelectedBoreholeId] = useState<number | null>(() => {
    const stored = window.localStorage.getItem(SELECTED_FIELD_BOREHOLE_KEY);
    return stored ? Number(stored) : null;
  });
  const [activeStep, setActiveStep] = useState<FieldStep>("borehole");
  const [status, setStatus] = useState("Ready");
  const [uploads, setUploads] = useState<UploadStatus[]>([]);

  const [projectCode, setProjectCode] = useState("RELIANCE-COAL");
  const [projectName, setProjectName] = useState("Reliance Coal Data");
  const [siteCode, setSiteCode] = useState("MGCA");
  const [boreholeCode, setBoreholeCode] = useState("");
  const [totalDepth, setTotalDepth] = useState("");
  const [currentDepth, setCurrentDepth] = useState("");
  const [coordinateSystem, setCoordinateSystem] = useState("UTM / Coalgrid");
  const [utmEasting, setUtmEasting] = useState("");
  const [utmNorthing, setUtmNorthing] = useState("");
  const [reducedLevel, setReducedLevel] = useState("");
  const [waterLevel, setWaterLevel] = useState("");

  const [fromDepth, setFromDepth] = useState("");
  const [toDepth, setToDepth] = useState("");
  const [lithologyCode, setLithologyCode] = useState("COAL");
  const [lithologyLabel, setLithologyLabel] = useState("Coal");
  const [seamName, setSeamName] = useState("");
  const [recovery, setRecovery] = useState("");
  const [recoveryPercent, setRecoveryPercent] = useState("");
  const [rqd, setRqd] = useState("");
  const [loggedColor, setLoggedColor] = useState("");
  const [structuralFeatures, setStructuralFeatures] = useState("");
  const [remarks, setRemarks] = useState("");
  const [runtimeParameters, setRuntimeParameters] = useState<MobileRuntimeParameter[]>([
    { name: "Water level", value: "", unit: "m" },
    { name: "Drilling status", value: "", unit: "" },
  ]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.accent = "red";
    window.localStorage.setItem(FIELD_THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("auth_token");
    const error = params.get("auth_error");
    if (!token && !error) return;
    if (token) {
      setAuthToken(token);
      setLoginError(null);
      queryClient.invalidateQueries({ queryKey: ["fieldAuthSession"] });
    }
    if (error) {
      setAuthToken(null);
      setLoginError(error);
    }
    window.history.replaceState({}, document.title, `${window.location.origin}/field`);
  }, [queryClient]);

  useEffect(() => {
    if (selectedBoreholeId) window.localStorage.setItem(SELECTED_FIELD_BOREHOLE_KEY, String(selectedBoreholeId));
    else window.localStorage.removeItem(SELECTED_FIELD_BOREHOLE_KEY);
  }, [selectedBoreholeId]);

  const sessionQuery = useQuery({ queryKey: ["fieldAuthSession"], queryFn: getCurrentSession, retry: false });
  const boreholes = useQuery({ queryKey: ["boreholes"], queryFn: listBoreholes, enabled: Boolean(session) });

  useEffect(() => {
    if (sessionQuery.data) setSession(sessionQuery.data);
    if (sessionQuery.isError) {
      setSession(null);
      setAuthToken(null);
    }
  }, [sessionQuery.data, sessionQuery.isError]);

  const selectedBorehole = useMemo(
    () => boreholes.data?.find((item) => item.id === selectedBoreholeId) ?? null,
    [boreholes.data, selectedBoreholeId],
  );

  const loginMutation = useMutation({
    mutationFn: () => login(username.trim(), password),
    onMutate: () => {
      setLoginError(null);
      setStatus("Signing in...");
    },
    onSuccess: (token) => {
      setAuthToken(token.token);
      setSession({ user: token.user, expires_at: token.expires_at, client_type: "field-pwa" });
      setPassword("");
      setStatus("Signed in");
      queryClient.invalidateQueries({ queryKey: ["boreholes"] });
    },
    onError: (error) => {
      setLoginError(error instanceof Error ? error.message : "Sign in failed");
      setStatus("Sign in failed");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      setAuthToken(null);
      setSession(null);
      setSelectedBoreholeId(null);
      queryClient.clear();
    },
  });

  const createBoreholeMutation = useMutation({
    mutationFn: () =>
      createMobileBorehole({
        project_code: projectCode.trim() || "RELIANCE-COAL",
        project_name: projectName.trim() || "Reliance Coal Data",
        site_code: siteCode.trim() || "FIELD",
        borehole_code: boreholeCode.trim(),
        title: boreholeCode.trim() ? `${boreholeCode.trim()} field borehole` : null,
        total_depth: toNumber(totalDepth) ?? 0,
        current_depth: toNumber(currentDepth),
        state: null,
        coordinate_system: coordinateSystem.trim() || null,
        utm_easting: toNumber(utmEasting),
        utm_northing: toNumber(utmNorthing),
        reduced_level: toNumber(reducedLevel),
        water_level: toNumber(waterLevel),
      }),
    onMutate: () => setStatus("Creating borehole..."),
    onSuccess: (result) => {
      setSelectedBoreholeId(result.borehole.id);
      setStatus(result.message);
      setActiveStep("interval");
      queryClient.invalidateQueries({ queryKey: ["boreholes"] });
    },
    onError: (error) => setStatus(error instanceof Error ? error.message : "Borehole creation failed"),
  });

  const submitIntervalMutation = useMutation({
    mutationFn: () =>
      submitMobileFieldData({
        borehole_id: selectedBoreholeId as number,
        submission_type: "field_pwa_interval",
        submitted_by: session?.user.display_name ?? session?.user.username ?? "field-pwa",
        status: "synced",
        current_depth: toNumber(currentDepth) ?? toNumber(toDepth),
        lithology_intervals: [
          {
            from_depth: toNumber(fromDepth) ?? 0,
            to_depth: toNumber(toDepth) ?? 0,
            lithology_code: emptyToNull(lithologyCode),
            lithology_label: emptyToNull(lithologyLabel),
            seam_name: emptyToNull(seamName),
            recovery: toNumber(recovery),
            recovery_percent: toNumber(recoveryPercent),
            rqd: toNumber(rqd),
            logged_color: emptyToNull(loggedColor),
            structural_features: emptyToNull(structuralFeatures),
            remark: emptyToNull(remarks),
          },
        ],
        runtime_parameters: runtimeParameters.filter((item) => item.name.trim() && item.value.trim()),
        remarks: emptyToNull(remarks),
        payload: { client: "field-pwa", captured_at: new Date().toISOString() },
        apply_to_log: true,
      }),
    onMutate: () => setStatus("Syncing interval..."),
    onSuccess: (result) => {
      setStatus(result.message);
      setActiveStep("attachments");
      queryClient.invalidateQueries({ queryKey: ["boreholes"] });
      if (selectedBoreholeId) queryClient.invalidateQueries({ queryKey: ["workbench", selectedBoreholeId] });
    },
    onError: (error) => setStatus(error instanceof Error ? error.message : "Interval sync failed"),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, fileType }: { file: File; fileType: string }) =>
      uploadMobileFile({ borehole_id: selectedBoreholeId, file_type: fileType, file }),
    onMutate: ({ file, fileType }) => {
      setStatus(`Uploading ${file.name}...`);
      setUploads((current) => [{ name: file.name, fileType, status: "uploading" }, ...current]);
    },
    onSuccess: (result) => {
      setStatus(`${result.original_name} uploaded`);
      setUploads((current) =>
        current.map((item) =>
          item.name === result.original_name ? { ...item, fileType: result.file_type, status: result.status } : item,
        ),
      );
      queryClient.invalidateQueries({ queryKey: ["boreholes"] });
    },
    onError: (error) => setStatus(error instanceof Error ? error.message : "Upload failed"),
  });

  if (!session) {
    return (
      <main className="field-shell field-login-shell">
        <section className="field-login-card">
          <div className="field-brand">
            <img src={appBranding.customerLogoSrc} alt={appBranding.customerName} />
            <span>{appBranding.productName} Field</span>
          </div>
          <div className="field-login-title">
            <Smartphone size={28} />
            <div>
              <h1>Field capture</h1>
              <p>Mobile interval, runtime data, and evidence sync.</p>
            </div>
          </div>
          <form onSubmit={(event) => submitLogin(event, loginMutation.mutate)} className="field-form">
            <label>
              Username
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
            </label>
            <label>
              Password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
              />
            </label>
            {loginError && <p className="field-error">{loginError}</p>}
            <button className="field-primary" type="submit" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Signing in..." : "Sign in"}
              <ChevronRight size={18} />
            </button>
            <button className="field-secondary" type="button" onClick={() => startEntraLogin("/field")}>
              Sign in with Entra ID
            </button>
          </form>
          <button className="field-icon-toggle" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="field-shell">
      <header className="field-topbar">
        <div className="field-brand compact">
          <img src={appBranding.customerLogoSrc} alt={appBranding.customerName} />
          <span>Field</span>
        </div>
        <div className="field-topbar-actions">
          <button className="field-icon-button" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button className="field-icon-button" type="button" onClick={() => queryClient.invalidateQueries()}>
            <RefreshCw size={17} />
          </button>
          <button className="field-icon-button" type="button" onClick={() => logoutMutation.mutate()}>
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <section className="field-status">
        <CheckCircle2 size={18} />
        <div>
          <strong>{status}</strong>
          <span>{session.user.display_name || session.user.username}</span>
        </div>
      </section>

      <nav className="field-steps" aria-label="Field workflow">
        {(["borehole", "interval", "attachments"] as FieldStep[]).map((step) => (
          <button key={step} className={activeStep === step ? "active" : ""} type="button" onClick={() => setActiveStep(step)}>
            {step}
          </button>
        ))}
      </nav>

      {activeStep === "borehole" && (
        <section className="field-card">
          <div className="field-card-heading">
            <h2>Borehole</h2>
            <span>{boreholes.data?.length ?? 0} available</span>
          </div>
          <label>
            Selected borehole
            <select
              value={selectedBoreholeId ?? ""}
              onChange={(event) => setSelectedBoreholeId(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">Choose borehole</option>
              {(boreholes.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.total_depth.toFixed(0)}m
                </option>
              ))}
            </select>
          </label>
          {selectedBorehole && <BoreholeMiniCard borehole={selectedBorehole} />}

          <div className="field-divider" />
          <div className="field-card-heading">
            <h2>Create borehole</h2>
            <span>site draft</span>
          </div>
          <div className="field-grid two">
            <label>
              Project code
              <input value={projectCode} onChange={(event) => setProjectCode(event.target.value)} />
            </label>
            <label>
              Site code
              <input value={siteCode} onChange={(event) => setSiteCode(event.target.value)} />
            </label>
          </div>
          <label>
            Project name
            <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
          </label>
          <label>
            Borehole code
            <input value={boreholeCode} onChange={(event) => setBoreholeCode(event.target.value)} placeholder="MGCA-FIELD-01" />
          </label>
          <div className="field-grid two">
            <label>
              Total depth
              <input inputMode="decimal" value={totalDepth} onChange={(event) => setTotalDepth(event.target.value)} />
            </label>
            <label>
              Current depth
              <input inputMode="decimal" value={currentDepth} onChange={(event) => setCurrentDepth(event.target.value)} />
            </label>
          </div>
          <label>
            Coordinate system
            <input value={coordinateSystem} onChange={(event) => setCoordinateSystem(event.target.value)} />
          </label>
          <div className="field-grid two">
            <label>
              UTM easting
              <input inputMode="decimal" value={utmEasting} onChange={(event) => setUtmEasting(event.target.value)} />
            </label>
            <label>
              UTM northing
              <input inputMode="decimal" value={utmNorthing} onChange={(event) => setUtmNorthing(event.target.value)} />
            </label>
            <label>
              RL
              <input inputMode="decimal" value={reducedLevel} onChange={(event) => setReducedLevel(event.target.value)} />
            </label>
            <label>
              Water level
              <input inputMode="decimal" value={waterLevel} onChange={(event) => setWaterLevel(event.target.value)} />
            </label>
          </div>
          <button
            className="field-primary"
            type="button"
            disabled={!boreholeCode.trim() || createBoreholeMutation.isPending}
            onClick={() => createBoreholeMutation.mutate()}
          >
            <Plus size={18} />
            Create borehole
          </button>
        </section>
      )}

      {activeStep === "interval" && (
        <section className="field-card">
          <div className="field-card-heading">
            <h2>Interval</h2>
            <span>{selectedBorehole?.code ?? "no borehole"}</span>
          </div>
          <div className="field-grid two">
            <label>
              From depth
              <input inputMode="decimal" value={fromDepth} onChange={(event) => setFromDepth(event.target.value)} />
            </label>
            <label>
              To depth
              <input inputMode="decimal" value={toDepth} onChange={(event) => setToDepth(event.target.value)} />
            </label>
            <label>
              Lithology code
              <input value={lithologyCode} onChange={(event) => setLithologyCode(event.target.value)} />
            </label>
            <label>
              Lithology label
              <input value={lithologyLabel} onChange={(event) => setLithologyLabel(event.target.value)} />
            </label>
            <label>
              Seam
              <input value={seamName} onChange={(event) => setSeamName(event.target.value)} />
            </label>
            <label>
              Logged color
              <input value={loggedColor} onChange={(event) => setLoggedColor(event.target.value)} />
            </label>
            <label>
              Recovery
              <input inputMode="decimal" value={recovery} onChange={(event) => setRecovery(event.target.value)} />
            </label>
            <label>
              Recovery %
              <input inputMode="decimal" value={recoveryPercent} onChange={(event) => setRecoveryPercent(event.target.value)} />
            </label>
            <label>
              RQD
              <input inputMode="decimal" value={rqd} onChange={(event) => setRqd(event.target.value)} />
            </label>
            <label>
              Current depth
              <input inputMode="decimal" value={currentDepth} onChange={(event) => setCurrentDepth(event.target.value)} />
            </label>
          </div>
          <label>
            Structural features
            <textarea value={structuralFeatures} onChange={(event) => setStructuralFeatures(event.target.value)} rows={2} />
          </label>
          <label>
            Remarks
            <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={3} />
          </label>

          <div className="field-card-heading inline">
            <h2>Runtime parameters</h2>
            <button className="field-small-button" type="button" onClick={() => setRuntimeParameters((items) => [...items, { name: "", value: "", unit: "" }])}>
              <Plus size={15} />
              Add
            </button>
          </div>
          {runtimeParameters.map((parameter, index) => (
            <div className="field-runtime-row" key={index}>
              <input
                placeholder="Parameter"
                value={parameter.name}
                onChange={(event) => updateRuntimeParameter(index, "name", event.target.value, setRuntimeParameters)}
              />
              <input
                placeholder="Value"
                value={parameter.value}
                onChange={(event) => updateRuntimeParameter(index, "value", event.target.value, setRuntimeParameters)}
              />
              <input
                placeholder="Unit"
                value={parameter.unit ?? ""}
                onChange={(event) => updateRuntimeParameter(index, "unit", event.target.value, setRuntimeParameters)}
              />
            </div>
          ))}

          <button
            className="field-primary"
            type="button"
            disabled={!selectedBoreholeId || !fromDepth || !toDepth || submitIntervalMutation.isPending}
            onClick={() => submitIntervalMutation.mutate()}
          >
            <CloudUpload size={18} />
            Sync interval
          </button>
        </section>
      )}

      {activeStep === "attachments" && (
        <section className="field-card">
          <div className="field-card-heading">
            <h2>Attachments</h2>
            <span>{selectedBorehole?.code ?? "select borehole"}</span>
          </div>
          <div className="field-upload-grid">
            <UploadButton label="Excel" fileType="excel" accept=".xlsx,.xls,.csv" onUpload={uploadMutation.mutate} />
            <UploadButton label="LAS" fileType="las" accept=".las" onUpload={uploadMutation.mutate} />
            <UploadButton label="PDF" fileType="geophysical_pdf" accept=".pdf" onUpload={uploadMutation.mutate} />
            <UploadButton label="Image" fileType="corebox_image" accept="image/*" onUpload={uploadMutation.mutate} />
            <UploadButton label="Camera" fileType="corebox_image" accept="image/*" capture="environment" onUpload={uploadMutation.mutate} />
          </div>
          <div className="field-upload-list">
            {uploads.length === 0 && <p>No attachments uploaded in this session.</p>}
            {uploads.map((upload, index) => (
              <div key={`${upload.name}-${index}`}>
                <FileUp size={16} />
                <span>{upload.name}</span>
                <b>{upload.fileType}</b>
                <em>{upload.status}</em>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function submitLogin(event: FormEvent, submit: () => void) {
  event.preventDefault();
  submit();
}

function UploadButton({
  label,
  fileType,
  accept,
  capture,
  onUpload,
}: {
  label: string;
  fileType: string;
  accept: string;
  capture?: "user" | "environment";
  onUpload: (payload: { file: File; fileType: string }) => void;
}) {
  const id = `field-upload-${fileType}-${label.toLowerCase()}`;
  return (
    <label className="field-upload-button" htmlFor={id}>
      {label === "Camera" ? <Camera size={20} /> : <FileUp size={20} />}
      <span>{label}</span>
      <input
        id={id}
        type="file"
        accept={accept}
        capture={capture}
        onChange={(event) => handleFileChange(event, fileType, onUpload)}
      />
    </label>
  );
}

function handleFileChange(
  event: ChangeEvent<HTMLInputElement>,
  fileType: string,
  onUpload: (payload: { file: File; fileType: string }) => void,
) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  onUpload({ file, fileType });
}

function BoreholeMiniCard({ borehole }: { borehole: BoreholeListItem }) {
  return (
    <div className="field-borehole-card">
      <strong>{borehole.code}</strong>
      <span>{borehole.project_code} / {borehole.site_code}</span>
      <small>{borehole.total_depth.toFixed(1)}m total depth</small>
    </div>
  );
}

function updateRuntimeParameter(
  index: number,
  key: keyof MobileRuntimeParameter,
  value: string,
  setRuntimeParameters: Dispatch<SetStateAction<MobileRuntimeParameter[]>>,
) {
  setRuntimeParameters((items) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
}

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
