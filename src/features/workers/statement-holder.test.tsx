import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatementHolderPanel } from './StatementHolderPanel';
import { REJECTION_ADVICE, REVIEW_REASON_HELP, REVIEW_REASON_LABEL } from './statement-review';

/** El titular del extracto frente al cliente que lo subió (2026-10-16). */
describe('StatementHolderPanel', () => {
  it('enseña el cliente, lo leído y el veredicto', () => {
    render(
      <StatementHolderPanel
        holder={{ expected: 'Juan Pérez Gómez', read: 'MARIA LOPEZ ROJAS', verdict: 'MISMATCH' }}
      />,
    );
    expect(screen.getByText('Juan Pérez Gómez')).toBeTruthy();
    expect(screen.getByText('MARIA LOPEZ ROJAS')).toBeTruthy();
    expect(screen.getByText('No coincide con el cliente')).toBeTruthy();
    expect(screen.getByTestId('statement-holder').getAttribute('data-verdict')).toBe('MISMATCH');
  });

  it('titular ilegible: lo dice en vez de dejar el hueco', () => {
    render(
      <StatementHolderPanel
        holder={{ expected: 'Juan Pérez', read: null, verdict: 'UNREADABLE' }}
      />,
    );
    expect(screen.getByText('No se pudo leer')).toBeTruthy();
    expect(screen.getByText('No se pudo leer el titular')).toBeTruthy();
  });

  it('sin titular exigido ni leído no pinta nada', () => {
    const { container } = render(<StatementHolderPanel holder={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('los motivos nuevos tienen etiqueta, ayuda y consejo', () => {
    expect(REVIEW_REASON_LABEL.HOLDER_UNREADABLE).toBe('Titular sin confirmar');
    expect(REVIEW_REASON_HELP.HOLDER_UNREADABLE).toMatch(/carátula/);
    expect(REJECTION_ADVICE.HOLDER_MISMATCH).toMatch(/a su nombre/);
  });
});
