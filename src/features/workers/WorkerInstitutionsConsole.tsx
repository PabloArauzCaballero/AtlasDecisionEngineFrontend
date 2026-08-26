'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DownloadCloud, Images, Plus } from 'lucide-react';
import { Panel } from '../../components/Panel';
import { useNotifications } from '../../notifications/useNotifications';
import { InstitutionForm } from './InstitutionForm';
import { InstitutionsTable } from './InstitutionsTable';
import {
  deactivateInstitution,
  fetchInstitutionSummary,
  fetchInstitutions,
  reactivateInstitution,
  removeInstitutionLogo,
  saveInstitution,
  seedInstitutions,
  syncInstitutionLogos,
  uploadInstitutionLogo,
  type FinancialInstitution,
  type InstitutionSeedSummary,
} from './institutions.api';

/**
 * El padrón de entidades financieras, dentro del propio worker de extractos.
 *
 * Vive aquí y no en una sección de ajustes por el mismo criterio que el árbol de
 * categorías: es donde se descubre que hace falta. Llega un extracto, el motor
 * lo rechaza como «emisor no reconocido», y el arreglo —añadir el marcador que
 * el banco imprime en su carátula— está a una pestaña de distancia. Separarlo
 * obligaría a salir del worker, buscar la pantalla y volver a empezar.
 *
 * **Escribir aquí cambia qué documentos acepta el motor**, y por eso cada aviso
 * dice la consecuencia y no sólo «guardado»: dar de baja una entidad no la
 * archiva, hace que sus extractos empiecen a rechazarse.
 */
