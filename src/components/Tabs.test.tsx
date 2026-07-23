import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Tabs, type TabDefinition } from './Tabs';

const TABS: TabDefinition[] = [
  { id: 'a', label: 'Resumen' },
  { id: 'b', label: 'Versiones', count: 3 },
  { id: 'c', label: 'Deshabilitada', disabled: true },
];

function Harness() {
  const [active, setActive] = useState('a');
  return (
    <Tabs tabs={TABS} active={active} onChange={setActive} idPrefix="t">
      {(id) => <div data-testid={`panel-${id}`}>Contenido {id}</div>}
    </Tabs>
  );
}

describe('Tabs', () => {
  it('marca la pestaña activa y monta solo su panel (lazy)', () => {
    render(<Harness />);
    expect(screen.getByRole('tab', { name: /Resumen/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('panel-a')).toBeVisible();
    expect(screen.queryByTestId('panel-b')).toBeNull();
  });

  it('al cambiar conserva la pestaña previa montada pero oculta', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('tab', { name: /Versiones/ }));
    expect(screen.getByTestId('panel-b')).toBeVisible();
    expect(screen.getByTestId('panel-a').closest('[role="tabpanel"]')).toHaveAttribute('hidden');
  });

  it('muestra el contador y deshabilita las pestañas marcadas', () => {
    render(<Harness />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Deshabilitada/ })).toBeDisabled();
  });

  it('navega con el teclado saltando las deshabilitadas', () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /Versiones/ })).toHaveAttribute('aria-selected', 'true');
    // Otra flecha derecha vuelve a 'a' (la 'c' deshabilitada se omite).
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: /Resumen/ })).toHaveAttribute('aria-selected', 'true');
  });
});
