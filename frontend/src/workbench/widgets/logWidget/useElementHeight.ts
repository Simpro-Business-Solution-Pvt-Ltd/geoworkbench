import { useLayoutEffect, useState, type RefObject } from "react";

export function useElementHeight(ref: RefObject<HTMLElement | null>, fallback: number) {
  const [height, setHeight] = useState(fallback);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const update = () => {
      setHeight(Math.max(1, element.clientHeight || fallback));
    };

    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fallback, ref]);

  return height;
}
