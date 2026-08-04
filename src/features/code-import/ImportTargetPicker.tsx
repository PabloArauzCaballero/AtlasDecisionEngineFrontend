'use client';

import { useMutation } from '@tanstack/react-query';
import { FilePlus2, GitBranch, PackagePlus } from 'lucide-react';
import { useState } from 'react';
import { apiRequest } from '../../api/http-client';
import { Alert } from '../../components/Alert';
import { ArtifactVersionPicker } from '../../components/ArtifactVersionPicker';
import { errorMessage } from '../../api/ApiError';

/**
 * Dónde va a parar el código importado.
 *
 * Antes sólo se podía guardar dentro de una versión BORRADOR que ya existiera, así
 * que importar un algoritmo nuevo obligaba a irse a otra pantalla, crear el
 * artefacto a mano, volver y buscarlo — y quien no lo sabía se quedaba con el
 * botón de guardar apagado, sin explicación. Un importador que no puede crear
 * nada sólo sirve para reemplazar lo que ya existe.
 *
 * Las tres formas de aterrizar son las que el backend ya soporta:
 *   - artefacto NUEVO           -> POST /v1/artifacts (crea su primera versión)
 *   - versión NUEVA de uno vivo -> POST /v1/artifact-versions/{id}/clone
 *   - versión borrador existente-> la de siempre
 */
type Mode = 'NEW_ARTIFACT' | 'NEW_VERSION' | 'EXISTING_DRAFT';

interface Props {
  versionId: string;
  onVersionChange: (versionId: string) => void;
  /** El artefacto recién creado o clonado llega con su lock version en 1. */
  onLockVersionChange?: (lockVersion: string) => void;
}

/**
 * `POST /v1/artifacts` responde con el ARTEFACTO, no con su versión: su `id` es
 * el del artefacto y tomarlo por el de la versión mandaría el código a un
 * destino inexistente. La primera versión viaja en `versions[0]`, con su propio
 * `lockVersion`, que es el que exige el guardado optimista.
 */
interface VersionRef {
  id: string;
  status?: string;
  lockVersion?: number;
}

interface CreatedArtifact {
  id?: string;
  versions?: VersionRef[];
  /** El clonado sí devuelve la versión directamente. */
  artifactVersionId?: string;
  versionId?: string;
  lockVersion?: number;
}

const MODES: ReadonlyArray<{ id: Mode; label: string; hint: string }> = [
  {
    id: 'NEW_ARTIFACT',
    label: 'Crear un algoritmo nuevo',
    hint: 'Para código que todavía no existe en el portal. Se crea con su primera versión en borrador.',
  },
  {
    id: 'NEW_VERSION',
    label: 'Nueva versión de uno existente',
    hint: 'Para sustituir la lógica de un algoritmo que ya está publicado, sin tocar la versión viva.',
  },
  {
    id: 'EXISTING_DRAFT',
    label: 'Un borrador que ya tengo abierto',
    hint: 'Para seguir trabajando sobre una versión en borrador que ya habías creado.',
  },
];

