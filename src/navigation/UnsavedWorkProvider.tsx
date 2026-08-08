'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * Trabajo empezado y sin enviar, y la guarda que evita perderlo al navegar.
 *
 * ## Dónde se pierde de verdad
 *
 * Medido en el navegador, no supuesto. Cambiar de pestaña —de «Consola» a
 * «Panel de control», o de un worker al otro— **no pierde nada**: `Tabs`
 * mantiene montadas las pestañas visitadas y sólo las oculta. Salir de la ruta
 * por el cajón sí pierde: el componente se desmonta y con él el texto escrito,
 * el archivo elegido y el formulario a medias.
 *
 * Por eso la guarda va en la NAVEGACIÓN y no en las pestañas. Un aviso que salta
 * al cambiar de pestaña interrumpiría sin que hubiera nada que perder, y un
 * aviso que interrumpe sin motivo se aprende a descartar sin leerlo — que es
 * justo lo que lo dejaría inútil el día que sí avise de algo.
 *
 * ## Qué cuenta como trabajo
 *
 * Lo declara cada vista con `useUnsavedWork(hayTrabajo, descripción)`. No se
 * infiere de que un campo esté tocado: un formulario con un radio marcado por
 * omisión no es trabajo, y avisar por eso sería el mismo error de arriba.
 */

interface UnsavedWorkContextValue {
  /** Descripciones de lo que hay sin enviar ahora mismo. Vacío = nada que perder. */
  readonly pendientes: readonly string[];
  registrar: (id: string, descripcion: string | null) => void;
}

const UnsavedWorkContext = createContext<UnsavedWorkContextValue | null>(null);

export function UnsavedWorkProvider({ children }: { children: ReactNode }) {
  const [registro, setRegistro] = useState<Record<string, string>>({});

  const registrar = useCallback((id: string, descripcion: string | null) => {
    setRegistro((previo) => {
      if (descripcion === null) {
        if (!(id in previo)) return previo;
        const siguiente = { ...previo };
        delete siguiente[id];
        return siguiente;
      }
      if (previo[id] === descripcion) return previo;
      return { ...previo, [id]: descripcion };
    });
  }, []);

  const pendientes = useMemo(() => Object.values(registro), [registro]);

  /*
   * Cerrar la pestaña del navegador o recargar no pasa por `NavLink`, así que
   * necesita su propio aviso. El texto lo escribe el navegador —no se puede
   * personalizar desde hace años— y sólo aparece si el usuario ha interactuado
   * con la página, que es exactamente el caso que interesa.
   */
  useEffect(() => {
    if (pendientes.length === 0) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [pendientes.length]);

  const value = useMemo(() => ({ pendientes, registrar }), [pendientes, registrar]);
  return <UnsavedWorkContext.Provider value={value}>{children}</UnsavedWorkContext.Provider>;
}

/**
 * Lo que hay sin enviar, para quien tenga que preguntarlo antes de navegar.
 *
 * Devuelve una lista vacía si no hay proveedor: la guarda es una red de
 * seguridad, y una vista montada fuera del portal —una prueba unitaria, por
 * ejemplo— no debe romperse por no tenerla.
 */
export function useUnsavedWorkGuard(): readonly string[] {
  return useContext(UnsavedWorkContext)?.pendientes ?? [];
}

/**
 * Declara que esta vista tiene trabajo empezado y sin enviar.
 *
 * @param hayTrabajo - Si ahora mismo hay algo que se perdería al salir.
 * @param descripcion - Qué se perdería, en una frase que se le enseña al usuario.
 */
export function useUnsavedWork(hayTrabajo: boolean, descripcion: string): void {
  const contexto = useContext(UnsavedWorkContext);
  const id = useId();
  const registrar = contexto?.registrar;
  // La descripción cambia de identidad en cada render aunque diga lo mismo;
  // leerla de una `ref` evita reregistrar en bucle.
  const texto = useRef(descripcion);
  texto.current = descripcion;

  useEffect(() => {
    if (!registrar) return;
    registrar(id, hayTrabajo ? texto.current : null);
    return () => registrar(id, null);
  }, [id, hayTrabajo, registrar]);
}
