import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { FloatingWindow } from "../../ui/FloatingWindow";
import {
  createWidgetLibraryDragPayload,
  WIDGET_LIBRARY_DRAG_MIME_TYPE,
  type WidgetDropPlacement,
} from "../widgetLibraryDropResolver";
import { WIDGET_CATALOG } from "../widgetCatalog";

type Props = {
  open: boolean;
  onClose: () => void;
  onAddWidget: (type: string, placement?: WidgetDropPlacement) => void;
};

export function WidgetLibrary({ open, onClose, onAddWidget }: Props) {
  const [query, setQuery] = useState("");
  const items = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return WIDGET_CATALOG.filter((item) => {
      if (!normalized) return true;
      return [item.label, item.category, item.description, item.type].join(" ").toLowerCase().includes(normalized);
    });
  }, [query]);
  const grouped = items.reduce<Record<string, typeof items>>((groups, item) => {
    groups[item.category] = [...(groups[item.category] ?? []), item];
    return groups;
  }, {});

  if (!open) return null;

  return (
    <FloatingWindow
      title="Widget Library"
      className="widget-library-window"
      defaultPlacement="center-left"
      onClose={onClose}
    >
      <div className="widget-library-search">
        <Search size={14} strokeWidth={2.1} />
        <input value={query} placeholder="Search widgets" onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="widget-library-list">
        {Object.entries(grouped).map(([category, group]) => (
          <section key={category} className="widget-library-group">
            <strong>{category}</strong>
            <div className="widget-library-items">
              {group.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  draggable
                  title={item.description}
                  onClick={() => onAddWidget(item.type)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(WIDGET_LIBRARY_DRAG_MIME_TYPE, JSON.stringify(createWidgetLibraryDragPayload(item.type)));
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  <span>{item.icon}</span>
                  <small>{item.label}</small>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </FloatingWindow>
  );
}
