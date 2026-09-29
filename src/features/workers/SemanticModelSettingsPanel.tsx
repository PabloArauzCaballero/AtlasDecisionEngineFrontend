'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, RotateCcw, Save } from 'lucide-react';
import { errorMessage } from '../../api/ApiError';
import { Panel } from '../../components/Panel';
import { formatDateTime } from '../../config/locale';
import { useNotifications } from '../../notifications/useNotifications';
import { ModelProbeResults } from './ModelProbeResults';
import { ModelSettingsForm } from './ModelSettingsForm';
import {
  fetchModelSettings,
  fetchOpenRouterCatalog,
  GATEWAY_LABELS,
  probeModelSettings,
  resetModelSettings,
  saveModelSettings,
  type ModelProbe,
  type ModelSettingsInput,
  type SemanticModelSettings,
} from './model-settings.api';

/**
 * Configuración del modelo del worker semántico: qué gateway y qué modelo por
 * nivel atienden el escalón remoto.
 *
 * Vive dentro del worker y no en una sección de ajustes por el mismo criterio
 * que las categorías y el padrón: es donde se descubre que hace falta. Se ve
 * el coste subir en el panel, o un modelo que se equivoca en la consola, y el
 * cambio está a una pestaña.
 *
 * **Guardar aquí cambia con qué se decide y cuánto cuesta cada glosa**, y por
 * eso hay un «Probar» antes que un «Guardar»: la prueba clasifica una glosa
 * real por nivel con la configuración candidata, sin guardarla, y enseña
 * quién respondió, cuánto tardó y cuánto costó. Elegir a ciegas un modelo que
 * no respeta el esquema llenaría la bandeja de revisión al día siguiente.
 */
