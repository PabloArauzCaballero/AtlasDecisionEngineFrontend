'use client';

import { CopyButton } from '../../components/CopyButton';
import { Field } from '../../components/Field';

interface Props {
  /** Lo escrito en el campo. Vacío = que el motor invente una nueva. */
  value: string;
  onChange: (seed: string) => void;
}

/**
 * La semilla de un lote de valores de prueba.
 *
 * Los tutoriales prometían «repite la semilla para obtener los mismos valores» y ningún botón
 * la mandaba: cada pulsación pedía una nueva al motor. Vacía sigue siendo lo normal —explorar
 * valores distintos—; escrita, el motor devuelve exactamente el mismo lote para la misma clase
 * y el mismo número de casos.
 */
export function SampleSeedField({ value, onChange }: Props) {
  return (
    <Field
      className="sample-bar-count"
      label="Semilla"
      tooltip="Vacía genera una nueva en cada pulsación. Escribe la de un lote anterior, con la misma clase y cantidad, para obtener exactamente los mismos valores."
    >
      <input
        placeholder="nueva"
        maxLength={64}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

/** La semilla que devolvió el motor, visible y copiable, con un atajo para fijarla. */
export function UsedSeed({ seed, onReuse }: { seed: string; onReuse: (seed: string) => void }) {
  if (!seed) return null;
  return (
    <small className="field-hint">
      Lote generado con la semilla {seed}. <CopyButton text={seed} label="semilla" />{' '}
      <button type="button" className="button" onClick={() => onReuse(seed)}>
        Fijar esta semilla
      </button>
    </small>
  );
}
