import type { ReactNode } from 'react';
import { TutorialMenu } from '../features/tutorial/TutorialMenu';
import { InfoHint } from './InfoHint';

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  /** Plain-language "what is this tool for" hint shown as a ? beside the title. */
  hint?: string;
}

export function PageHeader({ eyebrow, title, description, actions, hint }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        {/*
          Los dos controles van JUNTO al `<h1>`, no dentro.
          Dentro, su texto entraba en el nombre accesible del encabezado de todas
          las páginas del portal: un lector de pantalla anunciaba «Matriz de
          Cobertura Qué es: Matriz de Cobertura Ayuda de esta pantalla» como si
          fuera el título. El envoltorio conserva la misma línea y el mismo
          `flex`, así que visualmente no se mueve nada.
        */}
        <div className="page-title-line">
          <h1>{title}</h1>
          {hint ? <InfoHint text={hint} label={`Qué es: ${title}`} /> : null}
          <TutorialMenu />
        </div>
        <p className="page-description">{description}</p>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}
