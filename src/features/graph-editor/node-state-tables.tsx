import { dataTypeLabel } from '../../contracts/data-types';
import { display, type UnknownRecord } from '../../utils/records';
import { maskValue } from '../../utils/sensitivity';

/**
 * Las tablas del estado de variables de un nodo.
 *
 * Separadas de `NodeVariableStatePanel` por el límite de 299 líneas del
 * repositorio, y el corte va por responsabilidad: allí el recorrido —qué paso se
 * mira y cómo se navega—, aquí cómo se dibuja el estado de UN paso.
 */

export function ValueGroup({
  title,
  hint,
  values,
}: {
  title: string;
  hint: string;
  values: UnknownRecord[];
}) {
  return (
    <section className="node-state-group">
      <h4>{title}</h4>
      <small className="field-hint">{hint}</small>
      {values.length ? (
        /*
         * La tabla se desplaza DENTRO de su caja. Sin esto, cinco columnas con
         * un valor largo desbordaban el panel y la columna «Valor» quedaba
         * cortada contra el borde: justo el dato por el que se abre la traza.
         */
        <div className="node-state-scroll">
          <table className="node-state-table">
            <thead>
              <tr>
                <th scope="col">Variable</th>
                <th scope="col">Tipo</th>
                <th scope="col">Estado</th>
                <th scope="col">Origen</th>
                <th scope="col">Valor</th>
              </tr>
            </thead>
            <tbody>
              {values.map((value) => (
                <tr key={display(value, 'code')}>
                  <td>{display(value, 'code')}</td>
                  <td>{dataTypeLabel(value.dataType)}</td>
                  <td>
                    <StateChip state={display(value, 'state')} />
                  </td>
                  <td>
                    <small>
                      {ORIGIN_LABELS[display(value, 'origin')] ?? display(value, 'origin')}
                    </small>
                  </td>
                  <td className="node-state-value">
                    {renderValue(value.value, value.sensitivityClass)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <small className="field-hint">Sin valores en esta categoría.</small>
      )}
    </section>
  );
}

export function IntermediateGroup({
  title,
  before,
  after,
  created,
  updated,
}: {
  title: string;
  before: UnknownRecord[];
  after: UnknownRecord[];
  created: string[];
  updated: string[];
}) {
  const beforeByCode = new Map(before.map((entry) => [display(entry, 'code'), entry]));
  return (
    <section className="node-state-group">
      <h4>{title}</h4>
      <small className="field-hint">
        Existen solo durante esta ejecución.{' '}
        {created.length ? `Creadas aquí: ${created.join(', ')}. ` : ''}
        {updated.length ? `Actualizadas aquí: ${updated.join(', ')}.` : ''}
      </small>
      {after.length ? (
        <div className="node-state-scroll">
          <table className="node-state-table">
            <thead>
              <tr>
                <th scope="col">Variable</th>
                <th scope="col">Antes</th>
                <th scope="col">Después</th>
                <th scope="col">Producida por</th>
                <th scope="col">Creada en</th>
                <th scope="col">Consumida por</th>
              </tr>
            </thead>
            <tbody>
              {after.map((entry) => {
                const code = display(entry, 'code');
                const previous = beforeByCode.get(code);
                const consumers = Array.isArray(entry.consumedByNodeKeys)
                  ? entry.consumedByNodeKeys.map(String)
                  : [];
                return (
                  <tr key={code}>
                    <td>
                      {code}
                      <small> · {dataTypeLabel(entry.dataType)}</small>
                    </td>
                    <td>
                      <StateChip state={display(previous ?? {}, 'state') || 'NOT_AVAILABLE'} />
                    </td>
                    <td>
                      <StateChip state={display(entry, 'state')} />
                      <span className="node-state-value">
                        {renderValue(entry.value, entry.sensitivityClass)}
                      </span>
                    </td>
                    <td>{display(entry, 'producerNodeKey')}</td>
                    <td>{createdAtLabel(entry)}</td>
                    <td>{consumers.length ? consumers.join(', ') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <small className="field-hint">Este grafo no declara variables intermedias.</small>
      )}
    </section>
  );
}

/**
 * «Momento de creación» de una intermedia (§3.1). El backend da el índice del paso en
 * base 0; aquí se muestra en base 1 para que coincida con la numeración de la traza.
 * Ausente NO es «paso 0»: o la variable aún no existe, o nació con valor inicial antes
 * de ejecutarse ningún nodo, y confundirlos haría irreconstruible el razonamiento.
 */
function createdAtLabel(entry: UnknownRecord): string {
  const step = entry.createdAtStepIndex;
  if (typeof step === 'number') return `paso ${step + 1}`;
  return display(entry, 'state') === 'NOT_AVAILABLE' ? '—' : 'valor inicial';
}

/** De dónde viene un valor (§3.1 «origen del valor»). */
const ORIGIN_LABELS: Record<string, string> = {
  REQUEST: 'de la petición',
  PROVIDER: 'de un proveedor',
  DERIVED: 'derivado',
  CALCULATED_FIELD: 'campo calculado',
  GRAPH_NODE: 'un nodo del grafo',
  NODE: 'un nodo',
  EXPRESSION: 'una expresión',
  INTERMEDIATE: 'una intermedia',
  CONSTANT: 'constante',
  REFERENCE: 'otro artefacto',
};

const STATE_LABELS: Record<string, string> = {
  NOT_AVAILABLE: 'sin valor',
  AVAILABLE: 'disponible',
  VALID: 'válida',
  INVALID: 'inválida',
  COMPUTED: 'calculada',
  UPDATED: 'actualizada',
  CONSUMED: 'consumida',
  SKIPPED: 'omitida',
  ERROR: 'error',
  REDACTED: 'redactada',
};

function StateChip({ state }: { state: string }) {
  const normalized = state || 'NOT_AVAILABLE';
  return (
    <span className={`state-chip state-${normalized.toLowerCase()}`} title={normalized}>
      {STATE_LABELS[normalized] ?? normalized.toLowerCase()}
    </span>
  );
}

/**
 * Un valor sensible nunca se pinta en claro, aunque el backend lo hubiera
 * enviado. La regla vive en `utils/sensitivity` porque esta tabla era la ÚNICA
 * que la aplicaba, y las que pintan el mismo dato en el expediente y en la
 * ejecución no la tenían.
 */
const renderValue = maskValue;
