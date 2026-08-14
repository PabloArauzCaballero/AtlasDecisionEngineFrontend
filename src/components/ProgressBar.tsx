/**
 * Barra de progreso.
 *
 * Lleva `role="progressbar"` y sus tres valores, no sólo un `aria-label`.
 *
 * Era un `<div>` sin rol con `aria-label="72%"`, y `aria-label` está PROHIBIDO
 * en un elemento sin rol: la especificación no permite nombrar algo que no es
 * nada, así que el navegador lo descarta y el lector de pantalla no anunciaba ni
 * el valor ni que aquello fuera una barra. El porcentaje sólo existía como
 * anchura de un `<span>`, es decir, sólo para quien lo ve. Aparecía en la
 * cobertura de grafo y en la matriz de trazabilidad, que son justamente las dos
 * pantallas donde el número ES el contenido.
 *
 * `aria-valuetext` da la lectura en palabras; sin él algunos lectores anuncian
 * el crudo «72» sin unidad.
 */
export function ProgressBar({
  value,
  tone = 'success',
  label,
}: {
  value: number;
  tone?: 'success' | 'warning' | 'danger' | 'info';
  /**
   * Qué se está midiendo. OBLIGATORIO.
   *
   * Una barra con rol y sin nombre incumple igual que una sin rol: el lector
   * anuncia «barra de progreso, 72 por ciento» sin decir de qué. Se dejó
   * opcional al añadir el rol y las cuatro llamadas existentes se quedaron sin
   * nombre, así que el arreglo cambió un incumplimiento por otro. Al ser
   * obligatorio, el compilador no deja repetirlo.
   */
  label: string;
}) {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`progress progress-${tone}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={bounded}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${bounded}%`}
    >
      <span style={{ width: `${bounded}%` }} />
    </div>
  );
}
