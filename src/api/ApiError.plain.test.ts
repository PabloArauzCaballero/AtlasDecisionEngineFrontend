import { describe, expect, it } from 'vitest';
import { ApiError, errorMessage } from './ApiError';

describe('errorMessage: lo que ve la persona cuando algo falla', () => {
  it('enseña tal cual un mensaje del motor escrito en español llano', () => {
    const error = new ApiError('No hay ningún caso de revisión con ese identificador.', 404);
    expect(errorMessage(error)).toBe('No hay ningún caso de revisión con ese identificador.');
  });

  it('no enseña un mensaje en inglés escrito para quien programa', () => {
    const error = new ApiError('Artifact version not found', 404, 'NOT_FOUND');
    expect(errorMessage(error)).toMatch(/ya no existe/);
    expect(errorMessage(error)).not.toMatch(/Artifact/);
  });

  it('no enseña códigos internos aunque el resto esté en español', () => {
    const error = new ApiError('Falla ACTIVE_DEPLOYMENT_NOT_FOUND en el motor', 409);
    expect(errorMessage(error)).not.toMatch(/ACTIVE_DEPLOYMENT/);
  });

  it('explica un dato inválido sin la jerga del validador', () => {
    expect(errorMessage(new ApiError('variables must be a JSON object', 400))).toMatch(
      /Algún dato no es válido/,
    );
  });

  it('los errores que no vienen del motor se enseñan como antes', () => {
    expect(errorMessage(new Error('Sin cámara'))).toBe('Sin cámara');
  });
});
