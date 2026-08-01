import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmButton } from './ConfirmButton';

function renderButton(onConfirm = vi.fn()) {
  render(
    <ConfirmButton
      title="¿Eliminar el paso «Rechazo KYC»?"
      description={<p>Se borra el paso y todas sus conexiones.</p>}
      confirmLabel="Eliminar el paso"
      onConfirm={onConfirm}
    >
      Eliminar nodo
    </ConfirmButton>,
  );
  return onConfirm;
}

describe('ConfirmButton', () => {
  it('no destruye nada al primer clic: abre la pregunta', () => {
    const onConfirm = renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar nodo' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // La consecuencia se nombra: sin eso, preguntar no aporta nada.
    expect(screen.getByText(/todas sus conexiones/)).toBeInTheDocument();
  });

  it('destruye sólo al confirmar', () => {
    const onConfirm = renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar nodo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar el paso' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('cancelar cierra sin tocar nada', () => {
    const onConfirm = renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar nodo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Escape también cancela: es la salida que se busca por reflejo', () => {
    const onConfirm = renderButton();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar nodo' }));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('un botón deshabilitado no llega a preguntar', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmButton
        disabled
        label="Quitar"
        title="¿Quitar?"
        description={<p>Consecuencia.</p>}
        onConfirm={onConfirm}
      >
        x
      </ConfirmButton>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
