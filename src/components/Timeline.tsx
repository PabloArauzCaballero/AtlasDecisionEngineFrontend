import { CheckCircle2 } from 'lucide-react';

export interface TimelineItem {
  title: string;
  detail?: string;
  meta?: string;
  tone?: string;
}

export function Timeline({ items }: { items: readonly TimelineItem[] }) {
  return (
    <ol className="timeline">
      {items.map((item, index) => (
        <li key={`${item.title}-${index}`} className={item.tone ?? ''}>
          <CheckCircle2 />
          <div>
            <strong>{item.title}</strong>
            {item.detail ? <p>{item.detail}</p> : null}
            {item.meta ? <small>{item.meta}</small> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
