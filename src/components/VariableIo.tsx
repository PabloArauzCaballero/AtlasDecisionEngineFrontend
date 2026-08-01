import { LogIn, LogOut, Star } from 'lucide-react';
import { display, type UnknownRecord } from '../utils/records';

/**
 * Distintivo único para el sentido de una variable en una decisión.
 *
 * La dirección no es un detalle técnico: una ENTRADA es un dato que hay que
 * aportar al motor y una SALIDA es un resultado que el motor produce. Mezclarlas
 * en una lista indistinguible es lo que hacía imposible saber qué pedir al
 * simular o qué devuelve un algoritmo, así que el mismo distintivo se usa en
 * todas las vistas (catálogo, editor, simulador, importar código).
 */
export type IoDirection = 'INPUT' | 'OUTPUT' | 'OUTPUT_PRIMARY';

export function directionOf(usageType: unknown): IoDirection {
  const value = String(usageType ?? 'INPUT').toUpperCase();
  if (value === 'OUTPUT_PRIMARY') return 'OUTPUT_PRIMARY';
  return value.startsWith('OUTPUT') ? 'OUTPUT' : 'INPUT';
}

export function isOutput(usageType: unknown): boolean {
  return directionOf(usageType) !== 'INPUT';
}

const COPY: Record<IoDirection, { label: string; title: string }> = {
  INPUT: { label: 'Entrada', title: 'Dato que ENTRA a la decisión: hay que aportarlo al evaluar.' },
  OUTPUT: { label: 'Salida', title: 'Resultado que la decisión DEVUELVE al resto del sistema.' },
  OUTPUT_PRIMARY: {
    label: 'Salida principal',
    title: 'El resultado principal de la decisión (el que resume el desenlace).',
  },
};

export function IoBadge({ usageType }: { usageType: unknown }) {
  const direction = directionOf(usageType);
  const copy = COPY[direction];
  const className =
    direction === 'INPUT'
      ? 'io-badge io-in'
      : `io-badge io-out${direction === 'OUTPUT_PRIMARY' ? ' io-primary' : ''}`;
  return (
    <span className={className} title={copy.title}>
      {direction === 'INPUT' ? <LogIn size={11} /> : <LogOut size={11} />}
      {copy.label}
      {direction === 'OUTPUT_PRIMARY' ? <Star size={10} fill="currentColor" /> : null}
    </span>
  );
}

interface VariableListProps {
  title: string;
  hint: string;
  tone: 'in' | 'out';
  variables: UnknownRecord[];
  /** Campo con el código de la variable (varía según el endpoint). */
  codeKey?: string;
  emptyText?: string;
}

/** Lista de variables agrupadas por sentido, con su tipo de dato. */
export function VariableList({
  title,
  hint,
  tone,
  variables,
  codeKey = 'variableCode',
  emptyText,
}: VariableListProps) {
  return (
    <section className={`io-list io-list-${tone}`}>
      <h5>
        {tone === 'in' ? <LogIn size={12} /> : <LogOut size={12} />} {title}
        <span>{variables.length}</span>
      </h5>
      <p className="muted-text">{hint}</p>
      {variables.length ? (
        <ul className="io-list-items">
          {variables.map((variable, index) => (
            <li key={`${display(variable, codeKey, 'code')}-${index}`}>
              <b>{display(variable, codeKey, 'code')}</b>
              <small>{display(variable, 'dataType')}</small>
              {directionOf(variable.usageType) === 'OUTPUT_PRIMARY' ? (
                <span className="io-primary-mark" title="Resultado principal">
                  <Star size={11} fill="currentColor" /> principal
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <small className="field-hint">{emptyText ?? 'Ninguna declarada.'}</small>
      )}
    </section>
  );
}
