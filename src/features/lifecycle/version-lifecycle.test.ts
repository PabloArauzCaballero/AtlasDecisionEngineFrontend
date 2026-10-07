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

  it('lo desplegado, retirado o que la revisión no aceptó manda a crear una versión nueva', () => {
    for (const status of [
      'DEPLOYED_TO_STAGING',
      'DEPLOYED_TO_PROD',
      'RETIRED',
      'REJECTED',
      'CHANGES_REQUESTED',
    ] as const) {
      expect(lifecycleGuidance(status).nextAction).toMatch(/versión nueva/i);
      expect(lifecycleGuidance(status).next).toBe('new-version');
    }
  });

  it('los estados son los que el motor emite de verdad, no los que este portal se inventó', () => {
    // `PENDING_APPROVAL` y `DEPLOYED` no existen en el `enum VersionStatus` del motor: con ellos, una versión
    // en revisión o desplegada no caía en ningún paso.
    expect(VERSION_STATUSES).toContain('IN_REVIEW');
    expect(VERSION_STATUSES).toContain('DEPLOYED_TO_STAGING');
    expect(VERSION_STATUSES).not.toContain('PENDING_APPROVAL');
    expect(VERSION_STATUSES).not.toContain('DEPLOYED');
    expect(lifecycleGuidance('IN_REVIEW').stepIndex).toBeGreaterThanOrEqual(0);
  });

  it('la revisión es un paso propio, justo después de compilar', () => {
    const pasos = LIFECYCLE_STEPS.map((step) => step.id);

    expect(pasos).toEqual(['draft', 'validated', 'compiled', 'review', 'approved', 'deployed']);
    expect(lifecycleGuidance('IN_REVIEW').stepIndex).toBe(3);
  });

  it('a una versión compilada se le ofrece ENVIARLA a revisión, y a una aprobada desplegarla', () => {
    expect(lifecycleGuidance('COMPILED').next).toBe('submit-review');
    expect(lifecycleGuidance('IN_REVIEW').next).toBe('follow-review');
    expect(lifecycleGuidance('APPROVED').next).toBe('deploy');
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
