import { useEffect, useState } from 'react';

/**
 * Locates `selector` in the DOM and tracks its bounding rect. The target may not
 * exist yet right after a route change while the new page's client bundle mounts,
 * so this both retries briefly AND watches the DOM with a MutationObserver — that
 * safety net catches an element that appears later than the retry budget (common
 * on slow machines), instead of giving up and stranding the spotlight. Returns
 * null while unresolved so the overlay can degrade to a centered tooltip.
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

    const measure = (): boolean => {
      const element = document.querySelector(selector);
      if (element) {
        setRect(element.getBoundingClientRect());
        return true;
      }
      return false;
    };

    // Watch the DOM only UNTIL the target appears, however late it mounts; once
    // found, disconnect — the resize/scroll handlers keep the rect fresh — so the
    // observer never churns on unrelated mutations for the rest of the step.
    const observer = new MutationObserver(() => {
      if (!cancelled && measure()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const tryMeasure = () => {
      if (cancelled) return;
      if (measure()) {
        observer.disconnect();
        return;
      }
      attempts += 1;
      if (attempts < 30) retryTimer = setTimeout(tryMeasure, 100);
    };
    tryMeasure();

    const onViewportChange = () => measure();
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      observer.disconnect();
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [selector]);

  return rect;
}
