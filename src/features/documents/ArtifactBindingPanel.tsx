'use client';

import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Panel } from '../../components/Panel';
import { StatusBadge } from '../../components/StatusBadge';
import { fetchArtifactSample, fetchBindableArtifacts, fetchCompatibility } from './documents.api';
import type { FieldValues } from './SchemaDrivenForm';

/**
 * Casar el documento con un artefacto, a nivel de datos.
 *
 * Responde la pregunta que decide si esta pareja sirve: **lo que el artefacto
 * responde, ¿lo acepta este documento?** Y trae lo que hacía falta para probarlo
 * sin inventar nada — un dato de prueba construido con la salida REAL del
 * artefacto, no un ejemplo escrito a mano.
 *
 * Un fixture inventado demuestra que la plantilla maqueta; no demuestra que
 * sirva para el artefacto que la va a usar. Esa es toda la diferencia.
 *
 * Lo que se informa y NO es un problema: los campos del artefacto que este
 * documento no usa. Un artefacto alimenta varios documentos y cada uno cuenta
 * una parte; exigir que se use todo obligaría a un documento por artefacto.
 */
export function ArtifactBindingPanel({
  templateId,
  onSample,
  disabled,
}: {
  templateId: string;
  onSample: (values: FieldValues) => void;
  disabled: boolean;
}) {
  const [artifactId, setArtifactId] = useState('');

  const artifacts = useQuery({
    queryKey: ['pdf-artifacts'],
    queryFn: ({ signal }) => fetchBindableArtifacts(signal),
    // Un 503 aquí no es un fallo: es «este despliegue no puede consultar
    // contratos de artefactos». Reintentarlo no lo va a cambiar.
    retry: false,
  });

  /**
   * La compatibilidad se resuelve para TODOS los artefactos, no sólo para el
   * elegido, porque es lo que decide cuáles se pueden ofrecer.
   *
   * Son tantas peticiones como artefactos con contrato, y es asumible: el motor
   * sólo compara dos contratos en memoria, y la caché de React Query las reutiliza
   * mientras no se cambie de documento. Traerlo en una sola llamada exigiría un
   * endpoint nuevo; con este volumen no compensa.
   */
  const compatibilidades = useQueries({
    queries: (artifacts.data ?? []).map((artifact) => ({
      queryKey: ['pdf-compatibility', templateId, artifact.artifactId],
      queryFn: ({ signal }: { signal?: AbortSignal }) =>
        fetchCompatibility(templateId, artifact.artifactId, signal),
      enabled: Boolean(templateId),
      retry: false,
    })),
  });

  const resolviendo = compatibilidades.some((q) => q.isLoading);
  const compatibles = (artifacts.data ?? []).filter(
    (_, i) => compatibilidades[i]?.data?.compatible === true,
  );
  // Cuántos se ocultaron. Un filtro SILENCIOSO es indistinguible de «no hay
  // ninguno», y son dos situaciones con remedios opuestos: una se arregla
  // publicando un artefacto, la otra corrigiendo el contrato de uno existente.
  const ocultos = (artifacts.data ?? [])
    .map((artifact, i) => ({ artifact, report: compatibilidades[i]?.data }))
    .filter((x) => x.report && !x.report.compatible)
    .map((x) => ({
      id: x.artifact.artifactId,
      titulo: x.artifact.title,
      // El PRIMER error, que es el que hay que resolver para que la pareja sirva.
      // Enumerar los cinco de un artefacto que no encaja es ruido: se corrige el
      // primero y los demás cambian.
      motivo: x.report?.findings.find((f) => f.severity === 'error'),
    }));

  const selected = artifactId || compatibles[0]?.artifactId || '';

  const compatibility = useQueries({
    queries: [
      {
        queryKey: ['pdf-compatibility', templateId, selected],
        queryFn: ({ signal }: { signal?: AbortSignal }) =>
          fetchCompatibility(templateId, selected, signal),
        enabled: Boolean(templateId) && selected !== '',
        retry: false,
      },
    ],
  })[0];

  const traerDatos = useMutation({
    mutationFn: () => fetchArtifactSample(templateId, selected),
    onSuccess: (sample) => onSample({ ...sample.payload }),
  });

  if (artifacts.isError) {
    return (
      <Panel
        title="Artefacto de origen"
        meta="Casar el documento con lo que responde un algoritmo."
      >
        <p className="doc-format__note">
          Este despliegue no puede consultar contratos de artefactos. Casar documentos con
          artefactos sólo existe con el generador montado dentro del motor, que es quien los tiene.
        </p>
      </Panel>
    );
  }

  const report = compatibility.data;

  return (
    <Panel
      title="Artefacto de origen"
      meta="Lo que el artefacto responde, ¿lo acepta este documento?"
    >
      {artifacts.isLoading || resolviendo ? (
        <p>Comprobando qué artefactos encajan con este documento…</p>
      ) : null}
      {artifacts.data?.length === 0 ? (
        <p className="doc-format__note">
          Ningún artefacto publicado declara contrato de salida. Sin él no hay nada con lo que
          casar: el contrato es lo que dice qué campos emite el algoritmo.
        </p>
      ) : null}

      {!resolviendo && artifacts.data && artifacts.data.length > 0 && compatibles.length === 0 ? (
        <p className="doc-format__note">
          Ninguno de los {artifacts.data.length} artefactos publicados encaja con este documento.
          Elija otro documento, o corrija el contrato de salida del artefacto para que publique los
          campos que éste exige.
        </p>
      ) : null}

      {compatibles.length > 0 ? (
        <>
          <div className="doc-picker">
            <label className="doc-form__label" htmlFor="doc-artifact">
              Artefacto
            </label>
            <select
              id="doc-artifact"
              value={selected}
              disabled={disabled || traerDatos.isPending}
              onChange={(event) => setArtifactId(event.target.value)}
            >
              {compatibles.map((artifact) => (
                <option key={artifact.artifactId} value={artifact.artifactId}>
                  {artifact.title} · {artifact.artifactId}@{artifact.artifactVersion} (
                  {artifact.outputFieldCount} campos)
                </option>
              ))}
            </select>
          </div>

          {ocultos.length > 0 ? (
            <details className="doc-binding__ocultos">
              <summary>
                {ocultos.length} artefacto(s) no se ofrecen porque no encajan con este documento
              </summary>
              {/* Se dice CUÁL y POR QUÉ, no sólo cuántos: un recuento a secas obliga
                  a adivinar si hay que corregir el artefacto o elegir otro documento,
                  que se arreglan en sitios distintos. */}
              <ul>
                {ocultos.map((o) => (
                  <li key={o.id}>
                    <strong>{o.titulo}</strong> <code>{o.id}</code>
                    {o.motivo ? (
                      <>
                        {' — '}
                        <code>{o.motivo.field}</code>: {o.motivo.problem}
                        {o.motivo.expected ? ` (documento: ${o.motivo.expected}` : ''}
                        {o.motivo.found ? ` · artefacto: ${o.motivo.found}` : ''}
                        {o.motivo.expected ? ')' : ''}
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {compatibility.isLoading ? <p>Comparando contratos…</p> : null}

          {report ? (
            <div className="doc-binding">
              <p className="doc-health__summary">
                <StatusBadge
                  value={report.compatible ? 'VALID' : 'INVALID'}
                  labels={{ VALID: 'Compatible', INVALID: 'Incompatible' }}
                />
                <span className="doc-health__detail">
                  {report.matched.length} campo(s) del documento los cubre este artefacto
                </span>
              </p>

              {report.findings.length > 0 ? (
                <ul className="doc-binding__findings">
                  {report.findings.map((finding) => (
                    <li
                      key={`${finding.field}-${finding.problem}`}
                      className={`doc-binding__finding doc-binding__finding--${finding.severity}`}
                    >
                      <code>{finding.field}</code> — {finding.problem}
                      {finding.expected ? ` (documento: ${finding.expected}` : ''}
                      {finding.found ? ` · artefacto: ${finding.found}` : ''}
                      {finding.expected ? ')' : ''}
                    </li>
                  ))}
                </ul>
              ) : null}

              {report.unusedByTemplate.length > 0 ? (
                <p className="doc-form__hint">
                  Este documento no usa {report.unusedByTemplate.length} campo(s) del artefacto:{' '}
                  <code>{report.unusedByTemplate.join(', ')}</code>. No es un problema — un
                  artefacto alimenta varios documentos y cada uno cuenta una parte.
                </p>
              ) : null}

              <div className="doc-actions">
                <button
                  type="button"
                  className="button"
                  disabled={disabled || traerDatos.isPending || !report.compatible}
                  onClick={() => traerDatos.mutate()}
                >
                  {traerDatos.isPending ? 'Trayendo…' : 'Rellenar con datos del artefacto'}
                </button>
              </div>

              {traerDatos.data && traerDatos.data.missing.length > 0 ? (
                <p className="doc-form__error" role="status">
                  El artefacto no declara ejemplo para: {traerDatos.data.missing.join(', ')}. Esos
                  campos quedan vacíos a propósito: rellenarlos con un valor plausible convertiría
                  la prueba en una demostración de que la plantilla pinta cualquier cosa.
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </Panel>
  );
}
