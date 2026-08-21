import type { BoreholeWorkbench, DisplayLayout } from "../../../api/types";

type RuntimeWidget = NonNullable<DisplayLayout["settings"]["widgets"]>[string];

export function withRuntimeLogWidget(data: BoreholeWorkbench, widgetId: string, widget: RuntimeWidget): BoreholeWorkbench {
  if (widgetId === "log-widget") return data;
  if (!data.layout) return data;
  const layout = structuredClone(data.layout);
  layout.settings.widgets = { ...(layout.settings.widgets ?? {}), "log-widget": widget };
  return { ...data, layout };
}
