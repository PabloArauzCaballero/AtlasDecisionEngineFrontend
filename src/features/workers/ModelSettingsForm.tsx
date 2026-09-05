'use client';

import { useMemo, useState } from 'react';
import {
  GATEWAY_LABELS,
  type ModelGateway,
  type ModelSettingsInput,
  type OpenRouterModel,
  type SemanticModelSettings,
} from './model-settings.api';

interface ModelSettingsFormProps {
  ajustes: SemanticModelSettings;
  valor: ModelSettingsInput;
  onChange: (valor: ModelSettingsInput) => void;
  catalogo: OpenRouterModel[] | undefined;
  catalogoCargando: boolean;
  catalogoError: boolean;
  disabled: boolean;
}

/**
 * El formulario: qué gateway y qué modelo por nivel.
 *
 * El gateway se elige entre dos tarjetas y no en un desplegable porque son dos
 * y porque cada una lleva su salvedad —«sin credencial en el motor»— pegada al
 * nombre. Un gateway sin credencial se enseña deshabilitado y con el motivo,
 * no se esconde: quien lo busca tiene que saber que existe y qué le falta.
 *
 * Con OpenRouter los modelos salen del catálogo, con precio y contexto a la
 * vista; con LiteLLM son alias que resuelve el `config.yaml` del gateway y se
 * escriben a mano. La forma la vuelve a validar el motor.
 */
export function ModelSettingsForm({
  ajustes,
  valor,
  onChange,
  catalogo,
  catalogoCargando,
  catalogoError,
  disabled,
}: ModelSettingsFormProps) {
  const elegirGateway = (gateway: ModelGateway) => {
    if (gateway === valor.gateway) return;
    // Al cambiar de gateway, los modelos son los que dicta el entorno para ÉSE:
    // un alias de LiteLLM no significa nada en OpenRouter ni al revés.
    const entorno = ajustes[gateway];
    onChange({ gateway, fastModel: entorno.fastModel, deepModel: entorno.deepModel });
  };

  return (
    <fieldset className="modelo-form" disabled={disabled}>
      <legend className="field-label">Gateway del escalón remoto</legend>
      <div className="modelo-gateways" role="radiogroup" aria-label="Gateway">
        {(['litellm', 'openrouter'] as const).map((gateway) => (
          <TarjetaGateway
            key={gateway}
            gateway={gateway}
            entorno={ajustes[gateway]}
            activo={valor.gateway === gateway}
            onElegir={() => elegirGateway(gateway)}
          />
        ))}
      </div>

      {valor.gateway === 'openrouter' ? (
        <div className="modelo-campos">
          <SelectorModelo
            rotulo="Nivel rápido"
            ayuda="Atiende la inmensa mayoría de las glosas: conviene el más barato que sostenga salida estructurada."
            valor={valor.fastModel}
            onChange={(fastModel) => onChange({ ...valor, fastModel })}
            catalogo={catalogo}
            cargando={catalogoCargando}
            error={catalogoError}
          />
          <SelectorModelo
            rotulo="Nivel profundo"
            ayuda="Sólo entra en lo que el rápido dejó ambiguo: su precio se paga pocas veces."
            valor={valor.deepModel}
            onChange={(deepModel) => onChange({ ...valor, deepModel })}
            catalogo={catalogo}
            cargando={catalogoCargando}
            error={catalogoError}
          />
        </div>
      ) : (
        <div className="modelo-campos">
          <label className="field">
            <span className="field-label">Alias del nivel rápido</span>
            <input
              className="mono"
              value={valor.fastModel}
              onChange={(evento) => onChange({ ...valor, fastModel: evento.target.value })}
            />
            <span className="field-help">
              Un alias del <code>model_list</code> del gateway, nunca un modelo físico.
            </span>
          </label>
          <label className="field">
            <span className="field-label">Alias del nivel profundo</span>
            <input
              className="mono"
              value={valor.deepModel}
              onChange={(evento) => onChange({ ...valor, deepModel: evento.target.value })}
            />
          </label>
        </div>
      )}
    </fieldset>
  );
}

