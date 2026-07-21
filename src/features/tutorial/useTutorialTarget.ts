import { useEffect, useState } from 'react';

/**
 * Locates `selector` in the DOM and tracks its bounding rect, retrying briefly
 * (the target may not exist yet right after a route change while the new page's
 * client bundle mounts) and re-measuring on resize/scroll. Returns null while
 * unresolved so the overlay can degrade to a centered, un-anchored tooltip.
 */
export function useTutorialTarget(selector: string | undefined): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    let cancelled = false;
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const measure = () => {
      const element = document.querySelector(selector);
      if (element) {
        setRect(element.getBoundingClientRect());
        return true;
      }
      return false;
    };

    const tryMeasure = () => {
      if (cancelled) return;
      if (measure()) return;
      attempts += 1;
      if (attempts < 20) retryTimer = setTimeout(tryMeasure, 100);
      else setRect(null);
    };
    tryMeasure();

    const onViewportChange = () => measure();
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [selector]);

  return rect;
}
