'use client';

import { useEffect, useState } from 'react';
import { ConceptIcon } from '../../../components/ConceptIcon';
import { useAmbientMotion } from '../../../hooks/useMotionPreferences';

const MESSAGES = [
  'Diseña decisiones comprensibles.',
  'Automatiza pruebas de forma segura.',
  'Analiza cada ejecución paso a paso.',
  'Convierte datos en decisiones verificables.',
] as const;

const HIGHLIGHTS = [
  { concept: 'testing', label: 'Validación automatizada' },
  { concept: 'audit', label: 'Trazabilidad completa' },
  { concept: 'environment', label: 'Ambientes controlados' },
  { concept: 'testSuite', label: 'Suites de prueba' },
  { concept: 'manualReview', label: 'Revisión manual' },
] as const;

/**
 * Zona visual e informativa del acceso.
 *
 * Explica qué es la plataforma antes de pedir credenciales: identidad, un
 * mensaje rotativo, un pequeño grafo que se recorre solo y los cinco bloques
 * que resumen para qué sirve. La rotación de mensajes sólo ocurre cuando la
 * pestaña está visible, el equipo lo permite y el usuario no pidió movimiento
 * reducido; en cualquier otro caso se queda fijo en el primer mensaje, que
 * sigue diciendo algo completo por sí solo.
 */
export function LoginShowcase() {
  const animated = useAmbientMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!animated) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % MESSAGES.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [animated]);

  return (
    <section className="login-showcase">
      <div className="login-identity">
        <span className="login-mark" aria-hidden="true">
          A
        </span>
        <div>
          <strong>ATLAS</strong>
          <span>Decision Engine</span>
        </div>
      </div>

      <div className="login-pitch">
        <h2>Decisiones automáticas que puedes explicar</h2>
        {/* El mensaje rota, así que se anuncia como región educada: llega al
            lector de pantalla sin interrumpir lo que esté leyendo. */}
        <p className="login-rotator" aria-live="polite" key={index}>
          {MESSAGES[index]}
        </p>
      </div>

      <ShowcaseGraph animated={animated} />

      <ul className="login-highlights">
        {HIGHLIGHTS.map((item) => (
          <li key={item.label}>
            <ConceptIcon concept={item.concept} tone="accent" decorative />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Grafo decorativo: cinco nodos y su recorrido. Es la misma idea que el usuario
 * verá dentro del producto, por eso se dibuja aquí en pequeño. Al ser puramente
 * ilustrativo va oculto a los lectores de pantalla — el texto de al lado ya
 * cuenta lo mismo.
 */
function ShowcaseGraph({ animated }: { animated: boolean }) {
  return (
    <svg
      className={`login-graph ${animated ? 'is-animated' : ''}`}
      viewBox="0 0 300 96"
      fill="none"
      aria-hidden="true"
    >
      <path className="login-graph-track" d="M28 48h58M114 48h58M200 48h58" />
      <path className="login-graph-pulse" d="M28 48h58M114 48h58M200 48h58" />
      {[28, 100, 172, 244].map((x, position) => (
        <g key={x} className="login-graph-node" style={{ animationDelay: `${position * 420}ms` }}>
          <circle cx={x} cy="48" r="13" />
          <circle cx={x} cy="48" r="4.5" className="login-graph-core" />
        </g>
      ))}
    </svg>
  );
}