function TarjetaGateway({
  gateway,
  entorno,
  activo,
  onElegir,
}: {
  gateway: ModelGateway;
  entorno: SemanticModelSettings['litellm'];
  activo: boolean;
  onElegir: () => void;
}) {
  const variable = gateway === 'openrouter' ? 'OPENROUTER_API_KEY' : 'LITELLM_API_KEY';
  return (
    <label
      className={`modelo-gateway${activo ? ' is-active' : ''}${entorno.available ? '' : ' is-disabled'}`}
    >
      <input
        type="radio"
        name="gateway"
        value={gateway}
        checked={activo}
        disabled={!entorno.available}
        onChange={onElegir}
      />
      <span className="modelo-gateway-nombre">{GATEWAY_LABELS[gateway]}</span>
      <span className="modelo-gateway-nota">
        {entorno.available ? (
          <>
            Por entorno: <code>{entorno.fastModel}</code> / <code>{entorno.deepModel}</code>
          </>
        ) : (
          <>
            Sin credencial en el motor: falta <code>{variable}</code>. La credencial no se configura
            desde el portal.
          </>
        )}
      </span>
    </label>
  );
}

function SelectorModelo({
  rotulo,
  ayuda,
  valor,
  onChange,
  catalogo,
  cargando,
  error,
}: {
  rotulo: string;
  ayuda: string;
  valor: string;
  onChange: (id: string) => void;
  catalogo: OpenRouterModel[] | undefined;
  cargando: boolean;
  error: boolean;
}) {
  const [filtro, setFiltro] = useState('');
  const opciones = useMemo(() => {
    const lista = catalogo ?? [];
    const texto = filtro.trim().toLowerCase();
    const filtradas =
      texto === ''
        ? lista
        : lista.filter(
            (modelo) =>
              modelo.id.toLowerCase().includes(texto) || modelo.name.toLowerCase().includes(texto),
          );
    // El elegido se conserva aunque el filtro lo deje fuera: un `<select>` con
    // un valor que no está entre sus opciones lo enseña vacío y parece perdido.
    if (valor !== '' && !filtradas.some((modelo) => modelo.id === valor)) {
      const actual = lista.find((modelo) => modelo.id === valor);
      return actual === undefined
        ? [{ id: valor, name: valor, sinCatalogo: true as const }, ...filtradas]
        : [actual, ...filtradas];
    }
    return filtradas;
  }, [catalogo, filtro, valor]);

  return (
    <div className="field modelo-selector">
      <label className="field">
        <span className="field-label">{rotulo}</span>
        <select value={valor} onChange={(evento) => onChange(evento.target.value)}>
          {opciones.map((modelo) => (
            <option key={modelo.id} value={modelo.id}>
              {describir(modelo)}
            </option>
          ))}
        </select>
        <span className="field-help">{ayuda}</span>
      </label>
      <label className="modelo-filtro">
        <span className="field-label">Filtrar el catálogo</span>
        <input
          type="search"
          value={filtro}
          placeholder="openai, gemini, mini…"
          onChange={(evento) => setFiltro(evento.target.value)}
        />
      </label>
      {cargando ? <span className="field-help">Leyendo el catálogo de OpenRouter…</span> : null}
      {error ? (
        <span className="field-help modelo-aviso-inline">
          No se pudo leer el catálogo. Se conserva lo elegido; los precios no se pueden enseñar.
        </span>
      ) : null}
    </div>
  );
}

/** Identificador, precio por millón y contexto en UNA línea: es lo que se compara al elegir. */
function describir(
  modelo: OpenRouterModel | { id: string; name: string; sinCatalogo: true },
): string {
  if ('sinCatalogo' in modelo) return `${modelo.id} (fuera del catálogo)`;
  const precio = `$${modelo.promptUsdPerMillion.toFixed(2)} / $${modelo.completionUsdPerMillion.toFixed(2)} por M`;
  const contexto =
    modelo.contextLength > 0 ? ` · ${String(Math.round(modelo.contextLength / 1000))}k ctx` : '';
  return `${modelo.id} — ${precio}${contexto}${modelo.recommended ? ' · recomendado' : ''}`;
}
