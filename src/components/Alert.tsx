import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';

interface AlertProps {
  tone?: 'error' | 'success' | 'info' | 'warning';
  children: ReactNode;
}

const ICONS = {
  error: AlertCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
} as const;

export function Alert({ tone = 'info', children }: AlertProps) {
  const Icon = ICONS[tone];
  return (
    <div
      className={`alert alert-${tone}`}
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
    >
      <Icon size={18} />
      <div>{children}</div>
    </div>
  );
}
