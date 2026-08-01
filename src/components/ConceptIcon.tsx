import { CONCEPTS, type ConceptKey } from './concept-icons';
import { Tooltip } from './Tooltip';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

interface ConceptIconProps {
  concept: ConceptKey;
  /** Texto accesible más específico que el del catálogo. */
  label?: string;
  /** Explicación del tooltip; por defecto la del catálogo. */
  hint?: string;
  tone?: Tone;
  size?: number;
  /**
   * Marca el icono como decorativo: se oculta a los lectores de pantalla y no
   * entra en el orden de tabulación. Úsalo sólo cuando el texto contiguo ya
   * comunica el mismo significado.
   */
  decorative?: boolean;
}

/**
 * Insignia de concepto: dibuja siempre el mismo icono para el mismo concepto y
 * lo explica con un tooltip.
 *
 * Cuando no es decorativo el icono es enfocable con el teclado (`tabIndex=0` y
 * `role="img"`), así el tooltip también aparece navegando sin ratón, y expone
 * su significado como nombre accesible en lugar de quedarse en pura decoración.
 */
export function ConceptIcon({
  concept,
  label,
  hint,
  tone = 'neutral',
  size = 16,
  decorative = false,
}: ConceptIconProps) {
  const definition = CONCEPTS[concept];
  const Icon = definition.icon;
  const text = label ?? definition.label;

  if (decorative) {
    return (
      <span className={`concept-icon concept-${tone}`} aria-hidden="true">
        <Icon size={size} />
      </span>
    );
  }

  return (
    <Tooltip content={hint ?? definition.hint}>
      <span className={`concept-icon concept-${tone}`} role="img" aria-label={text} tabIndex={0}>
        <Icon size={size} />
      </span>
    </Tooltip>
  );
}

interface ConceptChipProps {
  concept: ConceptKey;
  /** Texto visible; por defecto la etiqueta del catálogo. */
  children?: string;
  tone?: Tone;
  size?: number;
}

/**
 * Icono + etiqueta visible. Al haber texto, el icono se marca decorativo (no se
 * lee dos veces) y el tooltip explica el concepto para quien no lo conoce.
 */
export function ConceptChip({ concept, children, tone = 'neutral', size = 14 }: ConceptChipProps) {
  const definition = CONCEPTS[concept];
  const Icon = definition.icon;
  return (
    <Tooltip content={definition.hint}>
      <span className={`concept-chip concept-${tone}`} tabIndex={0}>
        <Icon size={size} aria-hidden="true" />
        <span>{children ?? definition.label}</span>
      </span>
    </Tooltip>
  );
}
