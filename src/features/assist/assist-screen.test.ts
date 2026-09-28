import { assistScreenFor, sanitizeScreen } from './assist-screen';

describe('assistScreenFor', () => {
  it('nombra la sección con el rótulo del menú', () => {
    expect(assistScreenFor('/deployments')).toBe('Gobierno › Despliegues');
    expect(assistScreenFor('/model-monitoring')).toBe('Auditoría › Monitoreo del Modelo');
  });

  it('una ruta de detalle hereda la entrada del menú que la abre', () => {
    expect(assistScreenFor('/calculated-fields/42')).toBe('Diseño › Campos Calculados');
  });

  it('gana la entrada más honda: un worker no es «Workers» a secas', () => {
    expect(assistScreenFor('/workers/audio-tts')).toBe('Procesamiento › Workers › Locución');
  });

  it('las vistas sin entrada propia se nombran por la sección que las abre', () => {
    expect(assistScreenFor('/artifact-versions/7/graph')).toBe('Diseño › Versión de artefacto');
    expect(assistScreenFor('/approval-requests/3')).toBe('Gobierno › Solicitud de aprobación');
  });

  it('no inventa una sección para una ruta desconocida', () => {
    expect(assistScreenFor('/')).toBeUndefined();
    expect(assistScreenFor('/no-existe')).toBeUndefined();
  });
});

describe('sanitizeScreen', () => {
  it('deja sólo lo que Core acepta y corta a 80', () => {
    expect(sanitizeScreen('Diseño › Variables <b>')).toBe('Diseño › Variables b');
    expect(sanitizeScreen('a'.repeat(120))).toHaveLength(80);
    expect(sanitizeScreen('***')).toBeUndefined();
  });
});
