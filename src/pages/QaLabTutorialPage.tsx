'use client';

import { ArrowLeft, Lightbulb } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { tutorialById } from '../features/tutorial/interactive-catalog';
import { NavLink } from '../navigation/NavLink';

/** El recorrido que esta página cuenta. Es el mismo que antes se lanzaba encima del laboratorio. */
const TUTORIAL_ID = 'qa-lab';

const sinNumero = (title: string) => title.replace(/^\d+\.\s*/, '');

/**
 * El tutorial del Laboratorio de pruebas, en SU página.
 *
 * El botón «Tutorial» del laboratorio arrancaba un recorrido encima de la pantalla: tapaba el
 * formulario que se quería usar y, al avanzar, se llevaba a la persona a otra vista. Para leer cómo
 * se usa el laboratorio no hace falta que nada se mueva: aquí están los mismos pasos, de arriba
 * abajo, y el laboratorio queda intacto en su pestaña.
 *
 * El texto sale del catálogo de recorridos (`interactive-catalog-lab.ts`), no de una copia: si un
 * paso se reescribe allí, esta página lo dice igual.
 */
export function QaLabTutorialPage() {
  const tutorial = tutorialById(TUTORIAL_ID);
  const steps = tutorial?.steps ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Calidad › Laboratorio de pruebas"
        title="Cómo usar el Laboratorio de pruebas"
        description={
          tutorial?.intro ?? 'Paso a paso, de elegir el algoritmo a leer los contraejemplos.'
        }
        actions={
          <NavLink href="/qa-lab" className="button">
            <ArrowLeft size={15} aria-hidden /> Volver al laboratorio
          </NavLink>
        }
      />

      <ol className="tutorial-page-steps" data-testid="qa-lab-tutorial-steps">
        {steps.map((step, index) => (
          <li className="tutorial-page-step" key={step.id}>
            <span className="tutorial-page-number" aria-hidden>
              {index + 1}
            </span>
            <div>
              {/* El recorrido numera sus títulos («1. Elige…»); aquí el número ya lo da la lista. */}
              <h2>{sinNumero(step.title)}</h2>
              <p>{step.content}</p>
              {step.tip ? (
                <p className="tutorial-page-tip">
                  <Lightbulb size={15} aria-hidden /> {step.tip}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
