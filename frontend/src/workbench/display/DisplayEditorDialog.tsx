import { useEffect, useMemo, useState } from "react";

import type { BoreholeWorkbench, Curve, DisplayGridItem, DisplayLayout, DisplayWidget } from "../../api/types";
import { FloatingWindow } from "../ui/FloatingWindow";
import { defaultGridItem, normalizeDisplayLayout } from "./displayEditorModel";
import { buildDisplayEditorSummary, displayLayoutsEqual } from "./displayEditorState";
import { DisplayGridCanvas } from "./editor/DisplayGridCanvas";
import { clampGridItem } from "./editor/displayGridUtils";
import { WidgetInspector } from "./editor/WidgetInspector";
import { WidgetLibrary } from "./editor/WidgetLibrary";
import { WidgetSettingsDialog } from "./editor/WidgetSettingsDialog";
import { resolveLogWidgetDrop } from "./logWidgetDropResolver";
import { BoreholeExplorer } from "../explorer/BoreholeExplorer";
import type { BoreholeExplorerDragPayload } from "../explorer/boreholeExplorerModel";
import { createWidgetLibraryDragPayload, resolveWidgetLibraryDrop, type WidgetDropPlacement } from "./widgetLibraryDropResolver";
import { createWidgetId } from "./widgetCatalog";

type Props = {
  open: boolean;
  data: BoreholeWorkbench | null;
  layout: DisplayLayout | null;
  availableCurves: Curve[];
  saving: boolean;
  cloning: boolean;
  deleting: boolean;
  resetting: boolean;
  canDelete: boolean;
  loading?: boolean;
  onSave: (layout: DisplayLayout) => void;
  onClone: (layout: DisplayLayout) => void;
  onDelete: (layout: DisplayLayout) => void;
  onReset: () => void;
  onClose: () => void;
};

