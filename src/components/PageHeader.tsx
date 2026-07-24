import type { ReactNode } from 'react';
import { RouteTutorialButton } from '../features/tutorial/RouteTutorialButton';
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
        <h1 className="page-title-line">
          {title}
          {hint ? <InfoHint text={hint} label={`Qué es: ${title}`} /> : null}
          <RouteTutorialButton />
        </h1>
        <p className="page-description">{description}</p>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}
