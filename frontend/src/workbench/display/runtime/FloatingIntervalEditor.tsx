import type { PointerEvent } from "react";
import { useRef, useState } from "react";

import type { LithologyInterval } from "../../../api/types";

type Props = {
  interval: LithologyInterval;
  intervalSaving: boolean;
  onClose: () => void;
  onSaveInterval: (patch: Partial<LithologyInterval>) => void;
};

export function FloatingIntervalEditor({ interval, intervalSaving, onClose, onSaveInterval }: Props) {
  const [position, setPosition] = useState({ x: 520, y: 96 });
  const dragOffset = useRef<{ x: number; y: number } | null>(null);

  const startDrag = (event: PointerEvent<HTMLElement>) => {
    if (event.target instanceof HTMLElement && event.target.closest("button,input,select,textarea,a")) return;
    dragOffset.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const drag = (event: PointerEvent<HTMLElement>) => {
    if (!dragOffset.current) return;
    const nextX = Math.max(12, Math.min(window.innerWidth - 380, event.clientX - dragOffset.current.x));
    const nextY = Math.max(72, Math.min(window.innerHeight - 180, event.clientY - dragOffset.current.y));
    setPosition({ x: nextX, y: nextY });
  };

  const stopDrag = (event: PointerEvent<HTMLElement>) => {
    dragOffset.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <aside className="floating-interval-editor" style={{ left: position.x, top: position.y }}>
      <header
        className="floating-interval-editor-header"
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <div>
          <strong>Correction edit</strong>
          <span>
            {interval.from_depth} m - {interval.to_depth} m · {interval.lithology_code ?? "interval"}
          </span>
        </div>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
          aria-label="Close correction editor"
        >
          x
        </button>
      </header>
      <form
        key={interval.id}
        className="edit-form floating-edit-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          onSaveInterval({
            from_depth: parseOptionalNumber(form.get("from_depth")),
            to_depth: parseOptionalNumber(form.get("to_depth")),
            lithology_code: String(form.get("lithology_code")),
            lithology_label: String(form.get("lithology_label")),
            logged_color: String(form.get("logged_color") || ""),
            seam_name: String(form.get("seam_name") || ""),
            recovery: parseOptionalNumber(form.get("recovery")),
            recovery_percent: parseOptionalNumber(form.get("recovery_percent")),
            rqd: parseOptionalPercent(form.get("rqd_percent")),
            structural_features: String(form.get("structural_features") || ""),
            remark: String(form.get("remark") || ""),
          });
        }}
      >
        <div className="edit-form-grid">
          <label>
            From depth
            <input name="from_depth" defaultValue={interval.from_depth} inputMode="decimal" />
          </label>
          <label>
            To depth
            <input name="to_depth" defaultValue={interval.to_depth} inputMode="decimal" />
          </label>
          <label>
            Lithology code
            <input name="lithology_code" defaultValue={interval.lithology_code ?? ""} />
          </label>
          <label>
            Lithology label
            <input name="lithology_label" defaultValue={interval.lithology_label} />
          </label>
          <label>
            Logged color
            <input name="logged_color" defaultValue={interval.logged_color ?? ""} />
          </label>
          <label>
            Seam
            <input name="seam_name" defaultValue={interval.seam_name ?? ""} />
          </label>
          <label>
            Recovery m
            <input name="recovery" defaultValue={interval.recovery ?? ""} inputMode="decimal" />
          </label>
          <label>
            Recovery %
            <input name="recovery_percent" defaultValue={interval.recovery_percent ?? ""} inputMode="decimal" />
          </label>
          <label>
            RQD %
            <input
              name="rqd_percent"
              defaultValue={interval.rqd !== null ? Math.round(interval.rqd * 100) : ""}
              inputMode="decimal"
            />
          </label>
        </div>
        <label>
          Structural features
          <textarea name="structural_features" defaultValue={interval.structural_features ?? ""} />
        </label>
        <label>
          Remarks
          <textarea name="remark" defaultValue={interval.remark ?? ""} />
        </label>
        <div className="floating-editor-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={intervalSaving}>
            {intervalSaving ? "Saving..." : "Save correction"}
          </button>
        </div>
      </form>
    </aside>
  );
}

function parseOptionalNumber(value: FormDataEntryValue | null): number | undefined {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalPercent(value: FormDataEntryValue | null): number | undefined {
  const parsed = parseOptionalNumber(value);
  return parsed === undefined ? undefined : parsed / 100;
}
