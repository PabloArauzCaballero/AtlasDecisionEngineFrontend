import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  meta?: string;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, meta, children, className = '' }: PanelProps) {
  return (
    <section className={`panel ${className}`.trim()}>
      <div className="panel-title">
        <span>{title}</span>
        {meta ? <small>{meta}</small> : null}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}
