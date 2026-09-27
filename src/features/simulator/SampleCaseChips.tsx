'use client';

import type { ImportedCase } from './sample-import';

interface Props {
  cases: ImportedCase[];
  active: number;
  onPick: (index: number) => void;
}

/** El carrusel de casos de una tanda: se recorren y se carga el que interesa. */
export function SampleCaseChips({ cases, active, onPick }: Props) {
  if (cases.length <= 1) return null;
  return (
    <div className="sample-bar-cases" role="group" aria-label="Casos disponibles">
      {cases.map((sample, index) => (
        <button
          key={sample.label}
          type="button"
          className="sample-case-chip"
          aria-pressed={index === active}
          onClick={() => onPick(index)}
        >
          {sample.label}
        </button>
      ))}
    </div>
  );
}
