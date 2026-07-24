'use client';

import { usePathname } from 'next/navigation';
import { tutorialForRoute } from './interactive-catalog';
import { TutorialButton } from './TutorialButton';

/**
 * Botón de tutorial interactivo resuelto por la RUTA actual. Colocado una sola vez
 * en PageHeader, da a CADA listado/herramienta su guía sin tener que cablearlo en
 * cada página. Las páginas de detalle siguen usando su propio <TutorialButton>.
 */
export function RouteTutorialButton() {
  const pathname = usePathname();
  const tutorialId = pathname ? tutorialForRoute(pathname) : null;
  if (!tutorialId) return null;
  return <TutorialButton tutorialId={tutorialId} />;
}
