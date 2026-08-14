'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Panel } from '../../components/Panel';
import { StatusBadge } from '../../components/StatusBadge';
import { useNotifications } from '../../notifications/useNotifications';
import { downloadTemplateFormatExample, fetchPdfHealth, fetchPdfTemplates } from './documents.api';
import { saveFile } from './save-file';

/**
 * Panel del generador documental: ¿está sano y qué sabe emitir?
 *
 * No usa `WorkerDashboard` —el panel de los otros cuatro— y no es por comodidad:
 * aquél se alimenta del catálogo de workers del motor, de sus métricas y de su
 * mapa de ejecuciones, y el generador no está en ninguno de los tres. Pintarlo
 * con ese panel mostraría cero ejecuciones y cero errores para siempre, que se
 * lee como «no se usa» en vez de como «esto no se mide así».
 *
 * Lo que sí hay que mirar aquí lo dice `/pdf/health`: si el navegador responde,
 * cuántos documentos hay registrados, si los recursos resuelven y —el aviso que
 * más importa— si hay una tipografía embebida o se depende de la del sistema.
 */
export function DocumentGeneratorPanel({ active }: { active: boolean }) {
  const { notify } = useNotifications();

  const health = useQuery({
    queryKey: ['pdf-health'],
    queryFn: ({ signal }) => fetchPdfHealth(signal),
    // La pestaña que no se ve sigue montada para conservar su estado; que no
    // siga además preguntándole al motor cada treinta segundos.
    enabled: active,
    refetchInterval: active ? 30_000 : false,
  });

  const templates = useQuery({
    queryKey: ['pdf-templates'],
    queryFn: ({ signal }) => fetchPdfTemplates(signal),
    enabled: active,
  });

  const formatExample = useMutation({
    mutationFn: downloadTemplateFormatExample,
    onSuccess: (file) => {
      saveFile(file.blob, file.fileName);
      notify({
        tone: 'success',
        title: 'Formato descargado',
        description: 'Es un paquete funcional: se puede publicar tal cual y genera un PDF.',
      });
    },
  });

  return (
    <>
      <Panel
        title="Estado del generador"
        meta="Motor de impresión, catálogo, recursos, tipografía y almacenamiento."
      >
        {health.isLoading ? <p>Consultando el generador…</p> : null}
        {health.isError ? <p>El generador documental no respondió a la sonda.</p> : null}

        {health.data ? (
          <>
            <p className="doc-health__summary">
              <StatusBadge
                value={health.data.status === 'ok' ? 'HEALTHY' : 'PARTIAL'}
                labels={{ HEALTHY: 'Operativo', PARTIAL: 'Degradado' }}
              />
              <span className="doc-health__engine">
                {health.data.renderer} · plantillas con {health.data.templateEngine}
              </span>
            </p>

            <ul className="doc-health__checks">
              {health.data.checks.map((check) => (
                <li key={check.name} className="doc-health__check">
                  <StatusBadge
                    value={check.ok ? 'HEALTHY' : 'WARNING'}
                    labels={{ HEALTHY: 'OK', WARNING: 'Aviso' }}
                  />
                  <span className="doc-health__name">{check.name}</span>
                  {check.detail ? <span className="doc-health__detail">{check.detail}</span> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Panel>

      <Panel
        title="Documentos publicados"
        meta="Cada uno declara su contrato de datos; la consola construye el formulario a partir de él."
      >
        {templates.isLoading ? <p>Cargando el catálogo…</p> : null}
        {templates.data?.length === 0 ? (
          <p>El motor no publica ningún documento en este despliegue.</p>
        ) : null}

        <ul className="doc-catalog">
          {(templates.data ?? []).map((template) => (
            <li key={`${template.id}@${template.version}`} className="doc-catalog__item">
              <p className="doc-catalog__title">
                {template.title}
                {template.deprecated ? (
                  <StatusBadge value="DRAFT" labels={{ DRAFT: 'Obsoleto' }} />
                ) : null}
              </p>
              <p className="doc-catalog__id">
                <code>
                  {template.id}@{template.version}
                </code>
                {template.classification ? ` · ${template.classification}` : ''}
              </p>
              <p className="doc-catalog__description">{template.description}</p>
              {template.requiredFields.length > 0 ? (
                <p className="doc-catalog__required">
                  Obligatorios: {template.requiredFields.join(', ')}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Publicar un documento nuevo"
        meta="El motor acepta plantillas por API. Aquí se descarga el formato que espera."
      >
        <p className="doc-format__note">
          El paquete de ejemplo es funcional: se puede publicar tal cual y genera un PDF. Trae un
          documento completo con todos los tipos de campo, para usarlo de punto de partida.
        </p>
        <p className="doc-format__note">
          La publicación exige credencial de administración y va contra el motor, no por esta
          pantalla: sube plantillas al despliegue y no es una acción de uso diario.
        </p>
        <button
          type="button"
          className="button"
          disabled={formatExample.isPending}
          onClick={() => formatExample.mutate()}
        >
          {formatExample.isPending ? 'Descargando…' : 'Descargar formato de ejemplo'}
        </button>
      </Panel>
    </>
  );
}
