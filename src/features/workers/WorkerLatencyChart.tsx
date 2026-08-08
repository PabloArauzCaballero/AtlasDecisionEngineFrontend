import { durationLabel, type RunTiming } from './worker-metrics';
import { STATUS_LABEL } from './worker-types';

interface WorkerLatencyChartProps {
  /** De la más antigua a la más reciente: el tiempo avanza hacia la derecha. */
  timings: readonly RunTiming[];
  /** Mediana y percentil 95: las dos referencias que se dibujan sobre el fondo. */
  p50Ms: number | null;
  p95Ms: number | null;
}

/** Posición vertical de una duración en la escala logarítmica del gráfico, de 0 a 1. */
function scale(ms: number, ceiling: number): number {
  if (ceiling <= 0) return 0;
  return Math.min(1, Math.log10(1 + Math.max(0, ms)) / ceiling);
}

/**
 * Latencia de cada ejecución, en el orden en que ocurrieron.
 *
 * **Escala logarítmica**, y no por gusto: la latencia de un worker se reparte
 * en órdenes de magnitud —cincuenta ejecuciones de 170 ms junto a una de siete
 * minutos— y con un eje lineal el caso habitual queda como una raya de un píxel
 * en el suelo. El gráfico ocuparía sitio sin enseñar lo único que se le pide:
 * la forma de lo normal y dónde se sale. Se dice en el pie, porque un eje
 * comprimido sin avisar invita a leer «el doble de alto» como «el doble de
 * lento», que aquí es falso.
 *
 * **Barras de ancho fijo, alineadas a la derecha, y no un SVG estirado.** Antes
 * el dibujo era un `viewBox` de ancho constante con `preserveAspectRatio="none"`,
 * así que el ancho de cada barra lo decidía cuántas había: con cuatro
 * ejecuciones salían cuatro losas de 130 px: bloques de color saturado que
 * ocupaban el panel entero sin decir nada más que las mismas cuatro cifras. Con
 * ancho fijo, cuatro ejecuciones y cuarenta se leen igual, y el color de estado
 * vuelve a ser un dato en vez de un fondo. Se llenan desde la derecha porque la
 * serie termina AHORA: el hueco de la izquierda es historia que no existe, y eso
 * es cierto y vale la pena verlo.
 *
 * El gráfico **no es la única forma de leer el dato**: las cifras exactas (p50,
 * p95, la más lenta) van impresas al lado, cada barra lleva su `title` con la
 * duración y la ejecución que representa, y el conjunto se anuncia con una
 * etiqueta que dice el rango. Un gráfico que sólo se entiende mirándolo deja
 * fuera a quien no puede.
 */
export function WorkerLatencyChart({ timings, p50Ms, p95Ms }: WorkerLatencyChartProps) {
  const measured = timings.filter((timing) => timing.durationMs !== null);

  if (measured.length < 2) {
    return (
      <p className="worker-chart-empty">
        Hacen falta al menos dos ejecuciones terminadas para dibujar una tendencia. Aquí aparecerá
        cuánto tardó cada una, en el orden en que ocurrieron.
      </p>
    );
  }

  const durations = measured.map((timing) => timing.durationMs as number);
  const max = Math.max(...durations);
  // El techo del eje: la más lenta, con un 8 % de aire para que no toque el borde.
  const ceiling = Math.log10(1 + max) * 1.08;

  const references = [
    { key: 'p95', value: p95Ms },
    { key: 'p50', value: p50Ms },
  ].filter((reference): reference is { key: string; value: number } => reference.value !== null);

  return (
    <figure className="worker-chart">
      <div
        className="worker-chart-plot"
        role="img"
        aria-label={`Latencia de las últimas ${measured.length} ejecuciones terminadas, de ${durationLabel(
          Math.min(...durations),
        )} a ${durationLabel(max)}. Escala logarítmica.`}
      >
        {/*
         * Las dos referencias van SIN rótulo. Sus cifras ya están impresas justo
         * debajo del gráfico —«MEDIANA 4.5 s», «PERCENTIL 95 12 s»—, así que
         * repetirlas encima de la línea es decir dos veces lo mismo a diez
         * píxeles de distancia; y cuando p50 y p95 caen cerca en la escala
         * logarítmica, los dos rótulos se pisan. En el pie tampoco: allí
         * compartían renglón con «más antigua» y «más reciente» y a 390 px los
         * tres se atropellaban.
         */}
        {references.map((reference) => (
          <div
            key={reference.key}
            className={`worker-chart-reference is-${reference.key}`}
            style={{ bottom: `${scale(reference.value, ceiling) * 100}%` }}
          />
        ))}
        <ol className="worker-chart-bars">
          {measured.map((timing) => {
            const duration = timing.durationMs as number;
            return (
              <li
                key={timing.run.requestId}
                className={`worker-chart-bar is-${timing.run.status.toLowerCase()}`}
                style={{ height: `${Math.max(1.5, scale(duration, ceiling) * 100)}%` }}
                title={`${STATUS_LABEL[timing.run.status]} · ${durationLabel(duration)} · ${timing.run.requestId}`}
              />
            );
          })}
        </ol>
      </div>
      <figcaption className="worker-chart-caption">
        <span>más antigua</span>
        <span className="worker-chart-legend">escala logarítmica</span>
        <span>más reciente</span>
      </figcaption>
    </figure>
  );
}
