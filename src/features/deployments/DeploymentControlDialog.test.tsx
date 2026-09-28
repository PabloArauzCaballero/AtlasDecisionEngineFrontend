import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/ApiError';
import { apiRequest } from '../../api/http-client';
import { DeploymentControlDialog } from './DeploymentControlDialog';

vi.mock('../../api/http-client', () => ({ apiRequest: vi.fn() }));
vi.mock('../../notifications/useNotifications', () => ({
  useNotifications: () => ({ notify: vi.fn() }),
}));

const request = vi.mocked(apiRequest);

function renderDialog() {
  const onClose = vi.fn();
  const onDone = vi.fn();
  const onConflict = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const props = {
    kind: 'rollback' as const,
    deploymentId: '42',
    descripcion: 'CREDIT en producción',
    onClose,
    onDone,
    onConflict,
  };
  render(
    <QueryClientProvider client={client}>
      <DeploymentControlDialog {...props} />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Motivo' }), {
    target: { value: 'Incidente confirmado en producción' },
  });
  return { onClose, onDone, onConflict };
}

describe('DeploymentControlDialog', () => {
  beforeEach(() => request.mockReset());

  it('mantiene el diálogo y el motivo ante un conflicto del motor', async () => {
    request.mockRejectedValueOnce(new ApiError('El despliegue ya no está activo', 409));
    const { onClose, onDone, onConflict } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Revertir' }));

    expect(await screen.findByText('El despliegue ya no está activo')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Motivo' })).toHaveValue(
      'Incidente confirmado en producción',
    );
    expect(onDone).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(onConflict).toHaveBeenCalledTimes(1);
  });

  it('avisa al padre para refrescar solo cuando el reintento queda confirmado', async () => {
    request
      .mockRejectedValueOnce(new Error('El despliegue ya no está activo'))
      .mockResolvedValueOnce({ deploymentId: '42', status: 'ROLLED_BACK' });
    const { onClose, onDone } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Revertir' }));
    await screen.findByText('El despliegue ya no está activo');
    fireEvent.click(screen.getByRole('button', { name: 'Revertir' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
