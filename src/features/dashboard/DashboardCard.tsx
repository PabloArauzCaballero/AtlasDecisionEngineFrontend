import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { ConceptIcon } from '../../components/ConceptIcon';
import type { ConceptKey } from '../../components/concept-icons';

interface DashboardCardProps {
  concept: ConceptKey;
  label: string;
  /** Valor real. `null` cuando el backend no pudo responder ese recurso. */
  value: number | null;
  suffix?: string;
  /** Decimales del contador; los porcentajes usan uno. */
  decimals?: number;
  /** Qué significa exactamente este número. */
  hint: string;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
  href?: string;
  actionLabel?: string;
}

/**
 * Tarjeta del panel de inicio.
 *
 * El número se anima al cargar pero llega enseguida a su valor real, y no
 * vuelve a animarse si un refresco devuelve el mismo dato. Cuando el recurso no
 * está disponible se muestra un guion y se dice por qué: preferimos un hueco
 * honesto a un cero que parece un dato.
 *
 * Al pasar el cursor la tarjeta se eleva, el icono reacciona y aparece su
 * acción; con el teclado ocurre lo mismo al enfocar el enlace, así que la
 * acción nunca queda escondida detrás del `hover`.
 */
export function DashboardCard({
  concept,
  label,
  value,
  suffix,
  decimals = 0,
  hint,
  tone = 'neutral',
  href,
  actionLabel = 'Abrir',
}: DashboardCardProps) {
  const unavailable = value === null;
  return (
    <article className={`dash-card dash-${tone} ${unavailable ? 'is-unavailable' : ''}`}>
      <header>
        <ConceptIcon concept={concept} tone={tone === 'neutral' ? 'accent' : tone} />
        <p>{label}</p>
      </header>
      <strong>
        {unavailable ? '—' : <AnimatedNumber value={value} suffix={suffix} decimals={decimals} />}
      </strong>
      <small>{unavailable ? 'Dato no disponible ahora mismo en el backend.' : hint}</small>
      {href ? (
        <Link className="dash-card-action" href={href}>
          {actionLabel} <ArrowRight size={13} aria-hidden="true" />
        </Link>
      ) : null}
    </article>
  );
}
