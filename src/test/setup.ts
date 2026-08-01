import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

/**
 * El plazo por omisión de `findBy*`/`waitFor` es de 1 s, medido en reloj de pared. Con las
 * 60+ suites corriendo a la vez, una espera perfectamente sana —montar el componente,
 * resolver la consulta simulada, repintar— puede pasar de ese segundo por pura contención
 * de CPU, y la suite falla por la carga de la máquina y no por el código. Eso es lo peor
 * que puede hacer un gate: enseñar a desconfiar de sus propios fallos.
 *
 * Subirlo no puede convertir un fallo real en un aprobado; sólo evita declarar el fallo
 * antes de tiempo. Lo único que cuesta es que una espera que de verdad no se cumple tarda
 * más en informarse.
 */
configure({ asyncUtilTimeout: 5_000 });

/**
 * jsdom debería exponer `localStorage`, pero el `localStorage` experimental de
 * Node (que queda `undefined` sin `--localstorage-file`) lo tapa tanto en el
 * global como en `window`. Sin esto, cualquier test que use almacenamiento del
 * navegador revienta con "Cannot read properties of undefined". Se instala un
 * polyfill en memoria y se limpia entre tests.
 */
function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
}

function storageWorks(candidate: unknown): boolean {
  try {
    return typeof (candidate as Storage | undefined)?.setItem === 'function';
  } catch {
    return false;
  }
}

if (!storageWorks(globalThis.localStorage)) {
  const memory = memoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memory });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: memory });
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  try {
    globalThis.localStorage?.clear();
  } catch {
    /* noop */
  }
});