export function SemanticModelSettingsPanel({ active }: { active: boolean }) {
  const cliente = useQueryClient();
  const { notify } = useNotifications();
  const [valor, setValor] = useState<ModelSettingsInput | null>(null);
  const [sonda, setSonda] = useState<ModelProbe | null>(null);

  const ajustes = useQuery({
    queryKey: ['semantic-model-settings'],
    queryFn: ({ signal }) => fetchModelSettings(signal),
    enabled: active,
  });

  // El formulario nace de lo efectivo y se rehace cuando cambia la versión —lo
  // que pasa al guardar, al volver al entorno o si otro lo cambió—. Un cambio
  // a medio editar no se pisa por un refresco de fondo: sólo por una versión nueva.
  const version = ajustes.data?.effective.version;
  useEffect(() => {
    if (ajustes.data === undefined) return;
    const { gateway, fastModel, deepModel } = ajustes.data.effective;
    setValor({ gateway, fastModel, deepModel });
    setSonda(null);
  }, [version, ajustes.data]);

  const quiereCatalogo =
    active && valor?.gateway === 'openrouter' && ajustes.data?.openrouter.available === true;
  const catalogo = useQuery({
    queryKey: ['openrouter-catalog'],
    queryFn: ({ signal }) => fetchOpenRouterCatalog(signal),
    enabled: quiereCatalogo,
    staleTime: 10 * 60 * 1_000,
  });

  const refrescar = () => cliente.invalidateQueries({ queryKey: ['semantic-model-settings'] });

  const guardar = useMutation({
    mutationFn: saveModelSettings,
    onSuccess: async (resultado) => {
      notify({
        tone: 'success',
        title: `Modelo cambiado a ${GATEWAY_LABELS[resultado.effective.gateway]}`,
        description:
          'Se usará desde la siguiente glosa (en menos de 10 s). Las respuestas que dio el modelo anterior se descartan y no se reutilizan.',
      });
      await refrescar();
    },
    onError: (error) =>
      notify({ tone: 'error', title: 'No se guardó', description: errorMessage(error) }),
  });

  const volver = useMutation({
    mutationFn: resetModelSettings,
    onSuccess: async () => {
      notify({
        tone: 'warning',
        title: 'Se volvió a la configuración predeterminada',
        description:
          'La elección hecha aquí se retiró; el procesador automático vuelve a usar la configuración predeterminada del motor.',
      });
      await refrescar();
    },
    onError: (error) =>
      notify({
        tone: 'error',
        title: 'No se pudo volver a lo predeterminado',
        description: errorMessage(error),
      }),
  });

  const probar = useMutation({
    mutationFn: probeModelSettings,
    onSuccess: (resultado) => setSonda(resultado),
    onError: (error) =>
      notify({
        tone: 'error',
        title: 'La prueba no se pudo hacer',
        description: errorMessage(error),
      }),
  });

  if (ajustes.isPending || valor === null) {
    return (
      <Panel title="Modelo del procesador automático">
        <p className="entidad-vacio">Consultando la configuración del modelo…</p>
      </Panel>
    );
  }
  if (ajustes.isError || ajustes.data === undefined) {
    return (
      <Panel title="Modelo del procesador automático">
        <p className="entidad-vacio">No se pudo leer la configuración del modelo.</p>
      </Panel>
    );
  }

  const datos = ajustes.data;
  const efectivo = datos.effective;
  const sucio =
    valor.gateway !== efectivo.gateway ||
    valor.fastModel.trim() !== efectivo.fastModel ||
    valor.deepModel.trim() !== efectivo.deepModel;
  const ocupado = guardar.isPending || volver.isPending || probar.isPending;
  const completo = valor.fastModel.trim() !== '' && valor.deepModel.trim() !== '';

  return (
    <div className="modelo-config">
      <Panel
        title="Modelo del procesador automático"
        meta={datos.applies ? 'Se puede cambiar aquí' : 'No se puede cambiar aquí'}
      >
        <EstadoActual datos={datos} />

        {!datos.applies ? (
          <p className="modelo-aviso">
            Este entorno clasifica con un método que no usa ningún proveedor remoto: elegir uno aquí
            no tendría efecto. Ese método sólo lo cambia el equipo técnico en la configuración del
            motor.
          </p>
        ) : null}

        <ModelSettingsForm
          ajustes={datos}
          valor={valor}
          onChange={(nuevo) => {
            setValor(nuevo);
            setSonda(null);
          }}
          catalogo={catalogo.data?.models}
          catalogoCargando={catalogo.isPending && quiereCatalogo}
          catalogoError={catalogo.isError}
          disabled={!datos.applies || ocupado}
        />

        <div className="modelo-acciones">
          <button
            type="button"
            className="button"
            disabled={!datos.applies || ocupado || !completo}
            onClick={() => probar.mutate(limpiar(valor))}
          >
            <FlaskConical size={15} aria-hidden="true" />{' '}
            {probar.isPending ? 'Probando…' : 'Probar con una glosa'}
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={!datos.applies || ocupado || !sucio || !completo}
            onClick={() => guardar.mutate(limpiar(valor))}
          >
            <Save size={15} aria-hidden="true" /> {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </button>
          {efectivo.source === 'portal' ? (
            <button
              type="button"
              className="button"
              disabled={ocupado}
              onClick={() => volver.mutate()}
            >
              <RotateCcw size={15} aria-hidden="true" /> Volver a lo predeterminado
            </button>
          ) : null}
        </div>
        <p className="field-help">
          Probar clasifica una glosa de ejemplo con cada nivel elegido, sin guardar: cuesta lo mismo
          que dos glosas. Guardar aplica el cambio al momento y descarta las respuestas del modelo
          anterior.
        </p>

        {sonda !== null ? <ModelProbeResults resultado={sonda} /> : null}
      </Panel>
    </div>
  );
}

/**
 * Lo que está en vigor AHORA, antes del formulario. Es lo primero que hay que
 * saber y lo que el formulario, al editarse, deja de decir.
 */
function EstadoActual({ datos }: { datos: SemanticModelSettings }) {
  const e = datos.effective;
  const origen =
    e.source === 'portal'
      ? `desde el portal por ${e.updatedBy ?? 'alguien'}${e.updatedAt ? ` el ${formatDateTime(e.updatedAt)}` : ''}`
      : 'por defecto en el motor';
  return (
    <div className="worker-facts">
      <ul className="worker-facts-list">
        <li className="worker-fact is-on">
          <span className="worker-fact-label">En uso</span>
          <span className="worker-fact-value">
            <span className="worker-fact-dot" aria-hidden="true" />
            {GATEWAY_LABELS[e.gateway]}
          </span>
        </li>
        <li className="worker-fact">
          <span className="worker-fact-label">Rápido</span>
          <span className="worker-fact-value mono">{e.fastModel}</span>
        </li>
        <li className="worker-fact">
          <span className="worker-fact-label">Profundo</span>
          <span className="worker-fact-value mono">{e.deepModel}</span>
        </li>
      </ul>
      <p className="worker-facts-note">Configurado {origen}.</p>
    </div>
  );
}

function limpiar(valor: ModelSettingsInput): ModelSettingsInput {
  return { ...valor, fastModel: valor.fastModel.trim(), deepModel: valor.deepModel.trim() };
}