export function DisplayEditorDialog({
  open,
  data,
  layout,
  availableCurves,
  saving,
  cloning,
  deleting,
  resetting,
  canDelete,
  loading = false,
  onSave,
  onClone,
  onDelete,
  onReset,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<DisplayLayout | null>(null);
  const [history, setHistory] = useState<DisplayLayout[]>([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState("log-widget");
  const [settingsWidgetId, setSettingsWidgetId] = useState<string | null>(null);
  const [widgetLibraryOpen, setWidgetLibraryOpen] = useState(true);
  const [boreholeExplorerOpen, setBoreholeExplorerOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  useEffect(() => {
    if (open && layout) {
      const normalized = normalizeDisplayLayout(layout, availableCurves);
      setDraft(normalized);
      setHistory([]);
      setSelectedWidgetId(normalized.settings.widgets?.["log-widget"] ? "log-widget" : "");
      setSettingsWidgetId(null);
      setWidgetLibraryOpen(true);
      setBoreholeExplorerOpen(false);
      setInspectorOpen(true);
    }
  }, [availableCurves, layout, open]);

  const widgets = draft?.settings.widgets ?? {};
  const gridItems = draft?.settings.grid?.items ?? [];
  const selectedWidget = selectedWidgetId ? widgets[selectedWidgetId] : null;
  const settingsWidget = settingsWidgetId ? widgets[settingsWidgetId] : null;
  const normalizedSourceLayout = useMemo(
    () => (layout ? normalizeDisplayLayout(layout, availableCurves) : null),
    [availableCurves, layout],
  );
  const isDirty = !displayLayoutsEqual(draft, normalizedSourceLayout);
  const summary = buildDisplayEditorSummary(draft);

  if (!open) return null;

  if (!layout || !draft) {
    return (
      <section className="display-editor-page">
        <div className="display-editor-frame">
          <div className="display-editor-header">
            <strong>Display Editor</strong>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
          <div className="display-editor-empty">
            {loading ? "Loading display layout..." : "No display layout is available for this borehole."}
          </div>
        </div>
      </section>
    );
  }

  const updateDraft = (updater: (current: DisplayLayout) => DisplayLayout) => {
    setDraft((current) => {
      if (!current) return current;
      setHistory((items) => [...items, structuredClone(current)]);
      return updater(structuredClone(current));
    });
  };

  const addWidget = (type: string, placement?: WidgetDropPlacement) => {
    updateDraft((current) => {
      const next = normalizeDisplayLayout(current, availableCurves);
      const result = resolveWidgetLibraryDrop(
        next,
        createWidgetLibraryDragPayload(type),
        availableCurves,
        placement,
      );
      if (result.status === "changed") {
        setSelectedWidgetId(result.widgetId);
        return result.layout;
      }
      return next;
    });
  };

  const removeWidget = (widgetId: string) => {
    if (Object.keys(widgets).length <= 1) return;
    updateDraft((current) => {
      delete current.settings.widgets?.[widgetId];
      current.settings.grid!.items = current.settings.grid!.items.filter((item) => item.widgetId !== widgetId);
      if (selectedWidgetId === widgetId) {
        setSelectedWidgetId(current.settings.grid!.items[0]?.widgetId ?? "");
      }
      if (settingsWidgetId === widgetId) {
        setSettingsWidgetId(null);
      }
      return current;
    });
  };

  const cloneWidget = (widgetId: string) => {
    const widget = widgets[widgetId];
    if (!widget) return;
    updateDraft((current) => {
      const existingIds = new Set(Object.keys(current.settings.widgets ?? {}));
      const id = createWidgetId(`${widget.type}-copy`, existingIds);
      current.settings.widgets![id] = {
        ...structuredClone(widget),
        title: `${widget.title} Copy`,
        sourceWidgetId: widgetId,
      };
      current.settings.grid!.items.push(defaultGridItem(id, current.settings.grid!.items.length));
      setSelectedWidgetId(id);
      return current;
    });
  };

  const updateGridItem = (widgetId: string, patch: Partial<DisplayGridItem>) => {
    updateDraft((current) => {
      current.settings.grid!.items = current.settings.grid!.items.map((item) =>
        item.widgetId === widgetId ? clampGridItem({ ...item, ...patch }) : item,
      );
      return current;
    });
  };

  const updateWidget = (widgetId: string, updater: (widget: DisplayWidget) => DisplayWidget) => {
    updateDraft((current) => {
      const widget = current.settings.widgets?.[widgetId];
      if (!widget) return current;
      current.settings.widgets![widgetId] = updater(structuredClone(widget));
      return current;
    });
  };

  const dropExplorerItemOnWidget = (widgetId: string, payload: BoreholeExplorerDragPayload) => {
    if (!data) return;
    updateWidget(widgetId, (widget) => resolveLogWidgetDrop(widget, payload, data).widget);
    setSelectedWidgetId(widgetId);
  };

  const undo = () => {
    setHistory((items) => {
      const previous = items.at(-1);
      if (!previous) return items;
      setDraft(previous);
      return items.slice(0, -1);
    });
  };

  const cancel = () => {
    if (isDirty && !window.confirm("Discard unsaved display changes?")) return;
    setDraft(normalizeDisplayLayout(layout, availableCurves));
    setHistory([]);
    onClose();
  };

  return (
    <section className="display-editor-page">
      <div className="display-editor-frame">
        <div className="display-editor-header">
          <div>
            <strong>Display Editor</strong>
            <span>{draft.name}</span>
          </div>
          <div className="display-editor-summary" aria-label="Display editor summary">
            <span>{summary.widgetCount} widgets</span>
            <span>{summary.logTrackCount} tracks</span>
            <span>{summary.configuredCurveCount} curves</span>
            <span>{summary.gridItemCount} grid items</span>
            <b className={isDirty ? "dirty" : "clean"}>{isDirty ? "Unsaved changes" : "Saved draft"}</b>
            {history.length > 0 && <span>{history.length} undo step{history.length === 1 ? "" : "s"}</span>}
          </div>
          <div className="display-editor-controller">
            <div className="editor-panel-controller" aria-label="Display editor panels">
              <span>Panels</span>
              <button
                className={widgetLibraryOpen ? "editor-action-tool active" : "editor-action-tool"}
                type="button"
                onClick={() => setWidgetLibraryOpen((open) => !open)}
              >
                Library
              </button>
              <button
                className={inspectorOpen ? "editor-action-tool active" : "editor-action-tool"}
                type="button"
                onClick={() => setInspectorOpen((open) => !open)}
              >
                Inspector
              </button>
              <button
                className={boreholeExplorerOpen ? "editor-action-tool active" : "editor-action-tool"}
                type="button"
                disabled={!data}
                onClick={() => setBoreholeExplorerOpen((open) => !open)}
              >
                Explorer
              </button>
            </div>
            <div className="editor-draft-actions">
              <button className="editor-action-secondary" type="button" disabled={!history.length || saving} onClick={undo}>
                Undo
              </button>
              <button className="editor-action-secondary" type="button" disabled={saving} onClick={cancel}>
                Cancel
              </button>
              <button className="editor-action-primary" type="button" disabled={saving || !isDirty} onClick={() => onSave(draft)}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
            <details className="editor-display-actions">
              <summary>Display actions</summary>
              <div>
                <button className="editor-action-secondary" type="button" disabled={cloning || saving} onClick={() => onClone(draft)}>
                  {cloning ? "Cloning..." : "Clone display"}
                </button>
                <button className="editor-action-secondary" type="button" disabled={resetting || saving} onClick={onReset}>
                  {resetting ? "Resetting..." : "Reset default"}
                </button>
                <button
                  className="editor-action-danger"
                  type="button"
                  disabled={!canDelete || deleting || saving}
                  onClick={() => {
                    if (window.confirm(`Delete display "${draft.name}"?`)) onDelete(draft);
                  }}
                >
                  {deleting ? "Deleting..." : "Delete display"}
                </button>
              </div>
            </details>
          </div>
        </div>

        <div className="display-editor-shell">
          <DisplayGridCanvas
            draft={draft}
            gridItems={gridItems}
            widgets={widgets}
            selectedWidgetId={selectedWidgetId}
            saving={saving}
            setHistory={setHistory}
            setDraft={setDraft}
            onSelectWidget={setSelectedWidgetId}
            onOpenWidgetSettings={setSettingsWidgetId}
            onDropWidget={addWidget}
            onDropBoreholeItem={dropExplorerItemOnWidget}
          />
        </div>

        {inspectorOpen && (
          <FloatingWindow
            title="Display Inspector"
            className="display-inspector-window"
            defaultPlacement="center-right"
            onClose={() => setInspectorOpen(false)}
          >
            <aside className="widget-inspector floating-inspector-body">
              <section className="inspector-section">
                <div className="inspector-section-title">
                  <h2>Display Settings</h2>
                  <span>{isDirty ? "Draft not saved" : "Current layout"}</span>
                </div>
                <div className="display-settings-grid">
                  <label className="display-name-field">
                    Display name
                    <input
                      value={draft.name}
                      onChange={(event) =>
                        updateDraft((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Columns
                    <input
                      type="number"
                      min="4"
                      max="24"
                      value={draft.settings.grid?.columns ?? 12}
                      onChange={(event) =>
                        updateDraft((current) => {
                          current.settings.grid!.columns = Number(event.target.value);
                          return current;
                        })
                      }
                    />
                  </label>
                </div>
              </section>

              <section className="inspector-section">
                <div className="inspector-section-title">
                  <h2>Selected Widget</h2>
                  {selectedWidget && <span>{selectedWidget.type}</span>}
                </div>
              {selectedWidget ? (
                <WidgetInspector
                  widgetId={selectedWidgetId}
                  widget={selectedWidget}
                  gridItem={gridItems.find((item) => item.widgetId === selectedWidgetId) ?? null}
                  availableCurves={availableCurves}
                  onOpenSettings={() => setSettingsWidgetId(selectedWidgetId)}
                  onClone={() => cloneWidget(selectedWidgetId)}
                  onRemove={() => removeWidget(selectedWidgetId)}
                  onUpdateGrid={(patch) => updateGridItem(selectedWidgetId, patch)}
                  onUpdateWidget={(updater) => updateWidget(selectedWidgetId, updater)}
                />
              ) : (
                <div className="empty">Select a widget on the display canvas.</div>
              )}
              </section>
            </aside>
          </FloatingWindow>
        )}

        <WidgetLibrary
          open={widgetLibraryOpen}
          onClose={() => setWidgetLibraryOpen(false)}
          onAddWidget={addWidget}
        />

        {data && boreholeExplorerOpen && (
          <BoreholeExplorer data={data} onClose={() => setBoreholeExplorerOpen(false)} />
        )}

        {settingsWidget && (
          <WidgetSettingsDialog
            widgetId={settingsWidgetId!}
            widget={settingsWidget}
            availableCurves={availableCurves}
            onClose={() => setSettingsWidgetId(null)}
            onUpdateWidget={(updater) => updateWidget(settingsWidgetId!, updater)}
          />
        )}
      </div>
    </section>
  );
}
