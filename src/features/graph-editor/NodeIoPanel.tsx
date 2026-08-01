import { LogIn, LogOut, Play } from 'lucide-react';
import type { UnknownRecord } from '../../utils/records';
import { nodeIo, type IoContext } from './node-io';

interface NodeIoPanelProps {
  node: UnknownRecord;
  context: IoContext;
}

/**
 * Resumen de "qué está pasando en este paso".
 *
 * Responde de un vistazo las dos preguntas que el editor no contestaba: qué
 * hace el nodo y qué datos entran y salen de él. Se deriva de la configuración
 * real del grafo (`node-io.ts`), así que un paso a medio configurar lo dice en
 * lugar de aparentar estar completo.
 */
export function NodeIoPanel({ node, context }: NodeIoPanelProps) {
  const io = nodeIo(node, context);

  return (
    <section className="node-io-panel">
      <h3>Qué hace este paso</h3>
      <p className="node-io-action">
        <Play size={13} aria-hidden="true" />
        <span>{io.action ?? 'Este tipo de paso no ejecuta ninguna lógica propia.'}</span>
      </p>
      <div className="node-io-columns">
        <IoColumn
          tone="in"
          title="Entradas que lee"
          hint="Variables que este paso necesita para decidir."
          empty="No lee ninguna variable declarada."
          codes={io.reads}
        />
        <IoColumn
          tone="out"
          title="Salidas que escribe"
          hint="Variables que este paso deja escritas para el resto del flujo."
          empty="No escribe ninguna variable."
          codes={io.writes}
        />
      </div>
    </section>
  );
}

interface IoColumnProps {
  tone: 'in' | 'out';
  title: string;
  hint: string;
  empty: string;
  codes: string[];
}

function IoColumn({ tone, title, hint, empty, codes }: IoColumnProps) {
  const Icon = tone === 'in' ? LogIn : LogOut;
  return (
    <div className={`node-io-column node-io-${tone}`}>
      <h4>
        <Icon size={12} aria-hidden="true" /> {title}
        <span>{codes.length}</span>
      </h4>
      <p>{hint}</p>
      {codes.length ? (
        <ul>
          {codes.map((code) => (
            <li key={code}>
              <Icon size={11} aria-hidden="true" />
              {code}
            </li>
          ))}
        </ul>
      ) : (
        <small className="field-hint">{empty}</small>
      )}
    </div>
  );
}
