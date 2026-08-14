import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/ApiError';
import { LoginPinForm } from './LoginPinForm';
import { describePinError } from './login-errors';

function renderPin(overrides: Partial<Parameters<typeof LoginPinForm>[0]> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <LoginPinForm
      email="ana@atlas.test"
      expiresInMinutes={10}
      submitting={false}
      problem={null}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onSubmit, onCancel };
}

const pinInput = () => document.querySelector('.login-pin-input') as HTMLInputElement;
const confirmar = () => screen.getByRole('button', { name: /Confirmar acceso/ });

describe('LoginPinForm', () => {
  it('dice a qué correo fue el código, que es lo que permite reconocer un error de cuenta', () => {
    renderPin();
    expect(screen.getByRole('heading', { name: /Revisa tu correo/ })).toBeInTheDocument();
    expect(screen.getByText('ana@atlas.test')).toBeInTheDocument();
  });

  /*
   * El motor sólo acepta seis dígitos. Dejar escribir otra cosa no da flexibilidad: gasta uno de
   * los pocos intentos que hay antes de que el desafío se invalide.
   */
  it('descarta lo que no sean dígitos y no pasa de seis', () => {
    renderPin();
    fireEvent.change(pinInput(), { target: { value: '12a3-45 6789' } });
    expect(pinInput().value).toBe('123456');
  });

  it('no deja confirmar hasta tener los seis dígitos', () => {
    const { onSubmit } = renderPin();
    expect(confirmar()).toBeDisabled();

    fireEvent.change(pinInput(), { target: { value: '12345' } });
    expect(confirmar()).toBeDisabled();

    fireEvent.change(pinInput(), { target: { value: '123456' } });
    expect(confirmar()).toBeEnabled();
    fireEvent.click(confirmar());
    expect(onSubmit).toHaveBeenCalledWith('123456');
  });

  it('volver atrás es una salida explícita, no un callejón sin salida', () => {
    const { onCancel } = renderPin();
    fireEvent.click(screen.getByRole('button', { name: /Volver e intentar con otra cuenta/ }));
    expect(onCancel).toHaveBeenCalled();
  });

  describe('cuenta atrás', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    /*
     * Un PIN vencido y uno equivocado dan el MISMO mensaje del motor, a propósito. El reloj es lo
     * único que le dice a quien sí es la persona cuál de los dos le pasó.
     */
    it('al caducar avisa y bloquea el envío, aunque el código esté completo', async () => {
      const { onSubmit } = renderPin({ expiresInMinutes: 1 });
      fireEvent.change(pinInput(), { target: { value: '123456' } });
      expect(confirmar()).toBeEnabled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(61_000);
      });

      expect(screen.getByText(/El código caducó/)).toBeInTheDocument();
      expect(confirmar()).toBeDisabled();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});

/**
 * Un 401 en el primer paso significa «contraseña equivocada»; en el segundo, «PIN inválido». Usar
 * el mismo texto mandaba a corregir una contraseña que estaba bien.
 */
describe('describePinError', () => {
  it('habla del código, no de las credenciales', () => {
    const problem = describePinError(new ApiError('PIN inválido o expirado.', 401));
    expect(problem.title).toMatch(/código/i);
    expect(problem.body).not.toMatch(/contraseña/i);
  });

  it('para lo que no es del PIN, cae en la explicación general de acceso', () => {
    const problem = describePinError(new ApiError('sin red', 0));
    expect(problem.title).toMatch(/conexión/i);
  });
});
