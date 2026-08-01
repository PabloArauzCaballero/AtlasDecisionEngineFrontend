import { describe, expect, it } from 'vitest';
import { detailedEdgeLabel } from './edge-explanations';
import { conditionSummary, nodeBadges, nodeSummary } from './node-summary';

const CONDITIONS = [
  { code: 'RIESGO_ALTO', expression: { variable: 'score_buro', operator: 'lt', value: 550 } },
  { code: 'SIN_VALOR', expression: { variable: 'edad', operator: 'gte' } },
];

describe('conditionSummary', () => {
  it('escribe la regla con el símbolo del operador', () => {
    expect(conditionSummary(CONDITIONS[0])).toBe('score_buro < 550');
  });

  it('marca el valor que falta en lugar de omitirlo', () => {
    // Una regla a medias debe verse a medias: "edad ≥" a secas engañaría.
    expect(conditionSummary(CONDITIONS[1])).toBe('edad ≥ ?');
  });

  it('resume una lista por su tamaño', () => {
    const summary = conditionSummary({
      expression: { variable: 'pais', operator: 'in', value: ['BO', 'PE', 'CL'] },
    });

    expect(summary).toBe('pais ∈ 3 valores');
  });

  it('devuelve null si la condición no declara variable', () => {
    expect(conditionSummary({})).toBeNull();
  });
});

describe('nodeSummary', () => {
  it('resuelve la regla de una condición desde el catálogo del grafo', () => {
    const summary = nodeSummary(
      { type: 'CONDITION', config: { conditionCode: 'RIESGO_ALTO' } },
      { conditions: CONDITIONS },
    );

    expect(summary).toBe('score_buro < 550');
  });

  it('describe un nodo de código por su variable destino y su lenguaje', () => {
    expect(
      nodeSummary({
        type: 'SCORE',
        config: { targetVariable: 'puntaje', script: { language: 'PYTHON', source: 'x = 1' } },
      }),
    ).toBe('→ puntaje · PYTHON');
  });

  it('resume un resultado por sus asignaciones y recorta las que sobran', () => {
    const summary = nodeSummary({
      type: 'RESULT',
      config: {
        mode: 'MAPPING',
        assignments: [
          { outputCode: 'decision', value: 'APROBADO' },
          { outputCode: 'motivo', value: 'OK' },
          { outputCode: 'limite', value: '5000' },
        ],
      },
    });

    expect(summary).toBe('decision = APROBADO · motivo = OK +1');
  });

  it('dice a qué algoritmo llama un resultado por referencia', () => {
    expect(
      nodeSummary({ type: 'RESULT', config: { mode: 'REFERENCE', referenceCode: 'KYC_V2' } }),
    ).toBe('llama a KYC_V2');
  });

  it('no inventa resumen para un paso sin configurar', () => {
    expect(nodeSummary({ type: 'CONDITION' })).toBeNull();
    expect(nodeSummary({ type: 'ACTION' })).toBeNull();
    expect(nodeSummary({ type: 'START' })).toBeNull();
  });
});

describe('nodeBadges', () => {
  it('marca el paso que cierra el flujo y el que lleva código', () => {
    const badges = nodeBadges({
      type: 'RESULT',
      terminal: true,
      config: { mode: 'SCRIPT', script: { source: 'result = 1' } },
    });

    expect(badges).toContain('terminal');
    expect(badges).toContain('code');
  });

  it('marca la llamada a otro algoritmo y la intervención humana', () => {
    expect(nodeBadges({ type: 'RESULT', config: { mode: 'REFERENCE' } })).toContain('reference');
    expect(nodeBadges({ type: 'MANUAL_REVIEW', config: { queueCode: 'Q' } })).toContain('human');
  });

  it('avisa de un paso que todavía no se puede publicar', () => {
    expect(nodeBadges({ type: 'CONDITION' })).toContain('incomplete');
    // Inicio y fin no configuran nada: marcarlos sería una falsa alarma.
    expect(nodeBadges({ type: 'START' })).not.toContain('incomplete');
  });
});

describe('detailedEdgeLabel', () => {
  it('lleva la regla a la propia flecha', () => {
    expect(detailedEdgeLabel({}, 'CONDITION', 'score_buro < 550')).toBe('si score_buro < 550');
  });

  it('nombra la rama contraria sin repetir la regla negada a mano', () => {
    expect(detailedEdgeLabel({ default: true }, 'CONDITION', 'score_buro < 550')).toBe(
      'si no · score_buro < 550',
    );
  });

  it('cae en la etiqueta corta cuando no hay regla que mostrar', () => {
    expect(detailedEdgeLabel({}, 'CONDITION', null)).toBe('Sí');
    expect(detailedEdgeLabel({}, 'START', null)).toBe('Continuar');
  });
});