export function WorkerInstitutionsConsole() {
  const cliente = useQueryClient();
  const { notify } = useNotifications();
  const [editando, setEditando] = useState<FinancialInstitution | 'nueva' | null>(null);
  const [verBajas, setVerBajas] = useState(false);
  const [ensayo, setEnsayo] = useState<InstitutionSeedSummary | null>(null);

  const entidades = useQuery({
    queryKey: ['bank-statement-institutions', verBajas],
    queryFn: ({ signal }) => fetchInstitutions(verBajas, signal),
  });
  const resumen = useQuery({
    queryKey: ['bank-statement-institutions-summary'],
    queryFn: ({ signal }) => fetchInstitutionSummary(signal),
  });

  const refrescar = async () => {
    await Promise.all([
      cliente.invalidateQueries({ queryKey: ['bank-statement-institutions'] }),
      cliente.invalidateQueries({ queryKey: ['bank-statement-institutions-summary'] }),
    ]);
  };

  const guardar = useMutation({
    mutationFn: saveInstitution,
    onSuccess: async (entidad) => {
      notify({
        tone: 'success',
        title: `Entidad ${entidad.code} guardada`,
        description:
          'El motor la usará para atribuir documentos en cuanto caduque su instantánea del padrón (≤ 1 min).',
      });
      setEditando(null);
      await refrescar();
    },
  });

  const desactivar = useMutation({
    mutationFn: deactivateInstitution,
    onSuccess: async (entidad) => {
      notify({
        tone: 'warning',
        title: `Entidad ${entidad.code} dada de baja`,
        description:
          'Sus extractos dejarán de atribuirse y pasarán a rechazarse como emisor no reconocido.',
      });
      await refrescar();
    },
  });

  const reactivar = useMutation({
    mutationFn: reactivateInstitution,
    onSuccess: async (entidad) => {
      notify({ tone: 'success', title: `Entidad ${entidad.code} reactivada` });
      await refrescar();
    },
  });

  const sembrar = useMutation({
    mutationFn: (seco: boolean) => seedInstitutions(seco),
    onSuccess: async (resultado) => {
      setEnsayo(resultado);
      if (!resultado.dryRun) {
        notify({
          tone: 'success',
          title: `Sembradas ${String(resultado.created.length)} entidades`,
          description: `El padrón de ASFI trae ${String(resultado.total)}; las que ya estaban no se tocaron.`,
        });
        await refrescar();
      }
    },
  });

  const cargarLogo = useMutation({
    mutationFn: (input: { code: string; base64: string; contentType: string }) =>
      uploadInstitutionLogo(input.code, {
        base64: input.base64,
        contentType: input.contentType,
      }),
    onSuccess: async (entidad) => {
      notify({ tone: 'success', title: `Logotipo de ${entidad.code} cargado` });
      // El formulario sigue abierto sobre la entidad recién escrita, así que se
      // reemplaza por la versión nueva: sin esto seguiría enseñando `hasLogo`
      // viejo y el botón diría «Cargar» sobre una entidad que ya lo tiene.
      setEditando(entidad);
      await refrescar();
    },
  });

  const quitarLogo = useMutation({
    mutationFn: removeInstitutionLogo,
    onSuccess: async (entidad) => {
      notify({ tone: 'warning', title: `Logotipo de ${entidad.code} retirado` });
      setEditando(entidad);
      await refrescar();
    },
  });

  const sincronizarLogos = useMutation({
    mutationFn: (seco: boolean) => syncInstitutionLogos(seco),
    onSuccess: async (resultado) => {
      if (resultado.dryRun) {
        notify({
          tone: 'info',
          title:
            resultado.applied.length === 0
              ? 'Todas las entidades ya tienen logotipo'
              : `Se cargarían ${String(resultado.applied.length)} logotipos`,
          description: `El motor trae ${String(resultado.downloaded)} logotipos oficiales y ${String(resultado.generated)} monogramas compuestos con la sigla ASFI.`,
        });
        return;
      }
      notify({
        tone: 'success',
        title: `Cargados ${String(resultado.applied.length)} logotipos`,
        description:
          'Los cargados a mano no se tocaron. Un monograma no es la marca de la entidad: la tabla lo rotula.',
      });
      await refrescar();
    },
  });

  const lista = useMemo(() => entidades.data ?? [], [entidades.data]);
  const faltantes = resumen.data?.missingFromSeed ?? [];
  const sinLogo = lista.filter((entidad) => !entidad.hasLogo).length;

  return (
    <div className="worker-entidades">
      <Panel
        title="Padrón de entidades financieras"
        meta={lista.length > 0 ? `${String(lista.length)} entidades` : undefined}
      >
        <p className="field-help">
          Es contra este padrón que el motor decide de quién es un extracto. Un documento que no se
          atribuye a ninguna entidad con licencia <strong>no se procesa</strong>: se manda a
          revisión si aún se ve financiero, y se rechaza si no.
        </p>

        {/*
         * Los faltantes van arriba y no en una pestaña de diagnóstico: un padrón
         * incompleto no da ningún error visible —cada extracto de la entidad que
         * falta se rechaza por su cuenta— así que la única forma de enterarse es
         * que la pantalla lo diga sin que nadie lo pregunte.
         */}
        {faltantes.length > 0 ? (
          <p className="entidad-faltantes">
            Faltan {faltantes.length} entidades de la nómina de ASFI: {faltantes.join(', ')}. Sus
            extractos se rechazan hoy como emisor no reconocido.
          </p>
        ) : null}

        <div className="entidad-barra">
          <button
            type="button"
            className="button button-primary"
            onClick={() => setEditando('nueva')}
          >
            <Plus size={15} aria-hidden="true" /> Nueva entidad
          </button>
          <button
            type="button"
            className="button"
            disabled={sembrar.isPending}
            onClick={() => sembrar.mutate(true)}
          >
            <DownloadCloud size={15} aria-hidden="true" /> Ver qué sembraría
          </button>
          <button
            type="button"
            className="button"
            disabled={sembrar.isPending || faltantes.length === 0}
            onClick={() => sembrar.mutate(false)}
          >
            Sembrar la nómina de ASFI
          </button>
          <button
            type="button"
            className="button"
            disabled={sincronizarLogos.isPending || sinLogo === 0}
            onClick={() => sincronizarLogos.mutate(false)}
          >
            <Images size={15} aria-hidden="true" />{' '}
            {sinLogo === 0
              ? 'Todas con logotipo'
              : `Cargar ${String(sinLogo)} logotipos que faltan`}
          </button>
          <label className="entidad-filtro">
            <input
              type="checkbox"
              checked={verBajas}
              onChange={(evento) => setVerBajas(evento.target.checked)}
            />
            Ver también las dadas de baja
          </label>
        </div>

        {ensayo?.dryRun === true ? (
          <p className="entidad-ensayo">
            {ensayo.created.length === 0
              ? 'No falta ninguna entidad: sembrar no escribiría nada.'
              : `Se crearían ${String(ensayo.created.length)} entidades: ${ensayo.created.join(', ')}. Ninguna existente se tocaría.`}
          </p>
        ) : null}

        {editando !== null ? (
          <InstitutionForm
            inicial={editando === 'nueva' ? undefined : editando}
            guardando={guardar.isPending}
            onGuardar={(entidad) => guardar.mutate(entidad)}
            onCancelar={() => setEditando(null)}
            logoOcupado={cargarLogo.isPending || quitarLogo.isPending}
            onCargarLogo={
              editando === 'nueva'
                ? undefined
                : (input) => cargarLogo.mutate({ code: editando.code, ...input })
            }
            onQuitarLogo={editando === 'nueva' ? undefined : () => quitarLogo.mutate(editando.code)}
          />
        ) : null}

        {entidades.isPending ? (
          <p className="entidad-vacio">Cargando el padrón…</p>
        ) : entidades.isError ? (
          <p className="entidad-vacio">No se pudo leer el padrón de entidades.</p>
        ) : (
          <InstitutionsTable
            entidades={lista}
            onEditar={(entidad) => setEditando(entidad)}
            onDesactivar={(entidad) => desactivar.mutate(entidad.code)}
            onReactivar={(entidad) => reactivar.mutate(entidad.code)}
          />
        )}
      </Panel>
    </div>
  );
}
