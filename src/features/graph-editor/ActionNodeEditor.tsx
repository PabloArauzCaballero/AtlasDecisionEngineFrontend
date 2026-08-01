import { InfoHint } from '../../components/InfoHint';
import { asRecord, asRows, display, type UnknownRecord } from '../../utils/records';

interface ActionNodeEditorProps {
  node: UnknownRecord;
  config: UnknownRecord;
  /** Catálogo de acciones del grafo (`snapshot.actions`). */
  actions: UnknownRecord[];
  onChange: (patch: UnknownRecord) => void;
}

function boundCode(node: UnknownRecord, config: UnknownRecord): string {
  const fromConfig = display(config, 'actionCode');
  if (fromConfig !== '—') return fromConfig;
  const binding = asRows(node.actions)[0];
  const code = binding ? display(binding, 'actionCode', 'code') : '—';
  return code === '—' ? '' : code;
}

/**
 * Editor de un nodo de ACCIÓN.
 *
 * Antes un nodo de acción sólo ofrecía un cuadro de "parámetros avanzados" con
 * `{}` dentro: no se veía qué acción ejecutaba, ni con qué datos, ni qué motivos
 * devolvía. La acción de verdad vive en el catálogo del grafo (`actions`), así
 * que aquí se elige por su código y se muestra lo que esa acción declara.
 *
 * La selección se guarda a la vez en `config.actionCode` y en el vínculo
 * `node.actions`, que es lo que el backend persiste; si sólo se escribiera uno
 * de los dos, el editor y el motor acabarían discrepando.
 */
export function ActionNodeEditor({ node, config, actions, onChange }: ActionNodeEditorProps) {
  const code = boundCode(node, config);
  const definition = actions.find((entry) => display(entry, 'code') === code);
  const payload = asRecord(definition?.payload ?? config.payload);
  const reasonCodes = asRows(definition?.reasonCodes);

  const bind = (nextCode: string) =>
    onChange({
      config: { ...config, actionCode: nextCode },
      actions: nextCode ? [{ actionCode: nextCode, order: 1 }] : [],
    });

  return (
    <section className="action-node-editor">
      <h3>Acción que ejecuta</h3>
      <label className="field">
        <span>
          Acción del catálogo
          <InfoHint text="Las acciones se definen una vez por algoritmo y se reutilizan en los pasos que las necesiten. Aquí eliges cuál ejecuta este paso." />
        </span>
        <select value={code} onChange={(event) => bind(event.target.value)}>
          <option value="">Sin acción asignada…</option>
          {actions.map((entry) => (
            <option key={display(entry, 'code')} value={display(entry, 'code')}>
              {display(entry, 'code')} · {display(entry, 'type')}
            </option>
          ))}
        </select>
      </label>

      {!actions.length ? (
        <p className="field-hint">
          Este algoritmo todavía no declara ninguna acción. Impórtalas desde código o créalas en la
          versión antes de asignarlas a un paso.
        </p>
      ) : null}

      {code && !definition ? (
        <p className="field-error">
          El paso apunta a la acción «{code}», que no existe en este grafo. Elige una del catálogo o
          vuelve a importar el algoritmo.
        </p>
      ) : null}

      {definition ? (
        <>
          <dl className="action-summary">
            <div>
              <dt>Tipo</dt>
              <dd>{display(definition, 'type')}</dd>
            </div>
            <div>
              <dt>Termina el flujo</dt>
              <dd>{definition.terminal ? 'Sí' : 'No'}</dd>
            </div>
          </dl>
          {reasonCodes.length ? (
            <div className="action-reasons">
              <h4>Motivos que devuelve</h4>
              <ul>
                {reasonCodes.map((reason, index) => (
                  <li key={index}>{display(reason, 'code', 'reasonCodeId')}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {Object.keys(payload).length ? (
            <label className="field">
              <span>Datos con los que se ejecuta</span>
              <pre className="action-payload">{JSON.stringify(payload, null, 2)}</pre>
            </label>
          ) : (
            <p className="field-hint">Esta acción no necesita datos adicionales.</p>
          )}
        </>
      ) : null}
    </section>
  );
}
