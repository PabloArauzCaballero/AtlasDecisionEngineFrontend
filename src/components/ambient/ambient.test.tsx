import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AmbientProvider } from './AmbientProvider';
import { ambientVariantFor } from './ambient-routes';
import { useAmbientState } from './useAmbientState';
import type { AmbientState } from '../AmbientBackground';

const pathname = vi.hoisted(() => ({ value: '/platform-health' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }));

afterEach(() => {
  pathname.value = '/platform-health';
});

function View({ state, label }: { state: AmbientState; label: string }) {
  useAmbientState(state);
  return <p>{label}</p>;
}

const background = () => document.querySelector('.ambient-bg') as HTMLElement;

describe('variante por ruta', () => {
  it('asigna un fondo a cada familia de la plataforma', () => {
    expect(ambientVariantFor('/platform-health')).toBe('dashboard');
    expect(ambientVariantFor('/graph-editor')).toBe('editor');
    expect(ambientVariantFor('/test-suites')).toBe('lab');
    expect(ambientVariantFor('/deployments')).toBe('deploy');
    expect(ambientVariantFor('/executions/abc')).toBe('results');
  });

  it('cubre también las rutas de detalle de cada listado', () => {
    expect(ambientVariantFor('/artifact-versions/v1/graph')).toBe('editor');
    expect(ambientVariantFor('/manual-reviews/case-7')).toBe('results');
    expect(ambientVariantFor('/test-runs/run-3/coverage')).toBe('lab');
  });

  it('no deja ninguna ruta sin fondo', () => {
    // Una vista nueva hereda el fondo del panel en vez de quedarse plana.
    expect(ambientVariantFor('/ruta-que-todavia-no-existe')).toBe('dashboard');
  });
});

describe('AmbientProvider', () => {
  it('monta un único fondo para toda la aplicación', () => {
    render(
      <AmbientProvider>
        <View state="idle" label="a" />
        <View state="idle" label="b" />
      </AmbientProvider>,
    );

    expect(document.querySelectorAll('.ambient-bg')).toHaveLength(1);
    expect(screen.getByText('a')).toBeInTheDocument();
  });

  it('refleja el estado que publica la vista activa', () => {
    render(
      <AmbientProvider>
        <View state="running" label="ejecutando" />
      </AmbientProvider>,
    );

    expect(background()).toHaveAttribute('data-state', 'running');
  });

  it('da prioridad al estado más urgente cuando coinciden varios', () => {
    render(
      <AmbientProvider>
        <View state="running" label="cargando" />
        <View state="error" label="falló" />
      </AmbientProvider>,
    );

    // Un fallo no puede quedar tapado por un "en curso" de otra consulta.
    expect(background()).toHaveAttribute('data-state', 'error');
  });

  it('vuelve a reposo cuando la vista que publicaba se desmonta', () => {
    const { rerender } = render(
      <AmbientProvider>
        <View state="error" label="falló" />
      </AmbientProvider>,
    );
    expect(background()).toHaveAttribute('data-state', 'error');

    rerender(<AmbientProvider>{null}</AmbientProvider>);

    expect(background()).toHaveAttribute('data-state', 'idle');
  });

  it('cambia de variante al navegar a otra familia', () => {
    const { rerender } = render(<AmbientProvider>{null}</AmbientProvider>);
    expect(background()).toHaveClass('ambient-dashboard');

    pathname.value = '/graph-editor';
    rerender(<AmbientProvider>{null}</AmbientProvider>);

    expect(background()).toHaveClass('ambient-editor');
  });
});

describe('useAmbientState fuera del proveedor', () => {
  it('no rompe la vista: el fondo es decoración, no un requisito', () => {
    expect(() => render(<View state="running" label="suelta" />)).not.toThrow();
    expect(screen.getByText('suelta')).toBeInTheDocument();
  });
});
