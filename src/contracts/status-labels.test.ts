import { describe, expect, it } from 'vitest';
import { codeText, statusText, SYSTEM_ACTOR_LABELS } from './status-labels';

describe('lo que la tabla enseña en lugar del código crudo', () => {
  it('los códigos que el barrido de TEST encontró crudos salen en palabras', () => {
    expect(codeText('REQUEST_PAYLOAD')).toBe('Datos de la solicitud');
    expect(codeText('STAGING')).toBe('Preproducción');
    expect(codeText('CREDIT_UNDERWRITING')).toBe('Aprobación de crédito');
    expect(codeText('DEPLOYMENT_ACTIVATED')).toBe('Despliegue activado');
    expect(statusText('ON_TRACK')).toBe('En plazo');
    expect(statusText('EMIT_REASON')).toBe('Emite un motivo');
  });

  it('el mapa propio de la columna manda sobre el común', () => {
    expect(codeText('DECIMAL', { DECIMAL: 'Número decimal' })).toBe('Número decimal');
    expect(codeText('bootstrap-management', SYSTEM_ACTOR_LABELS)).toBe('Sistema (carga inicial)');
  });

  it('un código que nadie tradujo se enseña tal cual, sin inventar una palabra', () => {
    expect(codeText('SEGMENTO_PROPIO_A')).toBe('SEGMENTO_PROPIO_A');
    expect(codeText(null)).toBe('—');
  });

  it('un estado que nadie tradujo tampoco se convierte en una frase en inglés', () => {
    expect(statusText('SOME_NEW_STATE')).toBe('SOME_NEW_STATE');
    expect(statusText('some_new_state')).toBe('some_new_state');
    expect(statusText('approved')).toBe('Aprobado');
    expect(statusText('NUEVO', { NUEVO: 'Nuevo' })).toBe('Nuevo');
    expect(statusText(undefined)).toBe('—');
  });
});
