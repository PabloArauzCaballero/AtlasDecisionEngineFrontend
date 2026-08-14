'use client';

import { Tags } from 'lucide-react';

interface StatementCategoriesBarProps {
  /** Glosas distintas que se van a clasificar. */
  glosas: number;
  corriendo: boolean;
  hechas: number;
  total: number;
  /** Glosas distintas que había cuando se rechazó empezar, o `null` si cabían. */
  demasiadas: number | null;
  maxGlosas: number;
  onClasificar: () => void;
  onParar: () => void;
}

/**
 * La barra que ofrece clasificar los movimientos del extracto.
 *
 * **Un botón y no un encadenado automático.** Clasificar significa una
 * ejecución del worker semántico por glosa distinta, y eso son peticiones
 * contra un motor que corta a 300 por minuto: dispararlas solas al terminar la
 * conversión convertiría cada extracto convertido en una tanda que nadie pidió.
 * El número va escrito en el botón para que el coste se vea ANTES de pulsarlo.
 *
 * Mientras corre se puede parar, y lo hecho hasta ahí se queda: son
 * clasificaciones válidas, no un resultado a medias que haya que tirar.
 *
 * **El botón pregunta de verdad, cada vez.** El motor deduplica por contenido y
 * sin caducidad, así que la petición tal cual devolvía el veredicto guardado —el
 * de cuando el catálogo de categorías era otro— y pulsar no podía cambiar nada:
 * la tabla enseñaba «Sin determinar» en movimientos cuya hoja ya existía. Cada
 * tanda manda ahora su propia clave de idempotencia, y por eso el texto puede
 * prometer una ejecución por glosa sin mentir.
 */
export function StatementCategoriesBar({
  glosas,
  corriendo,
  hechas,
  total,
  demasiadas,
  maxGlosas,
  onClasificar,
  onParar,
}: StatementCategoriesBarProps) {
  if (demasiadas !== null) {
    return (
      <p className="worker-categories-note is-blocked" role="status">
        Este extracto trae {demasiadas} glosas distintas y el límite son {maxGlosas}. No se
        clasificó ninguna: dejar media tabla con categoría se leería como «esos movimientos no
        encajan en ninguna» en vez de «no se preguntó».
      </p>
    );
  }

  return (
    <div className="worker-categories-bar">
      {corriendo ? (
        <>
          {/*
           * Barra determinada, no un girador. Aquí el avance se CONOCE —glosas
           * terminadas sobre glosas totales—, así que inventar una animación sin
           * fin escondería justo el dato que hace esperable la espera: cuánto
           * falta. `aria-valuenow` lleva el mismo número que se pinta.
           */}
          <div className="worker-categories-running">
            <div
              className="worker-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={hechas}
              aria-label={`Clasificando glosas: ${hechas} de ${total}`}
            >
              <div
                className="worker-progress-fill"
                style={{ inlineSize: `${total ? Math.round((hechas / total) * 100) : 0}%` }}
              />
            </div>
            <p className="worker-categories-progress" aria-live="polite">
              Clasificando… {hechas} de {total} glosas
            </p>
          </div>
          <button type="button" className="button" onClick={onParar}>
            Parar
          </button>
        </>
      ) : (
        <>
          <button type="button" className="button" onClick={onClasificar}>
            <Tags size={16} aria-hidden="true" />
            {hechas > 0 ? 'Volver a clasificar' : `Clasificar ${glosas} glosas distintas`}
          </button>
          <p className="worker-categories-note">
            Una ejecución del análisis semántico por glosa distinta, contra el catálogo de
            categorías de hoy. Las repetidas se preguntan una sola vez.
          </p>
        </>
      )}
    </div>
  );
}
