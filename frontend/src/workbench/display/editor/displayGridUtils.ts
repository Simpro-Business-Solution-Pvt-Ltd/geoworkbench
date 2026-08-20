import type { Dispatch, SetStateAction } from "react";

import type { DisplayGridItem, DisplayLayout } from "../../../api/types";

export type RglLayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
};

export function moveItem<T>(items: T[], index: number, target: number) {
  const next = [...items];
  if (target < 0 || target >= next.length || target === index) return next;
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

export function clampGridItem(item: DisplayGridItem, columns = 12): DisplayGridItem {
  const width = Math.max(1, Math.min(columns, item.w));
  return {
    ...item,
    w: width,
    x: Math.max(0, Math.min(columns - width, item.x)),
    y: Math.max(0, Math.min(30, item.y)),
    h: Math.max(1, Math.min(12, item.h)),
  };
}

export function toReactGridLayout(items: DisplayGridItem[]): RglLayoutItem[] {
  return items.map((item) => ({
    i: item.widgetId,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: 1,
    minH: 1,
  }));
}

export function commitGridLayout(
  nextLayout: RglLayoutItem[],
  snapshot: DisplayLayout | null,
  setHistory: Dispatch<SetStateAction<DisplayLayout[]>>,
  setDraft: Dispatch<SetStateAction<DisplayLayout | null>>,
) {
  if (snapshot) {
    setHistory((items) => [...items, snapshot]);
  }
  setDraft((current) => {
    if (!current?.settings.grid) return current;
    const byWidgetId = new Map(nextLayout.map((item) => [item.i, item]));
    const columns = current.settings.grid?.columns ?? 12;
    const next = structuredClone(current);
    next.settings.grid!.items = next.settings.grid!.items.map((item) => {
      const updated = byWidgetId.get(item.widgetId);
      return updated
        ? clampGridItem(
            {
              widgetId: item.widgetId,
              x: updated.x,
              y: updated.y,
              w: updated.w,
              h: updated.h,
            },
            columns,
          )
        : item;
    });
    return next;
  });
}
