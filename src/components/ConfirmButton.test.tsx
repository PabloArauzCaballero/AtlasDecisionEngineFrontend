import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmButton } from './ConfirmButton';

function renderButton(onConfirm: () => void | Promise<unknown> = vi.fn()) {
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

  it('el doble clic no manda dos borrados', async () => {
    // El reflejo del doble clic llegaba entero: se cerraba y llamaba en el mismo
    // gesto, sin nada que impidiera el segundo.
    let release = () => {};
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    renderButton(onConfirm);

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar nodo' }));
    const confirm = screen.getByRole('button', { name: 'Eliminar el paso' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Mientras corre, la pregunta sigue puesta y bloqueada.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Procesando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();

    await act(async () => {
      release();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Escape no cierra a media faena: dejaría el borrado sin desenlace', () => {
    const onConfirm = vi.fn(() => new Promise<void>(() => {}));
    renderButton(onConfirm);

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar nodo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar el paso' }));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
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
