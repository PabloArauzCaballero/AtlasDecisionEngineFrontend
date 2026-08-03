'use client';

import { AlertTriangle, Check, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../../api/ApiError';
import { Alert } from '../../components/Alert';
import { ConfirmButton } from '../../components/ConfirmButton';
import { display, type UnknownRecord } from '../../utils/records';
import { ActionForm } from '../graph-editor/ActionForm';
import type { BankEntry, VersionGraph } from './action-bank';
import type { useActionWrite } from './useActionBank';

interface Props {
  /** Entrada del banco a aplicar, o null para crear una acción nueva. */
  entry: BankEntry | null;
  versions: VersionGraph[];
  write: ReturnType<typeof useActionWrite>;
  onClose: () => void;
}

/**
 * Aplica una acción del banco a un algoritmo concreto.
 *
 * El banco es un repertorio; ejecutarse, se ejecuta siempre dentro de una
 * versión. Este panel es el puente: elige el algoritmo destino, deja ajustar la
 * definición antes de escribirla y dice de antemano si allí ya existe —añadir y
 * reemplazar no significan lo mismo cuando la versión está desplegada—.
 */
export function ActionTargetPanel({ entry, versions, write, onClose }: Props) {
  const present = entry ? entry.origins.map((origin) => origin.versionId) : [];
  const [versionId, setVersionId] = useState(present[0] ?? versions[0]?.versionId ?? '');
  const target = versions.find((version) => version.versionId === versionId);
  const exists = present.includes(versionId);
  const deployed = Boolean(target && target.status.startsWith('DEPLOYED'));

  const apply = (action: UnknownRecord) => {
    write.mutate({ versionId, action }, { onSuccess: onClose });
  };

  return (
    <div className="action-target">
      <label className="field">
        <span>{entry ? 'Algoritmo destino' : 'Algoritmo inicial'}</span>
        <select value={versionId} onChange={(event) => setVersionId(event.target.value)}>
          {versions.map((version) => (
            <option key={version.versionId} value={version.versionId}>
              {version.artifactCode} · {version.semanticVersion} · {version.status}
              {present.includes(version.versionId) ? ' · ya la tiene' : ''}
            </option>
          ))}
        </select>
        <small className="field-hint">
          {exists
            ? 'La acción ya existe en este algoritmo: se reemplazará su definición.'
            : entry
              ? 'La acción se añadirá al algoritmo; después podrás asignarla a un paso en el editor de grafo.'
              : 'El motor todavía guarda cada acción dentro de un algoritmo (no es un límite de este portal): elige uno para crearla y luego aplícala a los demás desde su fila en el banco.'}
        </small>
      </label>

      {deployed ? (
        <Alert tone="warning">
          <AlertTriangle size={14} aria-hidden="true" /> Esta versión está desplegada en producción.
          Cambiar sus acciones cambia decisiones que se están tomando ahora mismo.
        </Alert>
      ) : null}

      {entry && entry.consistency === 'DIVERGE' ? (
        <Alert tone="warning">
          <AlertTriangle size={14} aria-hidden="true" /> «{entry.code}» está definida de formas
          distintas según el algoritmo. Guardar aquí unifica sólo el destino elegido.
        </Alert>
      ) : null}

      <ActionForm
        key={`${entry?.code ?? 'nueva'}-${versionId}`}
        initial={entry?.source}
        onCancel={onClose}
        onCreate={apply}
      />

      {entry && exists ? (
        <ConfirmButton
          disabled={write.isPending}
          title={`¿Quitar ${entry.code} de ${target?.artifactCode ?? 'el algoritmo'}?`}
          confirmLabel="Quitar del algoritmo"
          description={
            <>
              <p>
                La acción deja de existir en {target?.artifactCode} {target?.semanticVersion}. Los
                pasos que la ejecutan se quedan sin ella y el algoritmo dejará de hacer eso.
              </p>
              {entry.usedBy ? (
                <p>
                  <b>La ejecutan ahora:</b> {entry.usedBy}
                </p>
              ) : (
                <p>Ningún paso la ejecuta, así que quitarla no cambia ninguna decisión.</p>
              )}
              {entry.origins.length > 1 ? (
                <p>Seguirá existiendo en los demás algoritmos que la declaran.</p>
              ) : (
                <p>Es el único algoritmo que la declara: desaparecerá del banco.</p>
              )}
            </>
          }
          onConfirm={() => write.mutate({ versionId, remove: entry.code }, { onSuccess: onClose })}
        >
          <Trash2 size={15} /> Quitar del algoritmo destino
        </ConfirmButton>
      ) : null}

      {write.isError ? <Alert tone="error">{errorMessage(write.error)}</Alert> : null}
      {write.isPending ? <p className="muted-text">Guardando en el algoritmo…</p> : null}
      {write.isSuccess ? (
        <p className="muted-text">
          <Check size={14} aria-hidden="true" /> Guardado en{' '}
          {display(target as unknown as UnknownRecord, 'artifactCode')}.
        </p>
      ) : null}
    </div>
  );
}
