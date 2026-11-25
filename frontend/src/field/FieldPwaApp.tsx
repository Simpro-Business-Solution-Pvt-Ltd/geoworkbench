import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { checkFieldInterval, type FieldIntervalCheck, type FieldName } from "./fieldIntervalValidation";
import {
  deviceCaptureMetadata,
  isConnectionError,
  isQuotaExceededError,
  newClientSubmissionId,
  newOutboxItem,
  outboxCapacityWarning,
  readOutbox,
  writeOutbox,
  type OutboxItem,
} from "./fieldOutbox";
import {
  listPhotoQueue,
  photoLabel,
  queuePhoto,
  removePhotoItem,
  setPhotoItemState,
  type PhotoQueueItem,
} from "./fieldPhotoQueue";
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
  WifiOff,
} from "lucide-react";
import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createMobileBorehole,
  getCurrentSession,
  isUnauthorizedError,
  listBoreholes,
  listSourceFiles,
  login,
  logout,
  setAuthToken,
  startEntraLogin,
  submitMobileFieldData,
  uploadMobileFile,
} from "../api/client";
import type { AuthSession, BoreholeListItem, MobileFieldSubmissionCreate, MobileRuntimeParameter } from "../api/types";
import { queryKeys } from "../api/queryKeys";
import { appBranding } from "../branding/appBranding";

