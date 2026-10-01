import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CaseImagesPanel } from './CaseImagesPanel';

vi.mock('../../api/http-client', () => ({ apiRequest: vi.fn(() => new Promise(() => undefined)) }));
vi.mock('../../api/file-download', () => ({ apiDownload: vi.fn() }));

/**
 * Un caso sin `correlationId` no puede desaparecer del detalle: antes el panel devolvía `null` y
 * el analista no sabía si no había carnet o si la pantalla no lo traía.
 */
describe('documentos del solicitante en la revisión manual', () => {
  it('dice que no puede llegar a las imágenes cuando el caso no trae el intento', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CaseImagesPanel attemptId="" />
      </QueryClientProvider>,
    );
    expect(screen.getByText('Documentos del solicitante')).toBeTruthy();
    expect(screen.getByText(/no se puede llegar a su carnet/)).toBeTruthy();
  });
});
