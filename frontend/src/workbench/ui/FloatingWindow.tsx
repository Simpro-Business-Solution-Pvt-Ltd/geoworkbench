import { GripHorizontal, Minus, Square, X } from "lucide-react";
import { type PointerEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";

type Props = {
  title: string;
  className?: string;
  defaultPosition?: { x: number; y: number };
  defaultPlacement?: "center" | "center-left" | "center-right";
  children: ReactNode;
  onClose: () => void;
};

let floatingWindowZIndex = 90;
const SAFE_MARGIN = 12;
const TOP_MARGIN = 68;

export function FloatingWindow({
  title,
  className = "",
  defaultPosition,
  defaultPlacement = "center",
  children,
  onClose,
}: Props) {
  const windowRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState(() => defaultPosition ?? estimatePlacement(defaultPlacement));
  const [collapsed, setCollapsed] = useState(false);
  const [zIndex, setZIndex] = useState(() => floatingWindowZIndex);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);
  const placedOnce = useRef(false);

  const bringToFront = () => {
    floatingWindowZIndex += 1;
    setZIndex(floatingWindowZIndex);
  };

  const move = (event: PointerEvent<HTMLElement>) => {
    if (!dragOffset.current) return;
    setPosition(clampPosition({ x: event.clientX - dragOffset.current.x, y: event.clientY - dragOffset.current.y }, windowRef.current));
  };

  const isInteractiveTarget = (target: EventTarget | null) =>
    target instanceof HTMLElement && Boolean(target.closest("button,input,select,textarea,a"));

  useLayoutEffect(() => {
    if (placedOnce.current) return;
    placedOnce.current = true;
    setPosition((current) => {
      const measuredPlacement = defaultPosition ?? positionForPlacement(defaultPlacement, windowRef.current);
      return clampPosition(measuredPlacement, windowRef.current);
    });
  }, [defaultPlacement, defaultPosition]);

  useEffect(() => {
    const resize = () => setPosition((current) => clampPosition(current, windowRef.current));
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <section
      ref={windowRef}
      className={`floating-window ${collapsed ? "collapsed" : ""} ${className}`}
      style={{ left: position.x, top: position.y, zIndex }}
      role="dialog"
      aria-modal="false"
      aria-label={title}
      onPointerDown={bringToFront}
    >
      <header
        className="floating-tool-header"
        onPointerDown={(event) => {
          if (isInteractiveTarget(event.target)) return;
          const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
          dragOffset.current = {
            x: event.clientX - (bounds?.left ?? position.x),
            y: event.clientY - (bounds?.top ?? position.y),
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={move}
        onPointerUp={(event) => {
          dragOffset.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      >
        <GripHorizontal size={15} strokeWidth={2.2} />
        <strong onDoubleClick={() => setCollapsed((value) => !value)}>{title}</strong>
        <button
          type="button"
          title={collapsed ? "Expand" : "Collapse"}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <Square size={13} strokeWidth={2.2} /> : <Minus size={15} strokeWidth={2.2} />}
        </button>
        <button type="button" title="Close" onPointerDown={(event) => event.stopPropagation()} onClick={onClose}>
          <X size={15} strokeWidth={2.2} />
        </button>
      </header>
      {!collapsed && children}
    </section>
  );
}

function estimatePlacement(placement: NonNullable<Props["defaultPlacement"]>) {
  return positionForPlacement(placement, null);
}

function positionForPlacement(placement: NonNullable<Props["defaultPlacement"]>, element: HTMLElement | null) {
  const width = element?.offsetWidth || 420;
  const height = element?.offsetHeight || 520;
  const viewportWidth = window.innerWidth || 1280;
  const viewportHeight = window.innerHeight || 720;
  const centerX = viewportWidth / 2 - width / 2;
  const placementX =
    placement === "center-left"
      ? viewportWidth * 0.38 - width / 2
      : placement === "center-right"
        ? viewportWidth * 0.62 - width / 2
        : centerX;
  const preferredY = Math.min(Math.max(TOP_MARGIN, viewportHeight * 0.14), Math.max(TOP_MARGIN, viewportHeight - height - SAFE_MARGIN));
  return clampPosition({ x: placementX, y: preferredY }, element, width, height);
}

function clampPosition(
  position: { x: number; y: number },
  element: HTMLElement | null,
  measuredWidth = element?.offsetWidth || 340,
  measuredHeight = element?.offsetHeight || 180,
) {
  const maxX = Math.max(SAFE_MARGIN, (window.innerWidth || 1280) - measuredWidth - SAFE_MARGIN);
  const maxY = Math.max(TOP_MARGIN, (window.innerHeight || 720) - measuredHeight - SAFE_MARGIN);
  return {
    x: Math.max(SAFE_MARGIN, Math.min(maxX, position.x)),
    y: Math.max(TOP_MARGIN, Math.min(maxY, position.y)),
  };
}
