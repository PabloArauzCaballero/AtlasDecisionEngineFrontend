import type { ModelProbe, ModelProbeTier } from './model-settings.api';

/**
 * Lo que respondió cada nivel a la glosa de prueba.
 *
 * Se enseñan las cuatro cosas que decidirían si guardar o no: qué despliegue
 * físico contestó (el mismo modelo lo sirven varios), cuánto tardó, cuánto
 * costó y si respetó el esquema —un fallo aquí es exactamente el que llenaría
 * la bandeja de revisión—. Un nivel fallido no esconde al otro: el rápido y el
 * profundo son de proveedores distintos y lo que falla en uno no falla en el otro.
 */
export function ModelProbeResults({ resultado }: { resultado: ModelProbe }) {
  return (
    <div className="modelo-sonda" role="status" aria-live="polite">
      <h3 className="modelo-sonda-titulo">Resultado de la prueba</h3>
      <div className="worker-table-scroll">
        <table className="modelo-sonda-tabla">
          <thead>
            <tr>
              <th scope="col">Nivel</th>
              <th scope="col">Pedido</th>
              <th scope="col">Respondió</th>
              <th scope="col">Latencia</th>
              <th scope="col">Coste</th>
              <th scope="col">Veredicto</th>
            </tr>
          </thead>
          <tbody>
            {resultado.tiers.map((nivel) => (
              <FilaNivel key={nivel.tier} nivel={nivel} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilaNivel({ nivel }: { nivel: ModelProbeTier }) {
  const rotulo = nivel.tier === 'FAST' ? 'Rápido' : 'Profundo';
  if (!nivel.ok) {
    return (
      <tr className="is-error">
        <th scope="row">{rotulo}</th>
        <td className="mono">{nivel.model}</td>
        <td colSpan={4} className="modelo-sonda-error">
          Falló: {nivel.error ?? 'sin detalle'}
        </td>
      </tr>
    );
  }
  return (
    <tr className="is-ok">
      <th scope="row">{rotulo}</th>
      <td className="mono">{nivel.model}</td>
      <td className="mono">{nivel.respondedBy ?? '—'}</td>
      <td>{nivel.latencyMs === undefined ? '—' : `${String(nivel.latencyMs)} ms`}</td>
      <td>{formatearCoste(nivel.usage?.estimatedCost, nivel.usage?.totalTokens)}</td>
      <td>
        {nivel.topCategory === undefined
          ? '—'
          : `${nivel.topCategory} · ${formatearConfianza(nivel.confidence)}`}
      </td>
    </tr>
  );
}

/**
 * Seis decimales y no dos: una glosa cuesta diezmilésimas de dólar, y con dos
 * decimales toda prueba diría «$0.00», que es lo contrario de informar.
 */
function formatearCoste(coste: number | undefined, tokens: number | undefined): string {
  if (coste === undefined) return tokens === undefined ? '—' : `${String(tokens)} tokens`;
  const usd = `$${coste.toFixed(6)}`;
  return tokens === undefined ? usd : `${usd} · ${String(tokens)} tokens`;
}

function formatearConfianza(valor: number | undefined): string {
  return valor === undefined ? '' : `${String(Math.round(valor * 100))} %`;
}
