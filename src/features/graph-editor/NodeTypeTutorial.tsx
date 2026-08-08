'use client';

import { AlertTriangle, CheckCircle2, GraduationCap, Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { NODE_CATALOG, type NodeTypeDefinition } from './node-catalog';
import { CONDITION_ORIGIN, tutorialFor } from './node-tutorials';

interface Props {
  nodeType: string;
}

/**
 * Ayuda desplegable del tipo de nodo seleccionado.
 *
 * Cada tipo pide cosas distintas y no era evidente de dónde salían: la variable
 * que compara una condición, el algoritmo al que llama una referencia, la
 * librería que habilita una función. En vez de repartir esa explicación por los
 * tooltips de cada campo, aquí está entera y en el orden en que se configura.
 *
 * Va cerrada por defecto: quien ya sabe no la ve, y quien no, la abre.
 */
export function NodeTypeTutorial({ nodeType }: Props) {
  const [open, setOpen] = useState(false);
  const definition = (NODE_CATALOG as Record<string, NodeTypeDefinition>)[nodeType];
  const tutorial = tutorialFor(nodeType);
  if (!definition || !tutorial) return null;

  return (
    <div className="node-tutorial">
      <button
        type="button"
        className="button node-tutorial-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <GraduationCap size={14} aria-hidden />
        {open ? 'Ocultar la guía' : `Cómo se configura un paso «${definition.label}»`}
      </button>

      {open ? (
        <div className="node-tutorial-body">
          <p className="node-tutorial-what">{definition.description}</p>
          <p className="node-tutorial-flow">{definition.dataFlow}</p>

          {/* El ejemplo va ANTES de los pasos: un tipo de nodo abstracto no se
              entiende, y leer «elige la variable que quieres comparar» sin saber
              para qué obliga a releerlo todo al llegar al final. */}
          <p className="node-tutorial-example">
            <Lightbulb size={13} aria-hidden /> {tutorial.example}
          </p>

          <ol>
            {tutorial.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <p className="node-tutorial-check">
            <CheckCircle2 size={13} aria-hidden /> <b>Quedó bien si:</b> {tutorial.check}
          </p>
          <p className="node-tutorial-pitfall">
            <AlertTriangle size={13} aria-hidden /> {tutorial.pitfall}
          </p>

          {nodeType === 'CONDITION' || nodeType === 'SWITCH' ? (
            <p className="node-tutorial-origin">{CONDITION_ORIGIN}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
