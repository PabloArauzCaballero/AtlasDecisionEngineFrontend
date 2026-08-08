import { lifecycleGuidance, LIFECYCLE_STEPS, VERSION_STATUSES } from './version-lifecycle';

describe('qué admite cada estado de una versión', () => {
  it('sólo se compila lo que está VALIDATED', () => {
    const compilables = VERSION_STATUSES.filter((status) => lifecycleGuidance(status).canCompile);

    expect(compilables).toEqual(['VALIDATED']);
  });

  it('se valida el diseño y lo ya validado, nada más', () => {
    const validables = VERSION_STATUSES.filter((status) => lifecycleGuidance(status).canValidate);

    expect(validables).toEqual(['DRAFT', 'VALIDATION_FAILED', 'VALIDATED']);
  });

  it('una versión ya compilada no se anuncia como desplegada', () => {
    const guia = lifecycleGuidance('COMPILED');

    // El defecto que esto corrige: el asistente ofrecía compilar siempre y
    // traducía el rechazo por «Está desplegada o retirada», que sobre una
    // versión meramente compilada es falso y manda a crear otra versión sin
    // motivo.
    expect(guia.canCompile).toBe(false);
    expect(guia.nextAction).toMatch(/revisión/i);
    expect(guia.nextAction).not.toMatch(/versión nueva/i);
  });

  it('sólo lo desplegado o retirado manda a crear una versión nueva', () => {
    for (const status of ['DEPLOYED', 'RETIRED'] as const) {
      expect(lifecycleGuidance(status).nextAction).toMatch(/versión nueva/i);
    }
  });

  it('cada estado cae en exactamente un paso del recorrido', () => {
    for (const status of VERSION_STATUSES) {
      const pasos = LIFECYCLE_STEPS.filter((step) =>
        (step.statuses as readonly string[]).includes(status),
      );
      expect(pasos, `${status} debería estar en un solo paso`).toHaveLength(1);
      expect(lifecycleGuidance(status).stepIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it('sin versión elegida no se ofrece ninguna acción', () => {
    const guia = lifecycleGuidance(undefined);

    expect(guia.canValidate).toBe(false);
    expect(guia.canCompile).toBe(false);
    expect(guia.stepIndex).toBe(-1);
  });

  it('un estado que este portal no conoce no habilita nada', () => {
    // El motor podría añadir estados; suponer que uno desconocido es seguro
    // sería justo la clase de optimismo que produce un botón que falla.
    expect(lifecycleGuidance('INVENTADO').canCompile).toBe(false);
  });
});
