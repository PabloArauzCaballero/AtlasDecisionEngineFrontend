import { describe, expect, it } from 'vitest';
import {
  elapsedLabel,
  isTerminal,
  STATUS_HELP,
  STATUS_LABEL,
  statusTone,
  WORKER_RUN_STATUSES,
} from './worker-types';

describe('estados de una ejecución de worker', () => {
  it('describe TODOS los estados que el backend puede devolver', () => {
    // Un estado sin etiqueta se pintaría con su nombre técnico en inglés y sin
    // explicación. Esto obliga a que añadir un estado en el motor rompa aquí,
    // que es donde hay que decidir cómo se cuenta.
    for (const status of WORKER_RUN_STATUSES) {
      expect(STATUS_LABEL[status], `falta la etiqueta de ${status}`).toBeTruthy();
      expect(STATUS_HELP[status], `falta la explicación de ${status}`).toBeTruthy();
    }
  });

  it('sólo considera terminales los estados de los que no se sale', () => {
    expect(isTerminal('QUEUED')).toBe(false);
    expect(isTerminal('RUNNING')).toBe(false);
    expect(isTerminal('SUCCEEDED')).toBe(true);
    expect(isTerminal('SUCCEEDED_WITH_WARNINGS')).toBe(true);
    expect(isTerminal('FAILED')).toBe(true);
    expect(isTerminal('CANCELLED')).toBe(true);
  });

  it('no deja ningún estado sin color propio', () => {
    // `StatusBadge` deriva el color de un vocabulario cerrado y cae en «neutral»
    // sin avisar ante un valor que no conoce. Si `SUCCEEDED` saliera gris, un
    // éxito y una cancelación se verían igual.
    const known = new Set(['PASSED', 'WARNING', 'FAILED', 'INACTIVE', 'RUNNING', 'QUEUED']);
    for (const status of WORKER_RUN_STATUSES) {
      expect(known.has(statusTone(status)), `${status} usa un tono desconocido`).toBe(true);
    }
    expect(statusTone('SUCCEEDED')).toBe('PASSED');
    expect(statusTone('SUCCEEDED_WITH_WARNINGS')).toBe('WARNING');
  });

  it('distingue «completado» de «completado con advertencias»', () => {
    // Son estados distintos a propósito: si se contaran igual, nadie miraría el
    // resultado de una conversión que sí necesita revisión.
    expect(STATUS_LABEL.SUCCEEDED).not.toBe(STATUS_LABEL.SUCCEEDED_WITH_WARNINGS);
    expect(statusTone('SUCCEEDED')).not.toBe(statusTone('SUCCEEDED_WITH_WARNINGS'));
    expect(STATUS_HELP.SUCCEEDED_WITH_WARNINGS).toMatch(/revisar/i);
  });
});

describe('tiempo transcurrido', () => {
  it('mide contra el fin cuando la ejecución ya terminó', () => {
    expect(elapsedLabel('2026-08-04T10:00:00.000Z', '2026-08-04T10:00:42.000Z')).toBe('42 s');
  });

  it('pasa a minutos y segundos por encima del minuto', () => {
    expect(elapsedLabel('2026-08-04T10:00:00.000Z', '2026-08-04T10:02:05.000Z')).toBe('2 min 5 s');
  });

  it('sube a horas y a días en vez de acumular minutos', () => {
    // El historial de un worker llega a semanas. «hace 1052 min 13 s» obliga a
    // dividir de cabeza por 60 para enterarse de que fue ayer.
    expect(elapsedLabel('2026-08-04T10:00:00.000Z', '2026-08-04T13:30:00.000Z')).toBe('3 h 30 min');
    expect(elapsedLabel('2026-08-04T10:00:00.000Z', '2026-08-06T14:00:00.000Z')).toBe('2 d 4 h');
  });

  it('no inventa una duración cuando no hay inicio', () => {
    expect(elapsedLabel(null)).toBeNull();
    expect(elapsedLabel(undefined)).toBeNull();
  });

  it('devuelve null ante una fecha ilegible en vez de «NaN s»', () => {
    expect(elapsedLabel('no es una fecha')).toBeNull();
  });

  it('nunca devuelve una duración negativa', () => {
    // Los relojes del navegador y del servidor no coinciden. Sin la cota, una
    // ejecución recién encolada puede mostrar «-3 s».
    expect(elapsedLabel('2026-08-04T10:00:10.000Z', '2026-08-04T10:00:00.000Z')).toBe('0 s');
  });
});
