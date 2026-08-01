import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConceptChip, ConceptIcon } from './ConceptIcon';
import { CONCEPTS, type ConceptKey } from './concept-icons';
import { ACTIONS } from './action-catalog';

describe('catálogo de conceptos', () => {
  it('describe cada concepto con una etiqueta y una explicación en lenguaje llano', () => {
    for (const [key, definition] of Object.entries(CONCEPTS)) {
      expect(definition.label, key).not.toHaveLength(0);
      // El tooltip debe explicar, no repetir el nombre del concepto.
      expect(definition.hint.length, key).toBeGreaterThan(definition.label.length);
      expect(definition.hint, key).toMatch(/\.$/);
    }
  });

  it('usa un solo icono por acción en todo el portal', () => {
    // Dos acciones distintas pueden compartir icono sólo si son la misma
    // operación con otro nombre; lo que nunca debe ocurrir es lo contrario:
    // una acción dibujada con iconos distintos según el módulo.
    const byLabel = new Map<string, unknown>();
    for (const action of Object.values(ACTIONS)) {
      const seen = byLabel.get(action.label);
      if (seen) expect(seen).toBe(action.icon);
      byLabel.set(action.label, action.icon);
    }
  });
});

describe('ConceptIcon', () => {
  it('expone el concepto como nombre accesible y su explicación como tooltip', () => {
    render(<ConceptIcon concept="testSuite" />);

    expect(screen.getByRole('img', { name: 'Suite de prueba' })).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent(/agrupar|casos relacionados|Conjunto/i);
  });

  it('es alcanzable con el teclado, para que el tooltip no dependa del ratón', () => {
    render(<ConceptIcon concept="risk" />);

    expect(screen.getByRole('img', { name: 'Riesgo' })).toHaveAttribute('tabindex', '0');
  });

  it('admite un nombre más específico que el del catálogo', () => {
    render(<ConceptIcon concept="execution" label="Ejecución 4821" />);

    expect(screen.getByRole('img', { name: 'Ejecución 4821' })).toBeInTheDocument();
  });

  it('se oculta a los lectores de pantalla cuando es decorativo', () => {
    const { container } = render(<ConceptIcon concept="execution" decorative />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });
});

describe('ConceptChip', () => {
  it('muestra la etiqueta del catálogo sin duplicar la lectura del icono', () => {
    const { container } = render(<ConceptChip concept="deployment" />);

    expect(screen.getByText('Despliegue')).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('permite un texto propio manteniendo la explicación del concepto', () => {
    render(<ConceptChip concept="environment">SANDBOX</ConceptChip>);

    expect(screen.getByText('SANDBOX')).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent(CONCEPTS.environment.hint);
  });
});

describe('cobertura del catálogo', () => {
  const REQUIRED: ConceptKey[] = [
    'algorithm',
    'inputVariable',
    'outputVariable',
    'testSuite',
    'execution',
    'environment',
    'deployment',
    'logs',
    'tutorial',
    'user',
    'team',
    'risk',
    'manualReview',
  ];

  it('cubre todos los conceptos que la interfaz necesita nombrar', () => {
    for (const key of REQUIRED) expect(CONCEPTS[key], key).toBeDefined();
  });

  it('distingue visualmente entrada y salida de variables', () => {
    expect(CONCEPTS.inputVariable.icon).not.toBe(CONCEPTS.outputVariable.icon);
  });
});
