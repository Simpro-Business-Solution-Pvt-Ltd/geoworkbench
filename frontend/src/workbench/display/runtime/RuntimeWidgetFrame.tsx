import type { ReactNode } from "react";

export function RuntimeWidgetFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <div className="runtime-widget-header">
        <strong>{title}</strong>
      </div>
      <div className="runtime-widget-body">{children}</div>
    </>
  );
}
