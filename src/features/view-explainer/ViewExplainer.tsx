'use client';

import { BookOpen, ChevronDown, Cpu, Landmark } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { resolveExplanation } from './view-explanations';
import { viewExamples } from './view-examples';

const STORAGE_KEY = 'de.viewExplainer.open';

/**
 * Panel por pantalla que explica, a nivel de negocio y de sistemas, para qué
 * sirve la vista actual. Se resuelve por ruta y se monta en el shell, así que
 * aparece en todas las secciones. Recuerda si el usuario lo colapsó.
 */
export function ViewExplainer() {
  const pathname = usePathname() ?? '';
  const explanation = resolveExplanation(pathname);
  // El ejemplo se resuelve con la MISMA clave que la explicación (primer segmento
  // de la ruta), así que una vista de detalle hereda el de su sección.
  const example = viewExamples[pathname.split('/').filter(Boolean)[0] ?? ''];
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved !== null) setOpen(saved === '1');
  }, []);

  if (!explanation) return null;

  const toggle = () =>
    setOpen((value) => {
      const next = !value;
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
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
