import { describe, expect, it } from 'vitest';
import { edgeLabel, edgeTooltip } from './edge-explanations';
import { NODE_CATALOG, nodeTooltip, nodeTypeDefinition, nodeTypeLabel } from './node-catalog';
import { icons } from './node-types';
import { runStatusHint, runStatusLabel } from './node-runtime';

describe('catálogo de nodos', () => {
  it('da a cada tipo icono, forma, etiqueta y explicación propios', () => {
    for (const [type, definition] of Object.entries(NODE_CATALOG)) {
      expect(definition.icon, type).toBeTruthy();
      expect(definition.label, type).not.toHaveLength(0);
      expect(definition.description, type).toMatch(/\.$/);
      expect(definition.dataFlow, type).toMatch(/\.$/);
    }
  });

  it('no distingue los tipos sólo por color: las familias tienen formas distintas', () => {
    expect(nodeTypeDefinition('CONDITION').shape).toBe('diamond');
    expect(nodeTypeDefinition('EXPRESSION').shape).toBe('hexagon');
    expect(nodeTypeDefinition('MANUAL_REVIEW').shape).toBe('shield');
    expect(nodeTypeDefinition('RESULT').shape).toBe('flag');
    expect(nodeTypeDefinition('START').shape).toBe('capsule');
  });

  it('cubre los tipos que el usuario espera ver en un árbol de decisión', () => {
    for (const type of [
      'START',
      'CONDITION',
      'EXPRESSION',
      'REFERENCE',
      'RESULT',
      'ERROR',
      'END',
    ]) {
      expect(NODE_CATALOG[type as keyof typeof NODE_CATALOG], type).toBeDefined();
    }
  });

  it('deriva los iconos del lienzo del mismo catálogo', () => {
    expect(icons.CONDITION).toBe(NODE_CATALOG.CONDITION.icon);
    expect(icons.RESULT).toBe(NODE_CATALOG.RESULT.icon);
  });

  it('no rompe con un tipo que el backend añada más adelante', () => {
    expect(nodeTypeLabel('TIPO_NUEVO')).toBe('Paso');
    expect(nodeTypeDefinition('TIPO_NUEVO').shape).toBe('card');
  });

  it('explica el nodo en el tooltip en lugar de repetir su nombre', () => {
    const tooltip = nodeTooltip('Evaluación documental', 'CONDITION');

    expect(tooltip).toContain('Evaluación documental');
    expect(tooltip).toContain('Divide el flujo');
    expect(tooltip.split('\n')).toHaveLength(3);
  });
});

describe('estados de ejecución', () => {
  it('nombra cada estado en español', () => {
    expect(runStatusLabel('skipped')).toBe('Omitido');
    expect(runStatusLabel('running')).toBe('En ejecución');
  });

  it('explica por qué un nodo quedó omitido', () => {
    expect(runStatusHint({ status: 'skipped' })).toMatch(/condición anterior no se cumplió/);
  });

  it('prefiere la explicación que venga de la traza real', () => {
    expect(runStatusHint({ status: 'done', detail: 'Continuó por «e2».' })).toBe(
      'Continuó por «e2».',
    );
  });
});

describe('explicación de las conexiones', () => {
  it('nombra las ramas según el tipo del nodo de origen', () => {
    expect(edgeLabel({}, 'CONDITION')).toBe('Sí');
    expect(edgeLabel({ default: true }, 'CONDITION')).toBe('No / defecto');
    expect(edgeLabel({ default: true }, 'SWITCH')).toBe('Defecto');
    expect(edgeLabel({}, 'START')).toBe('Continuar');
  });

  it('dice cuándo se toma el camino, con sus condiciones y prioridad', () => {
    const tooltip = edgeTooltip(
      {
        key: 'e2',
        from: 'VALIDA',
        to: 'RIESGO',
        priority: 10,
        conditions: [{ code: 'RIESGO_ALTO' }],
      },
      'CONDITION',
    );

    expect(tooltip).toContain('VALIDA → RIESGO');
    expect(tooltip).toContain('se cumple');
    expect(tooltip).toContain('RIESGO_ALTO');
    expect(tooltip).toContain('Prioridad de evaluación: 10');
  });

  it('añade el desenlace real cuando se está viendo una ejecución', () => {
    expect(edgeTooltip({ from: 'A', to: 'B' }, 'START', 'taken')).toMatch(/camino que siguió/);
    expect(edgeTooltip({ from: 'A', to: 'C' }, 'CONDITION', 'discarded')).toMatch(/se descartó/);
  });
});
