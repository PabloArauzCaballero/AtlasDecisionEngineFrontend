'use client';

import { EmptyState } from '../../components/EmptyState';
import { Panel } from '../../components/Panel';
import { asPercent, useVintageMatrix, type VintageCell } from './decision-quality.api';

/**
 * Matriz cosecha × madurez.
 *
 * Es la única forma de comparar la política de dos meses. Una tasa de malos global mezcla
 * créditos de marzo con dos meses de vida y de enero con cuatro, y como la mora madura con el
 * tiempo, esa mezcla dice más del reparto de edades de la cartera que de la calidad de la
 * política.
 *
 * Escala SECUENCIAL y no divergente: «tasa de mora» no tiene punto medio neutro del que alejarse
 * en dos direcciones, tiene un cero y un peor. Y la intensidad se atenúa cuando hay pocas
 * observaciones, porque una celda del 50 % sobre dos créditos gritaría más que una del 6 % sobre
 * cuatrocientos siendo mucho menos informativa.
 */
export function VintageMatrix({ artifactVersionId }: { artifactVersionId: string }) {
  const query = useVintageMatrix(artifactVersionId);
  const cells = query.data?.cells ?? [];
  const cohorts = [...new Set(cells.map((cell) => cell.cohort))].sort();
  const windows = [...new Set(cells.map((cell) => cell.windowDays))].sort((a, b) => a - b);
  const index = new Map(cells.map((cell) => [`${cell.cohort}|${cell.windowDays}`, cell]));

  if (query.isLoading) {
    return (
      <Panel title="Cosechas" meta="Cargando…">
        <p className="quality-muted">Calculando la matriz…</p>
      </Panel>
    );
  }

  if (!cells.length) {
    return (
      <Panel title="Cosechas">
        <EmptyState
          illustration="empty"
          title="Todavía no hay cosechas que comparar"
          description="La matriz necesita créditos dados de alta y al menos una ventana de observación cerrada."
          example="Da de alta los créditos concedidos con POST /v1/outcomes/facilities y carga sus desenlaces; la primera cosecha aparece en cuanto vence su ventana de 30 días."
        />
      </Panel>
    );
  }

  return (
    <Panel
      title="Cosechas"
      meta={`${cohorts.length} meses · madurez en días`}
      tutorialId="quality-vintages"
    >
      <p className="quality-note">
        Cada fila es el mes en que se decidió; cada columna, cuántos días llevaba el crédito cuando
        se observó. Comparar hacia abajo dentro de una columna es comparar políticas; hacia la
        derecha, ver madurar la misma cosecha.
      </p>
      <div className="vintage-scroll">
        <table className="data-table vintage-table">
          <thead>
            <tr>
              <th scope="col">Cosecha</th>
              {windows.map((days) => (
                <th scope="col" key={days}>
                  {days} d
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((cohort) => (
              <tr key={cohort}>
                <th scope="row">{cohort}</th>
                {windows.map((days) => (
                  <VintageCellView key={days} cell={index.get(`${cohort}|${days}`)} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function VintageCellView({ cell }: { cell?: VintageCell }) {
  if (!cell || cell.badRate === null) {
    return (
      <td className="vintage-cell vintage-empty">
        <span className="quality-muted">—</span>
      </td>
    );
  }
  return (
    <td
      className="vintage-cell"
      style={{ '--vintage-weight': intensity(cell) } as React.CSSProperties}
      title={`${cell.bad} de ${cell.observed} observados · ${cell.facilities} créditos${
        cell.inferred ? ` · ${cell.inferred} inferidos` : ''
      }`}
    >
      <strong>{asPercent(cell.badRate)}</strong>
      <small>{cell.observed} obs.</small>
    </td>
  );
}

/**
 * Intensidad del relleno: la tasa, atenuada por la confianza que dan las observaciones.
 *
 * Sin la atenuación, la celda más chillona de la matriz sería sistemáticamente la de la cosecha
 * más nueva —dos o tres créditos observados, uno malo, 33 %— y quien la mire concluirá que la
 * política de este mes es un desastre cuando lo único que hay es poca muestra.
 */
function intensity(cell: VintageCell): number {
  const rate = Math.min(1, (cell.badRate ?? 0) / 0.2);
  const confidence = Math.min(1, cell.observed / 30);
  return Number((rate * confidence).toFixed(3));
}
