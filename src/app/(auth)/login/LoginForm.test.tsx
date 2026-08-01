import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/ApiError';
import { LoginForm } from './LoginForm';
import { describeLoginError, sessionNotice } from './login-errors';

const INITIAL = { tenantId: '1', email: '', remember: false };

function renderForm(overrides: Partial<Parameters<typeof LoginForm>[0]> = {}) {
  const onSubmit = vi.fn();
  render(
    <LoginForm
      initial={INITIAL}
      submitting={false}
      problem={null}
      notice={null}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return onSubmit;
}

function fill(email: string, password: string) {
  fireEvent.change(document.querySelector('input[autocomplete="username"]') as HTMLInputElement, {
    target: { value: email },
  });
  fireEvent.change(
    document.querySelector('input[autocomplete="current-password"]') as HTMLInputElement,
    { target: { value: password } },
  );
}

describe('LoginForm', () => {
  it('muestra un encabezado de bienvenida y etiquetas visibles', () => {
    renderForm();

    expect(screen.getByRole('heading', { name: /Bienvenido nuevamente/ })).toBeInTheDocument();
    expect(screen.getByText('Correo electrónico')).toBeInTheDocument();
    expect(screen.getByText('Contraseña')).toBeInTheDocument();
  });

  it('alterna mostrar y ocultar la contraseña', () => {
    renderForm();
    const password = document.querySelector(
      'input[autocomplete="current-password"]',
    ) as HTMLInputElement;

    expect(password.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(password.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(password.type).toBe('password');
  });

  it('valida el correo al salir del campo y explica qué falta', () => {
    const onSubmit = renderForm();
    const email = document.querySelector('input[autocomplete="username"]') as HTMLInputElement;

    fireEvent.change(email, { target: { value: 'no-es-un-correo' } });
    fireEvent.blur(email);

    expect(screen.getByRole('alert')).toHaveTextContent(/con @ y dominio/);
    expect(email).toHaveAttribute('aria-invalid', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envía las credenciales cuando el formulario es válido', () => {
    const onSubmit = renderForm();

    fill('usuario@empresa.com', 'secreta');
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(onSubmit).toHaveBeenCalledWith({
      tenantId: '1',
      email: 'usuario@empresa.com',
      password: 'secreta',
      remember: false,
    });
  });

  it('muestra el estado de carga y bloquea el reenvío', () => {
    renderForm({ submitting: true });

    const button = screen.getByRole('button', { name: /Verificando acceso/ });
    expect(button).toBeDisabled();
  });

  it('presenta el problema con título, causa y salida, sin códigos HTTP', () => {
    renderForm({ problem: describeLoginError(new ApiError('Unauthorized', 401)) });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('No pudimos iniciar tu sesión');
    expect(alert).toHaveTextContent(/no coinciden con una cuenta activa/);
    expect(alert).toHaveTextContent(/recuperación/);
    expect(alert.textContent).not.toMatch(/401/);
  });

  it('rellena el correo recordado del equipo', () => {
    renderForm({ initial: { tenantId: '7', email: 'ana@empresa.com', remember: true } });

    expect(document.querySelector('input[autocomplete="username"]')).toHaveValue('ana@empresa.com');
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});

describe('describeLoginError', () => {
  it('distingue credenciales, permisos, red, tiempo de espera y mantenimiento', () => {
    expect(describeLoginError(new ApiError('x', 401)).title).toMatch(/No pudimos iniciar/);
    expect(describeLoginError(new ApiError('x', 403)).title).toMatch(/no tiene acceso/);
    expect(describeLoginError(new ApiError('x', 0)).title).toMatch(/No hay conexión/);
    expect(describeLoginError(new ApiError('x', 408)).title).toMatch(/tardó demasiado/);
    expect(describeLoginError(new ApiError('x', 503)).title).toMatch(/no está disponible/);
  });

  it('explica la cuenta bloqueada y qué hacer al respecto', () => {
    const problem = describeLoginError(new ApiError('x', 401, 'ACCOUNT_LOCKED'));

    expect(problem.title).toMatch(/bloqueada/);
    expect(problem.body).toMatch(/intentos fallidos|administrador/);
    expect(problem.action).toMatch(/soporte/);
    expect(problem.retryable).toBe(false);
  });

  it('no revela si el correo existe', () => {
    const problem = describeLoginError(new ApiError('User not found', 401));

    expect(problem.body).not.toMatch(/no existe|not found/i);
  });
});

describe('sessionNotice', () => {
  it('explica por qué terminó la sesión anterior', () => {
    expect(sessionNotice('expired')).toMatch(/expiró por inactividad/);
    expect(sessionNotice('forbidden')).toMatch(/permisos/);
    expect(sessionNotice(null)).toBeNull();
  });
});
