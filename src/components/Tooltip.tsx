import type { ReactNode } from 'react';

/**
 * Tooltip accesible por CSS: aparece al pasar el cursor y también al enfocar el
 * control interno con el teclado (`:focus-within`). El texto se marca con
 * `role="tooltip"`; el nombre accesible del control va en su `aria-label`.
 */
export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <span className="tooltip-wrap">
      {children}
      <span className="tooltip-bubble" role="tooltip">
        {content}
      </span>
    </span>
  );
}
