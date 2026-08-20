import { useEffect, useState } from "react";

import {
  DEFAULT_USER_PREFERENCES,
  formatDateTimeWithPreferences,
  normalizeUserPreferences,
  type UserPreferences,
} from "../preferences/userPreferences";

type Props = {
  preferences: UserPreferences;
  busy: boolean;
  onSave: (preferences: UserPreferences) => void;
};

export function PreferencesSettingsPanel({ preferences, busy, onSave }: Props) {
  const [draft, setDraft] = useState<UserPreferences>(() => normalizeUserPreferences(preferences));

  useEffect(() => {
    setDraft(normalizeUserPreferences(preferences));
  }, [preferences]);

  const patch = (next: Partial<UserPreferences>) => setDraft((current) => normalizeUserPreferences({ ...current, ...next }));

  return (
    <div className="iam-page iam-page-single quality-settings-page">
      <div className="iam-panel quality-settings-panel">
        <div className="iam-panel-header">
          <div>
            <h1>Units And Preferences</h1>
            <span>Controls how depths, measurements, coordinates, dates, and numbers are displayed in workspaces.</span>
          </div>
          <strong>{draft.timezone}</strong>
        </div>
        <div className="quality-settings-actions">
          <button type="button" disabled={busy} onClick={() => onSave(draft)}>
            Save Preferences
          </button>
          <button type="button" disabled={busy} onClick={() => setDraft(DEFAULT_USER_PREFERENCES)}>
            Reset Defaults
          </button>
        </div>
        <div className="quality-settings-grid">
          <section className="quality-card">
            <div className="quality-card-header">
              <strong>Unit Set</strong>
              <span>{draft.unitSystem.replaceAll("_", " ")}</span>
            </div>
            <label>
              Unit system
              <select value={draft.unitSystem} onChange={(event) => patch({ unitSystem: event.target.value as UserPreferences["unitSystem"] })}>
                <option value="mining_metric">Mining metric</option>
                <option value="metric">Metric</option>
                <option value="imperial">Imperial</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label>
              Depth unit
              <select value={draft.depthUnit} onChange={(event) => patch({ depthUnit: event.target.value as UserPreferences["depthUnit"] })}>
                <option value="m">Meter</option>
                <option value="ft">Feet</option>
              </select>
            </label>
            <label>
              Length unit
              <select value={draft.lengthUnit} onChange={(event) => patch({ lengthUnit: event.target.value as UserPreferences["lengthUnit"] })}>
                <option value="m">Meter</option>
                <option value="cm">Centimeter</option>
                <option value="mm">Millimeter</option>
                <option value="ft">Feet</option>
                <option value="in">Inch</option>
              </select>
            </label>
          </section>
          <section className="quality-card">
            <div className="quality-card-header">
              <strong>Special Units</strong>
              <span>Curves keep source units</span>
            </div>
            <label>
              Coordinate unit
              <select value={draft.coordinateUnit} onChange={(event) => patch({ coordinateUnit: event.target.value as UserPreferences["coordinateUnit"] })}>
                <option value="m">Meter</option>
                <option value="ft">Feet</option>
              </select>
            </label>
            <label>
              Density unit
              <select value={draft.densityUnit} onChange={(event) => patch({ densityUnit: event.target.value as UserPreferences["densityUnit"] })}>
                <option value="g/cc">g/cc</option>
                <option value="kg/m3">kg/m3</option>
              </select>
            </label>
          </section>
          <section className="quality-card">
            <div className="quality-card-header">
              <strong>Time And Format</strong>
              <span>{formatDateTimeWithPreferences(new Date().toISOString(), draft)}</span>
            </div>
            <label>
              Timezone
              <input value={draft.timezone} onChange={(event) => patch({ timezone: event.target.value })} />
            </label>
            <label>
              Date format
              <select value={draft.dateFormat} onChange={(event) => patch({ dateFormat: event.target.value as UserPreferences["dateFormat"] })}>
                <option value="locale">Locale</option>
                <option value="iso">ISO</option>
              </select>
            </label>
            <label>
              Number format
              <select value={draft.numberFormat} onChange={(event) => patch({ numberFormat: event.target.value as UserPreferences["numberFormat"] })}>
                <option value="en-IN">English India</option>
                <option value="en-US">English US</option>
              </select>
            </label>
          </section>
        </div>
      </div>
    </div>
  );
}
