import { describe, expect, it } from 'vitest';
import { isConsumed, normalizePath } from './engine-surface-paths.mjs';

/**
 * El emparejador del gate de superficie.
 *
 * Cada caso de aquí corresponde a una forma en que la lista de deuda podría mentir, y las dos
 * mentiras son igual de dañinas: dar por consumido algo que nadie mira (la deuda desaparece sin
 * pagarse) y reclamar una exención por algo que la pantalla sí usa (la lista se llena de ruido y
 * nadie la lee).
 */
const index = (paths) => {
  const map = new Map();
  for (const path of paths) {
    const length = path.split('/').length;
    if (!map.has(length)) map.set(length, []);
    map.get(length).push(path);
  }
  return map;
};

describe('normalizePath', () => {
  it('iguala el parámetro del OpenAPI con la interpolación del portal', () => {
    expect(normalizePath('/v1/artifacts/{artifactId}')).toBe('/v1/artifacts/{p}');
    expect(normalizePath('/v1/artifacts/{p}')).toBe('/v1/artifacts/{p}');
  });

  it('corta la cadena de consulta pegada al último segmento', () => {
    // De `` `/v1/model-monitoring/coverage${query}` `` salía `…/coverage{p}`, que no casaba con
    // nada: el gate pedía exención por un endpoint que la pantalla llama en cada carga.
    expect(normalizePath('/v1/model-monitoring/coverage{p}')).toBe('/v1/model-monitoring/coverage');
    expect(normalizePath('/v1/outcomes/pending{p}')).toBe('/v1/outcomes/pending');
  });
});

describe('isConsumed', () => {
  const consumed = index(['/v1/workers/{p}/runs/{p}', '/v1/artifacts/{p}', '/v1/outcomes/vintage']);

  it('reconoce la coincidencia exacta', () => {
    expect(isConsumed('/v1/outcomes/vintage', consumed)).toBe(true);
  });

  it('un comodín del portal cubre el segmento literal del motor', () => {
    // El portal recorre los cuatro workers con una variable; el OpenAPI los publica uno a uno.
    expect(isConsumed('/v1/workers/audio-tts/runs/{p}', consumed)).toBe(true);
  });

  it('el comodín NO se estira a varios segmentos', () => {
    // Con `{p}` tragando lo que fuera, el `/v1/artifacts/{p}` que ya se consume habría dado por
    // vista toda la rama de artefactos — y este gate existe para que una rama nueva no pase
    // inadvertida.
    expect(isConsumed('/v1/artifacts/{p}/dependency-graph', consumed)).toBe(false);
  });

  it('no inventa consumo donde no lo hay', () => {
    expect(isConsumed('/v1/outcomes/pending', consumed)).toBe(false);
  });
});