type FieldTheme = "light" | "dark";
type FieldStep = "borehole" | "interval" | "attachments";
/** An upload still in progress (or failed) in this session; finished files are read from the server. */
type UploadStatus = { key: string; boreholeId: number; name: string; status: string; fileType: string };

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
  // Intervals waiting to be sent, kept on the device so a reload or closed app loses nothing.
  const [outbox, setOutbox] = useState<OutboxItem[]>(() => readOutbox(window.localStorage));
  // Photos waiting to be uploaded, persisted in IndexedDB so they survive reloads and
  // closed tabs too (blobs do not fit in localStorage).
  const [photos, setPhotos] = useState<PhotoQueueItem[]>([]);
  const [photoQueueReady, setPhotoQueueReady] = useState(false);
  const [storageFull, setStorageFull] = useState(false);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const flushing = useRef(false);
  const flushingPhotos = useRef(false);

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
      void queryClient.invalidateQueries({ queryKey: queryKeys.fieldAuthSession });
    }
    if (error) {
      setAuthToken(null);
      setLoginError(error);
    }
    window.history.replaceState({}, document.title, `${window.location.origin}/field`);
  }, [queryClient]);

  useEffect(() => {
    try {
      writeOutbox(window.localStorage, outbox);
      setStorageFull(false);
    } catch (error) {
      if (isQuotaExceededError(error)) {
        setStorageFull(true);
        setStatus("Device storage is full — the latest saved item may not persist. Send or discard saved items.");
      }
    }
  }, [outbox]);

  const refreshStorageWarning = useCallback(async () => {
    if (outboxCapacityWarning(readOutbox(window.localStorage))) {
      setStorageWarning(outboxCapacityWarning(readOutbox(window.localStorage)));
      return;
    }
    try {
      const estimate = await navigator.storage?.estimate?.();
      if (estimate && estimate.quota && estimate.usage !== undefined && estimate.usage / estimate.quota > 0.8) {
        setStorageWarning("Device storage is nearly full. Saved photos and intervals may not persist; send or discard items.");
        return;
      }
    } catch {
      // estimate() unsupported; the outbox soft limit still applies
    }
    setStorageWarning(null);
  }, []);

  useEffect(() => {
    let active = true;
    void listPhotoQueue()
      .then((items) => {
        if (!active) return;
        setPhotos(items);
        setPhotoQueueReady(true);
        void refreshStorageWarning();
      })
      .catch(() => {
        if (active) setPhotoQueueReady(true);
      });
    return () => {
      active = false;
    };
  }, [refreshStorageWarning]);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (selectedBoreholeId) window.localStorage.setItem(SELECTED_FIELD_BOREHOLE_KEY, String(selectedBoreholeId));
    else window.localStorage.removeItem(SELECTED_FIELD_BOREHOLE_KEY);
  }, [selectedBoreholeId]);

  const sessionQuery = useQuery({ queryKey: queryKeys.fieldAuthSession, queryFn: getCurrentSession, retry: false, staleTime: 0 });
  const boreholes = useQuery({ queryKey: queryKeys.boreholes, queryFn: listBoreholes, enabled: Boolean(session), staleTime: 30_000 });

  useEffect(() => {
    if (sessionQuery.data) setSession(sessionQuery.data);
    if (sessionQuery.isError && isUnauthorizedError(sessionQuery.error)) {
      setSession(null);
      setAuthToken(null);
    }
  }, [sessionQuery.data, sessionQuery.error, sessionQuery.isError]);

  const selectedBorehole = useMemo(
    () => boreholes.data?.find((item) => item.id === selectedBoreholeId) ?? null,
    [boreholes.data, selectedBoreholeId],
  );

  // Checked as the geologist types, so mistakes are fixed at the rig, not at central review.
  const intervalCheck = useMemo(
    () =>
      checkFieldInterval({ fromDepth, toDepth, lithologyCode, recovery, recoveryPercent, rqd, currentDepth }),
    [fromDepth, toDepth, lithologyCode, recovery, recoveryPercent, rqd, currentDepth],
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.boreholes });
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.boreholes });
    },
    onError: (error) => setStatus(error instanceof Error ? error.message : "Borehole creation failed"),
  });

  const buildIntervalPayload = (): MobileFieldSubmissionCreate => {
    const capture = deviceCaptureMetadata();
    return {
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
            // Entered as a percentage; the system stores RQD as a fraction (65 % -> 0.65).
            rqd: percentToFraction(rqd),
            logged_color: emptyToNull(loggedColor),
            structural_features: emptyToNull(structuralFeatures),
            remark: emptyToNull(remarks),
          },
        ],
        runtime_parameters: runtimeParameters.filter((item) => item.name.trim() && item.value.trim()),
        remarks: emptyToNull(remarks),
        payload: { client: "field-pwa", captured_at: capture.device_captured_at },
        apply_to_log: true,
        // Stable per attempt: if the upload is interrupted and the device resends, the
        // server recognizes the same outbox item and returns the original submission.
        client_submission_id: newClientSubmissionId(),
        device_captured_at: capture.device_captured_at,
        device_timezone: capture.device_timezone,
    };
  };

  const refreshAfterSync = useCallback(
    (boreholeId: number) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.boreholes });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workbench(boreholeId).slice(0, 2) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiSummary(boreholeId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.exportReadiness(boreholeId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.correlationAiRoot });
    },
    [queryClient],
  );

  const queueInterval = (payload: MobileFieldSubmissionCreate) => {
    setOutbox((current) => [...current, newOutboxItem(payload, selectedBorehole?.code ?? null)]);
    setStatus("No connection. Interval saved on this device; it will send automatically when the connection returns.");
  };

  // Send waiting intervals oldest first. Each leaves the outbox only once the server confirms it.
  // Replays are idempotent on the server (same client_submission_id), so an interrupted
  // upload can never duplicate the interval.
  const flushOutbox = useCallback(async () => {
    if (flushing.current || !navigator.onLine) return;
    const waiting = readOutbox(window.localStorage).filter((item) => item.state === "waiting");
    if (!waiting.length) return;
    flushing.current = true;
    let sent = 0;
    let flagged = 0;
    try {
      for (const item of waiting) {
        try {
          const result = await submitMobileFieldData(item.payload);
          sent += 1;
          if (result.validation_issue_count > 0) flagged += 1;
          setOutbox((current) => current.filter((entry) => entry.id !== item.id));
          refreshAfterSync(item.boreholeId);
        } catch (error) {
          if (isUnauthorizedError(error)) {
            // Session expired mid-flush: nothing is lost, items stay saved until sign-in again.
            setOutbox((current) =>
              current.map((entry) => (entry.id === item.id ? { ...entry, lastError: "Sign-in expired" } : entry)),
            );
            setSession(null);
            setAuthToken(null);
            setStatus("Sign-in expired. Your saved items stay on this device; sign in again to finish sending.");
            return;
          }
          if (isConnectionError(error, navigator.onLine)) break;
          const reason = error instanceof Error ? error.message : "Rejected by the server";
          setOutbox((current) =>
            current.map((entry) => (entry.id === item.id ? { ...entry, state: "rejected", lastError: reason } : entry)),
          );
        }
      }
    } finally {
      flushing.current = false;
      if (sent) {
        setStatus(
          flagged
            ? `Connection back: ${sent} saved interval${sent === 1 ? "" : "s"} sent, but the server flagged ${flagged} with validation issue${flagged === 1 ? "" : "s"} — review on the workbench.`
            : `Connection back: ${sent} saved interval${sent === 1 ? "" : "s"} sent.`,
        );
      }
    }
  }, [refreshAfterSync]);

  useEffect(() => {
    if (session && online) void flushOutbox();
  }, [session, online, flushOutbox]);



  const submitIntervalMutation = useMutation({
    // "always": fail at once when offline so the interval goes to the device outbox,
    // instead of waiting in memory where a reload would lose it.
    networkMode: "always",
    mutationFn: (payload: MobileFieldSubmissionCreate) => submitMobileFieldData(payload),
    onMutate: () => setStatus("Syncing interval..."),
    onSuccess: (result) => {
      let message = result.message;
      if (result.validation_issue_count > 0) {
        message = `${message} Server flagged ${result.validation_issue_count} validation issue${result.validation_issue_count === 1 ? "" : "s"} (for example overlapping intervals) — review on the workbench.`;
      }
      if (result.device_captured_at && result.server_received_at) {
        message = `${message} Captured ${formatTimestamp(result.device_captured_at)}${result.device_timezone ? ` ${result.device_timezone}` : ""}, received ${formatTimestamp(result.server_received_at)}.`;
      }
      setStatus(message);
      setActiveStep("attachments");
      void queryClient.invalidateQueries({ queryKey: queryKeys.boreholes });
      if (selectedBoreholeId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workbench(selectedBoreholeId).slice(0, 2) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.aiSummary(selectedBoreholeId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.exportReadiness(selectedBoreholeId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.correlationAiRoot });
      }
    },
    onError: (error, payload) => {
      if (isConnectionError(error, navigator.onLine)) {
        queueInterval(payload);
        return;
      }
      setStatus(error instanceof Error ? error.message : "Interval sync failed");
    },
  });

  const syncInterval = () => {
    const payload = buildIntervalPayload();
    if (!navigator.onLine) {
      queueInterval(payload);
      return;
    }
    submitIntervalMutation.mutate(payload);
  };

  // The borehole's files as stored on the server, so the list survives reloads and other devices.
  const attachments = useQuery({
    queryKey: ["field-attachments", selectedBoreholeId],
    queryFn: () => listSourceFiles(selectedBoreholeId as number),
    enabled: Boolean(session) && Boolean(selectedBoreholeId),
    staleTime: 10_000,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, fileType, boreholeId }: { file: File; fileType: string; boreholeId: number; key: string }) =>
      uploadMobileFile({ borehole_id: boreholeId, file_type: fileType, file }),
    onMutate: ({ file, fileType, boreholeId, key }) => {
      setStatus(
        navigator.onLine
          ? `Uploading ${file.name}...`
          : `No connection. ${file.name} will upload when the connection returns. Keep the app open: files are not stored on the device.`,
      );
      setUploads((current) => [{ key, boreholeId, name: file.name, fileType, status: "uploading" }, ...current]);
    },
    onSuccess: (result, { key, boreholeId }) => {
      setStatus(`${result.original_name} uploaded`);
      // Done: drop the in-progress row; the server list now shows the file.
      setUploads((current) => current.filter((item) => item.key !== key));
      void queryClient.invalidateQueries({ queryKey: ["field-attachments", boreholeId] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.boreholes });
    },
    onError: (error, { key }) => {
      setStatus(error instanceof Error ? error.message : "Upload failed");
      setUploads((current) => current.map((item) => (item.key === key ? { ...item, status: "failed" } : item)));
    },
  });

  // Photos go through the device queue first, so a capture made offline (or while the
  // upload is interrupted) is kept on the device and retried, not lost.
  const queuePhotoForBorehole = (file: File) => {
    void queuePhoto({ boreholeId: selectedBoreholeId, boreholeCode: selectedBorehole?.code ?? null, file })
      .then((item) => {
        setPhotos((current) => [...current, item].sort((a, b) => a.queuedAt.localeCompare(b.queuedAt)));
        setStatus(
          navigator.onLine
            ? `Saved ${file.name} — uploading...`
            : `No connection. ${file.name} saved on this device; it will upload when the connection returns.`,
        );
        void refreshStorageWarning();
      })
      .catch(() => {
        setStatus(`Could not save ${file.name} on this device (storage may be full). Try again after freeing space.`);
      });
  };

  const flushPhotoQueue = useCallback(async () => {
    if (flushingPhotos.current || !navigator.onLine) return;
    const waiting = photos.filter((item) => item.state === "waiting");
    if (!waiting.length) return;
    flushingPhotos.current = true;
    let sent = 0;
    try {
      for (const item of waiting) {
        try {
          await uploadMobileFile({
            borehole_id: item.boreholeId,
            file_type: item.fileType,
            file: new File([item.file], item.name, { type: item.file.type }),
          });
          sent += 1;
          await removePhotoItem(item.id);
          setPhotos((current) => current.filter((entry) => entry.id !== item.id));
          void queryClient.invalidateQueries({ queryKey: ["field-attachments", item.boreholeId] });
          void queryClient.invalidateQueries({ queryKey: queryKeys.boreholes });
        } catch (error) {
          if (isUnauthorizedError(error)) {
            await setPhotoItemState(item.id, "waiting", "Sign-in expired");
            setSession(null);
            setAuthToken(null);
            setStatus("Sign-in expired. Saved photos stay on this device; sign in again to finish uploading.");
            return;
          }
          if (isConnectionError(error, navigator.onLine)) break;
          const reason = error instanceof Error ? error.message : "Upload rejected by the server";
          await setPhotoItemState(item.id, "rejected", reason);
          setPhotos((current) =>
            current.map((entry) => (entry.id === item.id ? { ...entry, state: "rejected", lastError: reason } : entry)),
          );
        }
      }
    } finally {
      flushingPhotos.current = false;
      if (sent) setStatus(`${sent} saved photo${sent === 1 ? "" : "s"} uploaded.`);
      void refreshStorageWarning();
    }
  }, [photos, queryClient, refreshStorageWarning]);

  useEffect(() => {
    if (session && online && photoQueueReady) void flushPhotoQueue();
  }, [session, online, photoQueueReady, flushPhotoQueue]);

  const discardPhoto = (id: string) => {
    void (async () => {
      if (!window.confirm("Discard this photo? It was not saved on the server.")) return;
      await removePhotoItem(id);
      setPhotos((current) => current.filter((entry) => entry.id !== id));
      void refreshStorageWarning();
    })();
  };

  const uploadToSelectedBorehole = ({ file, fileType }: { file: File; fileType: string }) => {
    if (!selectedBoreholeId) {
      setStatus("Select a borehole before uploading.");
      return;
    }
    if (fileType === "corebox_image") {
      queuePhotoForBorehole(file);
      return;
    }
    uploadMutation.mutate({ file, fileType, boreholeId: selectedBoreholeId, key: `${Date.now()}-${file.name}` });
  };

  const pendingUploads = uploads.filter((item) => item.boreholeId === selectedBoreholeId);
  const pendingPhotos = photos.filter((item) => item.boreholeId === selectedBoreholeId);
  const storedFiles = attachments.data ?? [];
  const waitingCount =
    outbox.filter((item) => item.state === "waiting").length +
    photos.filter((item) => item.state === "waiting").length;

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
            {waitingCount > 0 && (
              <p className="field-warning">
                {waitingCount} saved item{waitingCount === 1 ? "" : "s"} on this device (intervals
                {photos.some((photo) => photo.state === "waiting") ? " and photos" : ""}) will send after you sign in.
              </p>
            )}
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
          <button className="field-icon-button" type="button" onClick={() => {
            void queryClient.invalidateQueries();
            void flushOutbox();
          }}>
            <RefreshCw size={17} />
          </button>
          <button className="field-icon-button" type="button" onClick={() => logoutMutation.mutate()}>
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <section className={`field-status${online ? "" : " offline"}`}>
        {online ? <CheckCircle2 size={18} /> : <WifiOff size={18} />}
        <div>
          <strong>{status}</strong>
          <span>
            {session.user.display_name || session.user.username}
            {!online && " · Offline: new intervals and photos are saved on this device"}
            {waitingCount > 0 && ` · ${waitingCount} waiting to send`}
          </span>
        </div>
      </section>

      {storageFull && <p className="field-error">Device storage is full — saved items may not persist. Send or discard items now.</p>}
      {!storageFull && storageWarning && <p className="field-warning">{storageWarning}</p>}

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
              <input
                inputMode="decimal"
                value={fromDepth}
                aria-invalid={Boolean(intervalCheck.errors.fromDepth)}
                onChange={(event) => setFromDepth(event.target.value)}
              />
              <FieldMessage check={intervalCheck} name="fromDepth" />
            </label>
            <label>
              To depth
              <input
                inputMode="decimal"
                value={toDepth}
                aria-invalid={Boolean(intervalCheck.errors.toDepth)}
                onChange={(event) => setToDepth(event.target.value)}
              />
              <FieldMessage check={intervalCheck} name="toDepth" />
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
              <input
                inputMode="decimal"
                value={recovery}
                aria-invalid={Boolean(intervalCheck.errors.recovery)}
                onChange={(event) => setRecovery(event.target.value)}
              />
              <FieldMessage check={intervalCheck} name="recovery" />
            </label>
            <label>
              Recovery %
              <input
                inputMode="decimal"
                value={recoveryPercent}
                aria-invalid={Boolean(intervalCheck.errors.recoveryPercent)}
                onChange={(event) => setRecoveryPercent(event.target.value)}
              />
              <FieldMessage check={intervalCheck} name="recoveryPercent" />
            </label>
            <label>
              RQD %
              <input
                inputMode="decimal"
                value={rqd}
                aria-invalid={Boolean(intervalCheck.errors.rqd)}
                onChange={(event) => setRqd(event.target.value)}
              />
              <FieldMessage check={intervalCheck} name="rqd" />
            </label>
            <label>
              Current depth
              <input
                inputMode="decimal"
                value={currentDepth}
                aria-invalid={Boolean(intervalCheck.errors.currentDepth)}
                onChange={(event) => setCurrentDepth(event.target.value)}
              />
              <FieldMessage check={intervalCheck} name="currentDepth" />
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

          <OutboxPanel
            items={outbox}
            online={online}
            onSendNow={() => void flushOutbox()}
            onDiscard={(id) => setOutbox((current) => current.filter((item) => item.id !== id))}
          />
          <SyncBlockers check={intervalCheck} boreholeSelected={Boolean(selectedBoreholeId)} />
          <button
            className="field-primary"
            type="button"
            disabled={!selectedBoreholeId || !intervalCheck.canSync || submitIntervalMutation.isPending}
            onClick={syncInterval}
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
            <UploadButton label="Excel" fileType="excel" accept=".xlsx,.xls,.csv" onUpload={uploadToSelectedBorehole} />
            <UploadButton label="LAS" fileType="las" accept=".las" onUpload={uploadToSelectedBorehole} />
            <UploadButton label="PDF" fileType="geophysical_pdf" accept=".pdf" onUpload={uploadToSelectedBorehole} />
            <UploadButton label="Image" fileType="corebox_image" accept="image/*" onUpload={uploadToSelectedBorehole} />
            <UploadButton label="Camera" fileType="corebox_image" accept="image/*" capture="environment" onUpload={uploadToSelectedBorehole} />
          </div>
          <div className="field-upload-list">
            {!selectedBoreholeId && <p>Select a borehole to see and add its attachments.</p>}
            {selectedBoreholeId && attachments.isLoading && <p>Loading attachments...</p>}
            {selectedBoreholeId && attachments.isError && <p>Could not load attachments. Tap refresh to try again.</p>}
            {selectedBoreholeId && attachments.isSuccess && !storedFiles.length && !pendingUploads.length && (
              <p>No attachments on {selectedBorehole?.code ?? "this borehole"} yet.</p>
            )}
            {pendingUploads.map((upload) => (
              <div key={upload.key}>
                <FileUp size={16} />
                <span>{upload.name}</span>
                <b>{upload.fileType}</b>
                <em>{upload.status}</em>
              </div>
            ))}
            {pendingPhotos.map((photo) => (
              <div key={photo.id} className={`field-outbox-item ${photo.state}`}>
                <span>
                  <b>{photoLabel(photo)}</b>
                </span>
                <small>
                  Captured {formatTimestamp(photo.capturedAt)}
                  {photo.capturedAtTz ? ` ${photo.capturedAtTz}` : ""}
                  {online ? " · uploading now" : " · will upload when the connection returns"}
                </small>
                <em>
                  {photo.state === "rejected"
                    ? `Not accepted: ${photo.lastError ?? "upload error"}`
                    : "saved on this device"}
                </em>
                {photo.state === "rejected" && (
                  <button type="button" className="field-small-button" onClick={() => discardPhoto(photo.id)}>
                    Discard
                  </button>
                )}
              </div>
            ))}
            {storedFiles.map((file) => (
              <div key={file.id}>
                <FileUp size={16} />
                <span>{file.original_name}</span>
                <b>{file.file_type}</b>
                <em>{file.status}</em>
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

function OutboxPanel({
  items,
  online,
  onSendNow,
  onDiscard,
}: {
  items: OutboxItem[];
  online: boolean;
  onSendNow: () => void;
  onDiscard: (id: string) => void;
}) {
  if (!items.length) return null;
  const waiting = items.filter((item) => item.state === "waiting").length;
  return (
    <div className="field-outbox" role="status">
      <div className="field-outbox-heading">
        <strong>
          Waiting to send ({items.length})
        </strong>
        <button type="button" className="field-small-button" disabled={!online || !waiting} onClick={onSendNow}>
          Send now
        </button>
      </div>
      <small>
        {online
          ? "Saved on this device. Sending automatically."
          : "Saved on this device. Will send automatically when the connection returns."}
      </small>
      {items.map((item) => (
        <div key={item.id} className={`field-outbox-item ${item.state}`}>
          <span>
            <b>{item.label}</b> · {item.boreholeCode ?? `borehole ${item.boreholeId}`}
          </span>
          <small>
            Captured {formatTimestamp(item.payload.device_captured_at ?? item.queuedAt)}
            {item.payload.device_timezone ? ` ${item.payload.device_timezone}` : ""}
          </small>
          <em>
            {item.state === "rejected"
              ? `Not accepted: ${item.lastError ?? "server error"}`
              : item.lastError && item.lastError === "Sign-in expired"
                ? "waiting — sign-in expired"
                : "waiting"}
          </em>
          {item.state === "rejected" && (
            <button
              type="button"
              className="field-small-button"
              onClick={() => {
                if (window.confirm(`Discard ${item.label}? It was not saved on the server.`)) onDiscard(item.id);
              }}
            >
              Discard
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function FieldMessage({ check, name }: { check: FieldIntervalCheck; name: FieldName }) {
  const error = check.errors[name];
  const warning = check.warnings[name];
  if (error) return <small className="field-check error">{error}</small>;
  if (warning) return <small className="field-check warning">{warning}</small>;
  return null;
}

/** Says why "Sync interval" is disabled, so the button never just does nothing. */
function SyncBlockers({ check, boreholeSelected }: { check: FieldIntervalCheck; boreholeSelected: boolean }) {
  const reasons: string[] = [];
  if (!boreholeSelected) reasons.push("Select a borehole on the Borehole step.");
  if (check.missing.length) reasons.push(`Still needed: ${check.missing.join(", ")}.`);
  if (Object.keys(check.errors).length) reasons.push("Fix the fields marked in red.");
  if (!reasons.length) return null;
  return (
    <div className="field-sync-blockers" role="status">
      {reasons.map((reason) => (
        <span key={reason}>{reason}</span>
      ))}
    </div>
  );
}

function percentToFraction(value: string): number | null {
  const percent = toNumber(value);
  return percent === null ? null : percent / 100;
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

/** Human-readable timestamp in the viewer's timezone, e.g. for "captured 9:30 AM, received 9:35 AM". */
function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { hour12: false });
}
