'use client';

import { TUTORIAL_CATEGORY_LABELS, type TutorialCategory } from './interactive-types';
import { TUTORIAL_CATEGORY_ICONS, tutorialGroupAnchor } from './tutorial-category-icons';

export interface ModuleTally {
  category: TutorialCategory;
  total: number;
  completed: number;
}

interface Props {
  modules: readonly ModuleTally[];
}

/**
 * Índice de módulos: un salto a cada grupo, con cuánto llevas en él.
 *
 * Con cuarenta recorridos en una columna, «Resolver errores» quedaba cinco pantallas más abajo y
 * nada en la parte de arriba decía que existía. Es navegación, no filtro: el filtro por módulo
 * sigue en su desplegable, y aquí pulsar sólo desplaza, así que nunca esconde nada.
 */
export function TutorialModuleNav({ modules }: Props) {
  if (modules.length < 2) return null;

  return (
    <nav className="tutorial-modules" aria-label="Módulos del catálogo">
      {modules.map(({ category, total, completed }) => {
        const Icon = TUTORIAL_CATEGORY_ICONS[category];
        const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
        return (
          <a
            key={category}
            className="tutorial-module"
            href={`#${tutorialGroupAnchor(category)}`}
            data-category={category}
          >
            <span className="tutorial-module-icon" aria-hidden>
              <Icon size={16} />
            </span>
            <span className="tutorial-module-text">
              <strong>{TUTORIAL_CATEGORY_LABELS[category]}</strong>
              <small>
                {completed}/{total} hechos
              </small>
            </span>
            <span className="tutorial-module-bar" aria-hidden>
              {percent > 0 ? <span style={{ width: `${percent}%` }} /> : null}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
