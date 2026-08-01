'use client';

import { useState } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { LibraryChip } from '../libraries/LibraryChip';
import { asRows, display, type UnknownRecord } from '../../utils/records';
import { dataTypeLabel } from '../../contracts/data-types';
import { IMPLEMENTATION_LABELS, type ImplementationKind } from './calculated-field.types';
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

export function CalculatedFieldVersionList({ versions, onPromote }: Props) {
  const [openId, setOpenId] = useState('');

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
              <button type="button" onClick={() => setOpenId(open ? '' : id)} aria-expanded={open}>
                <b>v{display(version, 'versionNumber')}</b>
                <StatusBadge value={status} />
                <small>
                  {IMPLEMENTATION_LABELS[
                    display(version, 'implementationKind') as ImplementationKind
                  ] ?? display(version, 'implementationKind')}
                </small>
                <small>devuelve {dataTypeLabel(returns?.dataType)}</small>
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

                {display(version, 'sourceCode') ? (
                  <pre className="code-block">{display(version, 'sourceCode')}</pre>
                ) : null}

                <dl className="definition-grid">
                  <dt>Si no puede calcular</dt>
                  <dd>{String(returns?.missingData ?? '—')}</dd>
                  <dt>División entre cero</dt>
                  <dd>{String(returns?.divisionByZero ?? '—')}</dd>
                  <dt>Fuera de rango</dt>
                  <dd>{String(returns?.outOfRange ?? '—')}</dd>
                  <dt>Código de error</dt>
                  <dd>
                    <code>{String(returns?.errorCode ?? '—')}</code>
                  </dd>
                  <dt>Huella de contenido</dt>
                  <dd>
                    <code>{display(version, 'contentHash').slice(0, 16)}…</code>
                  </dd>
                </dl>

                <CalculatedFieldTryPanel
                  versionId={id}
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
