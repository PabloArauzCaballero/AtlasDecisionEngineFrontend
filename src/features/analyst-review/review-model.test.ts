import graph from './__fixtures__/riesgo-onboarding.graph.json';
import run from './__fixtures__/riesgo-onboarding.run.json';
import { caseRunRows, orderedSteps } from './review-model';

// Grafo y corrida reales de RIESGO_ONBOARDING_CLIENTE v1, leídos del Motor de TEST el 2026-09-29.
describe('revisión del analista', () => {
  const steps = orderedSteps(graph);

  it('recorre los pasos desde el inicio, en orden', () => {
    expect(steps[0].label).toBe('Inicio');
    expect(steps[1].label).toBe('Contar evidencias faltantes');
    expect(steps[2].label).toBe('Evaluar el expediente');
    expect(steps).toHaveLength(11);
  });

  it('explica por qué bifurca, con el umbral escrito', () => {
    const evaluar = steps.find((step) => step.key === 'EVALUAR');
    const cuando = evaluar?.exits.map((exit) => exit.when) ?? [];
    expect(cuando.some((texto) => texto.includes('El puntaje total alcanza el umbral'))).toBe(true);
    expect(cuando.some((texto) => texto.includes('65'))).toBe(true);
    expect(cuando[cuando.length - 1]).toBe('En cualquier otro caso');
  });

  it('dice qué motivo anota y qué le llega al cliente', () => {
    const paso = steps.find((step) => step.key === 'EMITIR_PUNTAJE_INSUFICIENTE');
    expect(paso?.why.join(' ')).toContain('BELOW_MINIMUM_RISK_SCORE');
    expect(paso?.why.join(' ')).toContain('El perfil no alcanza el puntaje mínimo de riesgo.');
  });

  it('dice cuándo pasa el caso a una persona', () => {
    const paso = steps.find((step) => step.key === 'REVISAR_PUNTAJE');
    expect(paso?.kind).toBe('Pasa a una persona');
    expect(paso?.exits).toEqual([]);
  });

  it('cada caso de la corrida trae esperado, obtenido y el camino por nombre', () => {
    const rows = caseRunRows(run, graph);
    expect(rows).toHaveLength(6);
    expect(rows.every((row) => row.passed)).toBe(true);
    const sesenta = rows.find((row) => row.code === 'RIESGO-60-REVISA');
    expect(sesenta?.expected).toBe('MANUAL_REVIEW');
    expect(sesenta?.actual).toBe('MANUAL_REVIEW');
    expect(sesenta?.path).toContain('Revisión: puntaje por debajo del umbral');
  });
});
