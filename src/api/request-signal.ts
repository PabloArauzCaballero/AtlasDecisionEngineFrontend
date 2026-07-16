export interface ManagedRequestSignal {
  signal: AbortSignal;
  didTimeout: () => boolean;
  cleanup: () => void;
}

/**
 * Combines an optional caller signal with a request timeout.
 *
 * The returned cleanup function must run after fetch settles so timers and
 * abort listeners do not remain attached longer than necessary.
 */
export function createRequestSignal(
  externalSignal: AbortSignal | undefined,
  timeoutMs: number,
): ManagedRequestSignal {
  const controller = new AbortController();
  let timedOut = false;

  const abortFromCaller = () => {
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal?.aborted) {
    abortFromCaller();
  } else {
    externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException('Request timeout', 'TimeoutError'));
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      globalThis.clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', abortFromCaller);
    },
  };
}
