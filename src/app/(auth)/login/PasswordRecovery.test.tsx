import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/ApiError';
import { LoginForm } from './LoginForm';
import { PasswordRecovery } from './PasswordRecovery';

const IDENTITY = { tenantId: '1', email: 'persona@atlas.test' };

function renderRecovery(
  overrides: {
    request?: ReturnType<typeof vi.fn>;
    confirm?: ReturnType<typeof vi.fn>;
    initial?: typeof IDENTITY;
  } = {},
) {
  const request = overrides.request ?? vi.fn().mockResolvedValue(undefined);
  const confirm = overrides.confirm ?? vi.fn().mockResolvedValue(undefined);
  const onDone = vi.fn();
  render(
    <PasswordRecovery
      initial={overrides.initial ?? IDENTITY}
      onDone={onDone}
      requestPasswordReset={request}
      confirmPasswordReset={confirm}
    />,
  );
  return { request, confirm, onDone };
}

async function goToConfirm() {
  fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }));
  await screen.findByRole('heading', { name: 'Revisa tu correo' });
}

function fillConfirm(code: string, password: string, repeat = password) {
  fireEvent.change(screen.getByLabelText('Código de 6 dígitos'), { target: { value: code } });
  fireEvent.change(screen.getByLabelText('Contraseña nueva'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Repite la contraseña nueva'), {
    target: { value: repeat },
  });
}

describe('PasswordRecovery', () => {
  it('pide el código al correo escrito y responde lo mismo exista o no la cuenta', async () => {
    const { request } = renderRecovery();

    await goToConfirm();

    expect(request).toHaveBeenCalledWith(IDENTITY);
    expect(screen.getByText(/Si persona@atlas\.test pertenece a una cuenta activa/)).toBeVisible();
  });

  it('no pide el código con un correo mal escrito y lo señala en el campo', () => {
    const { request } = renderRecovery({ initial: { tenantId: '1', email: 'no-es-correo' } });

    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }));

    expect(request).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/usuario@empresa\.com/)).toBeVisible();
  });

  it('cambia la contraseña con el código y vuelve al acceso con el correo', async () => {
    const { confirm, onDone } = renderRecovery();
    await goToConfirm();

    fillConfirm('123456', 'una-clave-nueva-larga');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(IDENTITY, true));
    expect(confirm).toHaveBeenCalledWith({
      ...IDENTITY,
      code: '123456',
      newPassword: 'una-clave-nueva-larga',
    });
  });

  it('valida código, longitud y coincidencia antes de llamar al motor', async () => {
    const { confirm } = renderRecovery();
    await goToConfirm();

    fillConfirm('123', 'corta');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(screen.getByText('El código son exactamente 6 números.')).toBeVisible();
    expect(screen.getByText('Usa al menos 10 caracteres.')).toBeVisible();

    fillConfirm('123456', 'una-clave-nueva-larga', 'otra-clave-distinta');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(screen.getByText('Las dos contraseñas no coinciden.')).toBeVisible();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('un código malo explica qué hacer y conserva lo escrito', async () => {
    const confirm = vi
      .fn()
      .mockRejectedValue(
        new ApiError('Código inválido o expirado.', 401, 'IDENTITY_REQUEST_REJECTED'),
      );
    const { onDone } = renderRecovery({ confirm });
    await goToConfirm();

    fillConfirm('000000', 'una-clave-nueva-larga');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    expect(await screen.findByText('El código no es válido o ya venció')).toBeVisible();
    expect(screen.getByLabelText('Contraseña nueva')).toHaveValue('una-clave-nueva-larga');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('sin correo saliente lo dice sin mostrar el error crudo del servidor', async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new ApiError('El servicio de correo no está configurado', 503, 'X'));
    renderRecovery({ request });

    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }));

    expect(await screen.findByText('No podemos enviar el código en este momento')).toBeVisible();
    expect(screen.queryByText(/no está configurado/)).toBeNull();
  });

  it('pedir un código nuevo avisa que el anterior deja de servir', async () => {
    const { request } = renderRecovery();
    await goToConfirm();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar un código nuevo' }));

    expect(await screen.findByText(/el anterior deja de funcionar/)).toBeVisible();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('volver al acceso no cambia nada', () => {
    const { onDone } = renderRecovery();
    fireEvent.click(screen.getByRole('button', { name: /Volver al inicio de sesión/ }));
    expect(onDone).toHaveBeenCalledWith(IDENTITY, false);
  });
});

describe('LoginForm → recuperación', () => {
  it('«¿Olvidaste tu contraseña?» abre la recuperación con el correo ya escrito', () => {
    const onRecover = vi.fn();
    render(
      <LoginForm
        initial={{ tenantId: '4', email: 'persona@atlas.test', remember: false }}
        submitting={false}
        problem={null}
        notice={null}
        onSubmit={vi.fn()}
        onRecover={onRecover}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));

    expect(onRecover).toHaveBeenCalledWith({ tenantId: '4', email: 'persona@atlas.test' });
  });
});
