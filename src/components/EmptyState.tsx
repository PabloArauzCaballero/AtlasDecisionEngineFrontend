import type { ReactNode } from 'react';
import { Illustration, type IllustrationName } from './Illustration';

interface EmptyStateProps {
  illustration: IllustrationName;
  title: string;
  /** Qué es esto y para qué sirve, en lenguaje llano. */
  description: string;
  /** Ejemplo concreto que aterriza el concepto. Opcional. */
  example?: string;
  /** Botones o enlaces para salir del estado vacío (crear, ver tutorial…). */
  actions?: ReactNode;
  tone?: 'neutral' | 'success' | 'danger';
}

/**
 * Estado vacío explicativo: ilustración, qué falta, para qué sirve, un ejemplo
 * y la salida obvia. Sustituye a los "sin datos" secos, que dejaban al usuario
 * sin saber si algo se rompió o si sencillamente todavía no ha creado nada.
 *
 * La ilustración es decorativa a propósito: todo lo que comunica está también
 * en el texto, de modo que un lector de pantalla no pierde información.
 */
export function EmptyState({
  illustration,
  title,
  description,
  example,
  actions,
  tone = 'neutral',
}: EmptyStateProps) {
  return (
    <div className={`rich-empty-state rich-empty-${tone}`}>
      <Illustration name={illustration} size={148} />
      <h3>{title}</h3>
      <p>{description}</p>
      {example ? <p className="rich-empty-example">{example}</p> : null}
      {actions ? <div className="rich-empty-actions">{actions}</div> : null}
    </div>
  );
}
