import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ActionIcon } from './ActionIcon';

describe('ActionIcon', () => {
  it('usa el texto del catálogo como nombre accesible y tooltip', () => {
    render(<ActionIcon action="edit" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Editar');
  });

  it('permite especializar el texto accesible', () => {
    render(<ActionIcon action="edit" label="Editar esta versión" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Editar esta versión' })).toBeInTheDocument();
  });

  it('dispara onClick en acciones sin confirmación', () => {
    const onClick = vi.fn();
    render(<ActionIcon action="edit" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('no dispara onClick cuando está deshabilitado', () => {
    const onClick = vi.fn();
    render(<ActionIcon action="edit" disabled onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('una acción destructiva pide confirmación antes de ejecutarse', () => {
    const onClick = vi.fn();
    render(<ActionIcon action="delete" label="Eliminar versión" onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar versión' }));
    // No se ejecuta hasta confirmar.
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('cancelar la confirmación no ejecuta la acción', () => {
    const onClick = vi.fn();
    render(<ActionIcon action="delete" label="Eliminar versión" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar versión' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
