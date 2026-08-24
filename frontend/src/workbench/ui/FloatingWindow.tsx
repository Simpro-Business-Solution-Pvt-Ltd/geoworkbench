import { GripHorizontal, X } from "lucide-react";
import { type PointerEvent, type ReactNode, useRef, useState } from "react";

type Props = {
  title: string;
  className?: string;
  defaultPosition?: { x: number; y: number };
  children: ReactNode;
  onClose: () => void;
};

export function FloatingWindow({
  title,
  className = "",
  defaultPosition = { x: 96, y: 108 },
  children,
  onClose,
}: Props) {
  const [position, setPosition] = useState(defaultPosition);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);

  const move = (event: PointerEvent<HTMLElement>) => {
    if (!dragOffset.current) return;
    setPosition({
      x: Math.max(8, Math.min(window.innerWidth - 340, event.clientX - dragOffset.current.x)),
      y: Math.max(62, Math.min(window.innerHeight - 180, event.clientY - dragOffset.current.y)),
    });
  };

  return (
    <section
      className={`floating-window ${className}`}
      style={{ left: position.x, top: position.y }}
      role="dialog"
      aria-modal="false"
      aria-label={title}
    >
      <header
        className="floating-tool-header"
        onPointerDown={(event) => {
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
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
      >
        <GripHorizontal size={15} strokeWidth={2.2} />
        <strong>{title}</strong>
        <button type="button" title="Close" onClick={onClose}>
          <X size={15} strokeWidth={2.2} />
        </button>
      </header>
      {children}
    </section>
  );
}
