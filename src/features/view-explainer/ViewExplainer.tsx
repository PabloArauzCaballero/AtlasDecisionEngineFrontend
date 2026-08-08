'use client';

import { BookOpen, ChevronDown, Cpu, Landmark } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  defaultOpen,
  explainerSection,
  readPreference,
  writePreference,
} from './explainer-preference';
import { resolveExplanation } from './view-explanations';
import { viewExamples } from './view-examples';

/**
 * Panel por pantalla que explica, a nivel de negocio y de sistemas, para qué
 * sirve la vista actual. Se resuelve por ruta y se monta en el shell, así que
 * aparece en todas las secciones. Recuerda si el usuario lo colapsó, y lo
 * recuerda POR SECCIÓN: plegarlo en una pantalla ya no lo pliega en las demás.
 */
export function ViewExplainer() {
  const pathname = usePathname() ?? '';
  const explanation = resolveExplanation(pathname);
  // El ejemplo se resuelve con la MISMA clave que la explicación (primer segmento
  // de la ruta), así que una vista de detalle hereda el de su sección.
  const example = viewExamples[explainerSection(pathname)];
  /* El valor inicial sale de la ruta, no de `true` fijo: en una mesa de trabajo
     el banner nace plegado y así no se ve abrirse y cerrarse en el primer
     pintado. La ruta la conocen igual el servidor y el cliente, así que no hay
     discrepancia de hidratación. */
  const [open, setOpen] = useState(() => defaultOpen(pathname));

  useEffect(() => {
    const saved = readPreference(pathname);
    setOpen(saved === null ? defaultOpen(pathname) : saved);
  }, [pathname]);

  if (!explanation) return null;

  const toggle = () =>
    setOpen((value) => {
      const next = !value;
      writePreference(pathname, next);
      return next;
    });

  return (
    <section className="view-explainer" aria-label="Explicación de la pantalla">
      <button className="view-explainer-head" type="button" onClick={toggle} aria-expanded={open}>
        <span className="view-explainer-title">
          <BookOpen size={18} aria-hidden />
          <span>
            <strong>{explanation.module}</strong> — qué es esta pantalla (negocio y sistemas)
          </span>
        </span>
        <ChevronDown
          className={open ? 'view-explainer-chevron open' : 'view-explainer-chevron'}
          size={18}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="view-explainer-body">
          <article className="ve-card ve-business">
            <header>
              <Landmark size={16} aria-hidden /> Explicación de negocio
            </header>
            <p>{explanation.business}</p>
            {/* Un caso concreto: la explicación dice PARA QUÉ sirve la pantalla,
                y esto qué harías tú hoy con ella. Sin el ejemplo, quien no conoce
                el dominio se queda con una definición que no sabe aplicar. */}
            {example ? (
              <p className="ve-example">
                <b>Por ejemplo:</b> {example}
              </p>
            ) : null}
          </article>
          <article className="ve-card ve-systems">
            <header>
              <Cpu size={16} aria-hidden /> Explicación de sistemas
            </header>
            <p>{explanation.systems}</p>
          </article>
        </div>
      ) : null}
    </section>
  );
}
