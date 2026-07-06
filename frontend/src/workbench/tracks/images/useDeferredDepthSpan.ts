import { useEffect, useState } from "react";

import type { DepthSpan } from "../../core/depthDomain";

export function useDeferredDepthSpan(visibleDepthSpan: DepthSpan, delayMs: number): DepthSpan {
  const [deferredDepthSpan, setDeferredDepthSpan] = useState(visibleDepthSpan);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDeferredDepthSpan(visibleDepthSpan);
    }, delayMs);

    return () => window.clearTimeout(timeout);
  }, [delayMs, visibleDepthSpan]);

  return deferredDepthSpan;
}
