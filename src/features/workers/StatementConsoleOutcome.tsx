'use client';

import Link from 'next/link';
import { Alert } from '../../components/Alert';
import type { ConsoleOutcome } from './statement-console-outcome';

/**
 * El mensaje que se QUEDA en la consola de extractos: qué pasó con el PDF y adónde ir. Ver
 * `statement-console-outcome.ts` (por qué existe y cuándo sale).
 */
export function StatementConsoleOutcome({ outcome }: { outcome: ConsoleOutcome }) {
  return (
    <div className="statement-console-outcome" data-testid="statement-console-outcome">
      <Alert tone={outcome.tone}>
        <strong>{outcome.title}</strong>
        <p>{outcome.body}</p>
        {outcome.links.length > 0 ? (
          <p>
            {outcome.links.map((link, i) => (
              <span key={link.href}>
                {i > 0 ? ' · ' : null}
                <Link href={link.href}>{link.label}</Link>
              </span>
            ))}
          </p>
        ) : null}
      </Alert>
    </div>
  );
}