export function ImportTargetPicker({ versionId, onVersionChange, onLockVersionChange }: Props) {
  const [mode, setMode] = useState<Mode>('NEW_ARTIFACT');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [sourceVersionId, setSourceVersionId] = useState('');

  /*
   * Los dos caminos se tratan por separado A PROPÓSITO: en la respuesta de
   * creación `id` es el del ARTEFACTO, y en la del clonado es el de la VERSIÓN.
   * Un único `?? created.id` de conveniencia mandaría el código a un id de
   * artefacto tomado por versión, y el guardado fallaría sin decir por qué.
   */
  const applyVersion = (id: string, lockVersion: number | undefined) => {
    if (!id) return;
    onVersionChange(id);
    onLockVersionChange?.(String(lockVersion ?? 1));
  };

  const createArtifact = useMutation({
    mutationFn: () =>
      apiRequest<CreatedArtifact>('/v1/artifacts', {
        method: 'POST',
        body: {
          artifactCode: code.trim().toUpperCase(),
          artifactType: 'CREDIT_POLICY',
          name: name.trim() || code.trim(),
          ownerTeam: 'RISK_DECISIONING',
          businessPurpose: 'Algoritmo importado desde código.',
          riskDomain: 'CREDIT_ORIGINATION',
        },
      }),
    onSuccess: async (artifact) => {
      // La creación responde con el artefacto y SIN sus versiones: hay que
      // releerlo para saber cuál es el borrador que el importador puede escribir.
      const full = await apiRequest<CreatedArtifact>(
        `/v1/artifacts/${encodeURIComponent(String(artifact.id ?? ''))}`,
      );
      const draft = full.versions?.find((v) => v.status === 'DRAFT') ?? full.versions?.[0];
      applyVersion(String(draft?.id ?? ''), draft?.lockVersion);
    },
  });

  const cloneVersion = useMutation({
    mutationFn: () =>
      apiRequest<CreatedArtifact>(
        `/v1/artifact-versions/${encodeURIComponent(sourceVersionId)}/clone`,
        {
          method: 'POST',
          body: { changeSummary: 'Lógica reemplazada por importación de código.' },
        },
      ),
    // El clonado sí devuelve la versión: su `id` ya es el que hace falta.
    onSuccess: (version) => applyVersion(String(version.id ?? ''), version.lockVersion),
  });

  const active = MODES.find((entry) => entry.id === mode);

  return (
    <section className="import-target">
      <div className="field">
        <span>¿Dónde quieres guardarlo?</span>
        <div className="import-target-modes">
          {MODES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={mode === entry.id ? 'button button-primary' : 'button'}
              aria-pressed={mode === entry.id}
              onClick={() => setMode(entry.id)}
            >
              {entry.id === 'NEW_ARTIFACT' ? <PackagePlus size={14} /> : null}
              {entry.id === 'NEW_VERSION' ? <GitBranch size={14} /> : null}
              {entry.id === 'EXISTING_DRAFT' ? <FilePlus2 size={14} /> : null}
              {entry.label}
            </button>
          ))}
        </div>
        {active ? <small className="field-hint">{active.hint}</small> : null}
      </div>

      {mode === 'NEW_ARTIFACT' ? (
        <>
          <label className="field">
            <span>Código del algoritmo</span>
            <input
              value={code}
              placeholder="SCORING_CONSUMO"
              onChange={(event) => setCode(event.target.value)}
            />
            <small className="field-hint">
              Mayúsculas, números y guion bajo. Es el identificador con el que se le llamará.
            </small>
          </label>
          <label className="field">
            <span>Nombre legible</span>
            <input
              value={name}
              placeholder="Scoring de consumo"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="button"
            disabled={code.trim().length < 3 || createArtifact.isPending}
            onClick={() => createArtifact.mutate()}
          >
            <PackagePlus size={15} /> Crear el algoritmo y su primera versión
          </button>
          {createArtifact.isError ? (
            <Alert tone="error">{errorMessage(createArtifact.error)}</Alert>
          ) : null}
        </>
      ) : null}

      {mode === 'NEW_VERSION' ? (
        <>
          <ArtifactVersionPicker
            versionId={sourceVersionId}
            onVersionChange={setSourceVersionId}
            versionLabel="Versión de la que partir"
          />
          <button
            type="button"
            className="button"
            disabled={!sourceVersionId || cloneVersion.isPending}
            onClick={() => cloneVersion.mutate()}
          >
            <GitBranch size={15} /> Crear una versión nueva a partir de ésta
          </button>
          {cloneVersion.isError ? (
            <Alert tone="error">{errorMessage(cloneVersion.error)}</Alert>
          ) : null}
        </>
      ) : null}

      {mode === 'EXISTING_DRAFT' ? (
        <ArtifactVersionPicker
          versionId={versionId}
          onVersionChange={onVersionChange}
          versionLabel="Versión destino (borrador)"
        />
      ) : null}

      {versionId && mode !== 'EXISTING_DRAFT' ? (
        <Alert tone="success">
          Destino listo: versión <b>{versionId}</b>. Ya puedes guardar el código abajo.
        </Alert>
      ) : null}
    </section>
  );
}
