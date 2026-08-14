'use client';

import { useState } from 'react';
import { CopyButton } from '../../components/CopyButton';
import { StatusBadge } from '../../components/StatusBadge';
import { LibraryChip } from '../libraries/LibraryChip';
import { asRows, display, type UnknownRecord } from '../../utils/records';
import { dataTypeLabel } from '../../contracts/data-types';
import {
  IMPLEMENTATION_LABELS,
  type ImplementationKind,
  type OperationNode,
} from './calculated-field.types';
import { summarizeOperation } from './operation-summary';
import { CalculatedFieldResultContract } from './CalculatedFieldResultContract';
import { CalculatedFieldTryPanel } from './CalculatedFieldTryPanel';

interface Props {
  versions: UnknownRecord[];
  onPromote: (versionId: string, status: string) => void;
}

/** Siguiente estado alcanzable, en el orden en que se gobierna una versión. */
const NEXT_STATUS: Record<string, string[]> = {
  DRAFT: ['IN_REVIEW'],
  IN_REVIEW: ['APPROVED', 'DRAFT'],
  APPROVED: ['PUBLISHED', 'DRAFT'],
  PUBLISHED: ['DEPRECATED'],
  DEPRECATED: ['RETIRED'],
  RETIRED: [],
};

const STATUS_ACTION_LABEL: Record<string, string> = {
  IN_REVIEW: 'Enviar a revisión',
  APPROVED: 'Aprobar',
  PUBLISHED: 'Publicar',
  DRAFT: 'Devolver a borrador',
  DEPRECATED: 'Marcar obsoleta',
  RETIRED: 'Retirar',
};

/**
 * Resumen de una línea de lo que calcula la versión, sea cual sea su modalidad.
 * Para código se muestra la primera línea ejecutable: basta para reconocerlo sin
 * abrir el detalle.
 */
function formulaOf(version: UnknownRecord): string {
  if (version.operation) return summarizeOperation(version.operation as OperationNode);
  const source = display(version, 'sourceCode');
  if (source === '—') return '';
  const first = source
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('//') && !line.startsWith('#'));
  return first ?? '';
}

/** El texto que define la versión: su código, o el árbol visual ya legible. */
function codeOf(version: UnknownRecord): string {
  const source = display(version, 'sourceCode');
  if (source !== '—') return source;
  return version.operation ? summarizeOperation(version.operation as OperationNode) : '';
}

export function CalculatedFieldVersionList({ versions, onPromote }: Props) {
  /*
   * La versión más reciente empieza abierta: es la que se viene a leer, y dejarla plegada
   * escondía el código y el contrato tras un clic que nadie sabía que había que dar.
   *
   * Se DERIVA en cada render en vez de sembrar el estado inicial. El estado inicial se
   * calcula una sola vez, y en ese momento las versiones todavía viajan por la red: la
   * lista llegaba vacía, la semilla quedaba fijada en el marcador de «sin dato» y ninguna
   * versión se abría nunca. `null` es «el usuario no ha elegido», distinto de `''`, que es
   * «las plegó todas a propósito».
   */
  const [chosenId, setChosenId] = useState<string | null>(null);
  const openId = chosenId ?? (versions.length ? display(versions[0], 'id') : '');

  if (!versions.length) return null;

  return (
    <ul className="calculated-version-list">
      {versions.map((version) => {
        const id = display(version, 'id');
        const status = display(version, 'status');
        const returns = version.returns as Record<string, unknown> | undefined;
        const open = openId === id;
        return (
          <li key={id}>
            <div className="calculated-version-head">
              <button
                type="button"
                onClick={() => setChosenId(open ? '' : id)}
                aria-expanded={open}
              >
                <b>v{display(version, 'versionNumber')}</b>
                <StatusBadge value={status} />
                <small>
                  {IMPLEMENTATION_LABELS[
                    display(version, 'implementationKind') as ImplementationKind
                  ] ?? display(version, 'implementationKind')}
                </small>
                <small>devuelve {dataTypeLabel(returns?.dataType)}</small>
                {/* Una versión que algún artefacto invoca no se puede retirar, y el motor
                    lo dice sólo al intentarlo. Mejor verlo antes de pulsar. */}
                {asRows(version.usedBy).length ? (
                  <small>la usan {asRows(version.usedBy).length} artefacto(s)</small>
                ) : null}
                {/* La fórmula es el dato que define el campo: estaba sólo dentro
                    del detalle desplegado, así que la lista no decía QUÉ calcula
                    ninguna de sus versiones. */}
                {formulaOf(version) ? (
                  <code className="version-formula">{formulaOf(version)}</code>
                ) : null}
              </button>
              <div className="calculated-version-actions">
                {(NEXT_STATUS[status] ?? []).map((next) => (
                  <button
                    key={next}
                    type="button"
                    className="button"
                    onClick={() => onPromote(id, next)}
                  >
                    {STATUS_ACTION_LABEL[next] ?? next}
                  </button>
                ))}
              </div>
            </div>

            {open ? (
              <div className="calculated-version-body">
                <div className="library-selected">
                  {asRows(version.libraries).map((library) => (
                    <LibraryChip key={display(library, 'id')} library={library} />
                  ))}
                </div>

                {codeOf(version) ? (
                  <figure className="code-figure">
                    <figcaption>
                      <span>{version.operation ? 'Operaciones' : 'Código de la versión'}</span>
                      <CopyButton text={codeOf(version)} label="código" className="button" />
                    </figcaption>
                    <pre className="code-block">{codeOf(version)}</pre>
                  </figure>
                ) : null}

                <CalculatedFieldResultContract version={version} />

                <dl className="definition-grid">
                  <div>
                    <dt>Código de error declarado</dt>
                    <dd className="mono">{String(returns?.errorCode ?? '—')}</dd>
                  </div>
                  <div>
                    <dt>Tiempo máximo</dt>
                    <dd>{display(version, 'timeoutMs')} ms</dd>
                  </div>
                  <div>
                    <dt>Huella de contenido</dt>
                    <dd className="mono" title={display(version, 'contentHash')}>
                      {display(version, 'contentHash').slice(0, 16)}…
                    </dd>
                  </div>
                </dl>

                <CalculatedFieldTryPanel
                  target={{ kind: 'VERSION', versionId: id }}
                  inputs={asRows(version.inputs)}
                  testCases={asRows(version.testCases)}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
