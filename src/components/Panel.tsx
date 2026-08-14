import { useId, type ReactNode } from 'react';

interface PanelProps {
  title: string;
  meta?: string;
  children: ReactNode;
  className?: string;
  /**
   * Nivel del encabezado. `2` por defecto, que es el que sigue al `<h1>` de
   * `PageHeader`. Súbelo cuando el panel cuelgue de otro encabezado —un panel
   * dentro de una sección que ya tiene su `<h2>`— para no saltarte un nivel.
   */
  headingLevel?: 2 | 3 | 4;
  /**
   * Ancla para los recorridos guiados (`data-tutorial-id`).
   *
   * Va en el panel y no en un `<div>` que lo envuelva porque el envoltorio
   * cambiaría el `gap` de la columna de la página; y no se deriva del título
   * porque un rótulo se reescribe sin pensar en los tutoriales, y entonces el
   * paso deja de resaltar nada sin que nadie se entere.
   */
  tutorialId?: string;
}

/**
 * Sección de contenido con título.
 *
 * El título es un ENCABEZADO real, no un `<span>` con negrita.
 *
 * Lo era: `.panel-title span` lo maquillaba con `--type-base` y
 * `--weight-bold`, así que parecía un encabezado y no lo era para nadie que no
 * mirase la pantalla. Con 85 paneles siendo el contenedor principal de casi
 * todas las vistas, el portal entero no tenía más encabezado que el `<h1>` de la
 * página: quien navega saltando de encabezado —el modo dominante en lector de
 * pantalla— encontraba uno por vista y ninguna forma de llegar al contenido.
 * Y `<section>` sin nombre accesible tampoco se expone como región, con lo que
 * las 85 secciones eran `<div>` para la tecnología asistiva.
 *
 * `aria-labelledby` resuelve las dos cosas de una vez: da el encabezado y
 * nombra la región. Visualmente no cambia nada —los estilos se reescribieron
 * para apuntar al encabezado en vez de al `<span>`—.
 */
export function Panel({
  title,
  meta,
  children,
  className = '',
  headingLevel = 2,
  tutorialId,
}: PanelProps) {
  const titleId = useId();
  const Heading = `h${headingLevel}` as const;

  return (
    <section
      className={`panel ${className}`.trim()}
      aria-labelledby={titleId}
      data-tutorial-id={tutorialId}
    >
      <div className="panel-title">
        <Heading id={titleId}>{title}</Heading>
        {meta ? <small>{meta}</small> : null}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}
