import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { abrirOpciones } from '../../test/option-select';
import { ActionForm } from './ActionForm';
import { ActionNodeEditor } from './ActionNodeEditor';

/**
 * Reparto de competencias entre acciones y campos calculados.
 *
 * Las dos pantallas resolvían lo mismo de dos maneras: una acción `SET_FIELD`
 * calculaba un valor igual que un campo calculado, pero sin versionarse, sin
 * probarse con ejemplos y sin poder reutilizarse en otro algoritmo. Calcular pasa
 * a ser competencia de los campos calculados; las acciones quedan para los
 * EFECTOS (emitir un motivo, abrir una revisión), que no son cálculos.
 */
/** Los valores que ofrece el desplegable de tipo, abriéndolo como lo haría una persona. */
function typeOptions(): string[] {
  const prefijo = 'select-actionType-option-';
  return abrirOpciones(screen.getByTestId('select-actionType')).map((row) =>
    (row.getAttribute('data-testid') ?? '').slice(prefijo.length),
  );
}

describe('acciones y campos calculados', () => {
  it('al CREAR una acción ya no ofrece «calcular un campo»', () => {
    render(<ActionForm onCreate={vi.fn()} onCancel={vi.fn()} />);
    const options = typeOptions();

    expect(options).toContain('EMIT_REASON');
    expect(options).toContain('CREATE_MANUAL_REVIEW');
    expect(options).not.toContain('SET_FIELD');
  });

  it('al EDITAR una que ya calcula, sí la ofrece: hay que poder corregirla', () => {
    render(
      <ActionForm
        onCreate={vi.fn()}
        onCancel={vi.fn()}
        initial={{ code: 'SET_SCORE', type: 'SET_FIELD', payload: {} }}
      />,
    );
    expect(typeOptions()).toContain('SET_FIELD');
  });

  it('un paso con acción de cálculo dirige al campo calculado', () => {
    render(
      <ActionNodeEditor
        node={{ key: 'CALC', actions: [{ actionCode: 'SET_SCORE' }] }}
        config={{ actionCode: 'SET_SCORE' }}
        actions={[{ code: 'SET_SCORE', type: 'SET_FIELD', payload: {} }]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Los cálculos nuevos se declaran/)).toBeInTheDocument();
  });

  it('no molesta con ese aviso cuando la acción es un efecto', () => {
    render(
      <ActionNodeEditor
        node={{ key: 'AVISO', actions: [{ actionCode: 'EMIT' }] }}
        config={{ actionCode: 'EMIT' }}
        actions={[{ code: 'EMIT', type: 'EMIT_REASON', payload: {} }]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Los cálculos nuevos se declaran/)).not.toBeInTheDocument();
  });
});
