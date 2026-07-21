import { AlertTriangle, XCircle } from 'lucide-react';

export interface CodeImportIssue {
  source: string;
  severity: 'ERROR' | 'WARNING';
  line: number;
  column?: number;
  message: string;
  code: string;
}

interface CodeImportIssuesListProps {
  issues: CodeImportIssue[];
}

/** Fase 5 — line-numbered syntax/contract/security/graph issues from a code import. */
export function CodeImportIssuesList({ issues }: CodeImportIssuesListProps) {
  if (!issues.length) {
    return (
      <div className="empty-state">
        Sin observaciones — el código está listo para generar el grafo.
      </div>
    );
  }
  return (
    <ul className="code-import-issues">
      {issues.map((issue, index) => (
        <li key={`${issue.code}-${index}`} className={`issue-${issue.severity.toLowerCase()}`}>
          {issue.severity === 'ERROR' ? (
            <XCircle size={14} aria-hidden="true" />
          ) : (
            <AlertTriangle size={14} aria-hidden="true" />
          )}
          <span className="issue-location">
            {issue.source} · línea {issue.line}
            {issue.column ? `:${issue.column}` : ''}
          </span>
          <span className="issue-message">{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}
