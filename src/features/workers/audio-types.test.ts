import { describe, expect, it } from 'vitest';
import {
  costLabel,
  formatBytes,
  missingVariables,
  OUTCOME_LABEL,
  outcomeTone,
  templateVariables,
  voiceSummary,
  type AudioRunResult,
  type AudioTemplate,
} from './audio-types';

const plantilla: AudioTemplate = {
  code: 'onboarding.welcome.named',
  version: 1,
  strategy: 'DYNAMIC',
  templateText: 'Bienvenido, {{name}}.',
  language: 'es-419',
  variables: ['name'],
  isActive: true,
};

describe('desenlaces de una locución', () => {
  it('caché y generación son éxito; respaldo y ausencia son aviso, no error', () => {
    expect(outcomeTone('READY')).toBe('PASSED');
    expect(outcomeTone('QUEUED')).toBe('PASSED');
    // Ámbar y no rojo: el contrato del worker es que la falta de audio nunca
    // rompe a quien lo pide, así que pintarlo como fallo mentiría.
    expect(outcomeTone('FALLBACK')).toBe('WARNING');
    expect(outcomeTone('UNAVAILABLE')).toBe('WARNING');
  });

  it('los cuatro tienen etiqueta en español', () => {
    for (const outcome of ['READY', 'QUEUED', 'FALLBACK', 'UNAVAILABLE'] as const) {
      expect(OUTCOME_LABEL[outcome]).toBeTruthy();
      expect(OUTCOME_LABEL[outcome]).not.toBe(outcome);
    }
  });
});

describe('variables de una plantilla', () => {
  it('sin plantilla elegida no exige nada', () => {
    expect(templateVariables(undefined)).toEqual([]);
    expect(missingVariables(undefined, {})).toEqual([]);
  });

  it('una variable vacía o en blanco sigue faltando', () => {
    expect(missingVariables(plantilla, {})).toEqual(['name']);
    expect(missingVariables(plantilla, { name: '   ' })).toEqual(['name']);
    expect(missingVariables(plantilla, { name: 'Ana' })).toEqual([]);
  });

  it('no repite una variable que la plantilla nombra dos veces', () => {
    expect(templateVariables({ ...plantilla, variables: ['name', 'name'] })).toEqual(['name']);
  });
});

describe('cifras del audio', () => {
  it('sube de unidad: unos miles de bytes no se leen en bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(48_384)).toBe('47.3 KiB');
    expect(formatBytes(3_145_728)).toBe('3.00 MiB');
  });

  it('sin dato no inventa un cero, que afirmaría que pesa nada', () => {
    expect(formatBytes(null)).toBeNull();
  });

  it('la voz incluye la VERSIÓN: sin ella dos audios distintos parecen el mismo', () => {
    const result = {
      voiceProfile: 'brand_es_latam_v1',
      voiceVersion: 2,
      model: 'eleven_v3',
    } as AudioRunResult;
    expect(voiceSummary(result)).toBe('brand_es_latam_v1 v2 · eleven_v3');
  });

  it('sin perfil de voz no compone una línea a medias', () => {
    expect(voiceSummary({ voiceProfile: null } as AudioRunResult)).toBeNull();
  });
});

describe('qué costó la locución', () => {
  it('de caché no cuesta nada', () => {
    expect(costLabel({ cacheHit: true, generated: false } as AudioRunResult)).toMatch(/caché/);
  });

  it('generada en esta ejecución sí', () => {
    expect(costLabel({ cacheHit: false, generated: true } as AudioRunResult)).toMatch(/Se generó/);
  });

  /*
   * El caso que la captura destapó: servir el respaldo NO es generar. Decir «se
   * generó» ahí afirma un gasto que nunca ocurrió, y es justo la ejecución en la
   * que no se pudo generar nada.
   */
  it('el respaldo no se generó: no puede decir que sí', () => {
    expect(costLabel({ cacheHit: false, generated: false } as AudioRunResult)).toMatch(
      /no se llegó a generar/,
    );
  });
});
