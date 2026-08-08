import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IdentityUser } from '../auth/auth.types';

const apiRequest = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const start = vi.hoisted(() => vi.fn());
let currentUser: IdentityUser | null = null;

vi.mock('../api/http-client', () => ({ apiRequest }));
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: currentUser }) }));
vi.mock('../features/tutorial/useInteractiveTutorial', () => ({
  useInteractiveTutorial: () => ({ start }),
}));
// El menú de ayuda de la cabecera lee contextos que esta prueba no monta.
vi.mock('../features/tutorial/TutorialMenu', () => ({ TutorialMenu: () => null }));

const { TutorialCenterPage } = await import('./TutorialCenterPage');

const CACHE_KEY = 'atlas.tutorial.progress';

function userWith(roles: string[]): IdentityUser {
  return {
    id: '1',
    tenantId: '1',
    email: 'persona@atlas.bo',
    fullName: 'Persona Analista',
    name: 'Persona',
    userCode: 'U-1',
    status: 'ACTIVE',
    department: null,
    jobTitle: null,
    mustChangePassword: false,
    mfaEnabled: false,
    roles,
    legacyRoles: [],
    permissions: [],
  } as IdentityUser;
}

beforeEach(() => {
  apiRequest.mockClear();
  apiRequest.mockResolvedValue([]);
  start.mockClear();
  // El tester es quien diseña reglas, así que es el rol con el que tienen
  // sentido los recorridos de autoría sobre los que gira este archivo.
  currentUser = userWith(['QA_ANALYST']);
});

describe('Centro de Tutoriales', () => {
  it('lista los tutoriales que el rol puede hacer, agrupados por módulo', async () => {
    render(<TutorialCenterPage />);

    expect(await screen.findByText('Centro de Tutoriales')).toBeInTheDocument();
    expect(screen.getByText('El editor de grafo, herramienta por herramienta')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Diseño' })).toBeInTheDocument();
  });

  it('un auditor no ve los recorridos de autoría que su rol no puede abrir', async () => {
    currentUser = userWith(['AUDITOR']);
    render(<TutorialCenterPage />);

    await screen.findByText('Centro de Tutoriales');
    expect(
      screen.queryByText('El editor de grafo, herramienta por herramienta'),
    ).not.toBeInTheDocument();
    // Pero sí conserva lo suyo.
    expect(screen.getByRole('heading', { name: 'Auditoría' })).toBeInTheDocument();
  });

  it('un analista de riesgo tampoco ve los recorridos de autoría', async () => {
    // Regla de negocio: el analista de riesgo consulta casos, no diseña reglas.
    // Enseñarle a usar el editor sería enseñarle una pantalla que no puede abrir.
    currentUser = userWith(['RISK_ANALYST']);
    render(<TutorialCenterPage />);

    await screen.findByText('Centro de Tutoriales');
    expect(
      screen.queryByText('El editor de grafo, herramienta por herramienta'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Auditoría' })).toBeInTheDocument();
  });

  it('el porcentaje se mide sólo sobre lo que el rol puede hacer', async () => {
    render(<TutorialCenterPage />);
    const bar = await screen.findByRole('progressbar', { name: /Avance general/ });
    // Sin progreso guardado, 0 %: nunca "NaN" ni un porcentaje contra el catálogo entero.
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('el buscador filtra la lista y anuncia cuántos quedan', async () => {
    render(<TutorialCenterPage />);
    await screen.findByText('Centro de Tutoriales');

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'grafo' } });

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/tutorial/));
    // Se filtra la LISTA; la fila de recomendados es una sección aparte y sigue
    // ofreciendo por dónde empezar aunque la búsqueda no los incluya.
    const list = within(screen.getByTestId('tutorial-list'));
    expect(list.getByText('El editor de grafo, herramienta por herramienta')).toBeInTheDocument();
    expect(list.queryByText('Simulador de Decisión')).not.toBeInTheDocument();
  });

  it('un filtro sin resultados explica cómo salir del estado vacío', async () => {
    render(<TutorialCenterPage />);
    await screen.findByText('Centro de Tutoriales');

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzzz' } });

    expect(await screen.findByText('Ningún tutorial coincide')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.queryByText('Ningún tutorial coincide')).not.toBeInTheDocument();
  });

  it('«Comenzar» arranca el recorrido retomando el progreso guardado', async () => {
    render(<TutorialCenterPage />);
    await screen.findByText('Centro de Tutoriales');

    const card = screen
      .getByText('El editor de grafo, herramienta por herramienta')
      .closest('article');
    fireEvent.click(within(card as HTMLElement).getByRole('button', { name: /Comenzar/ }));

    expect(start).toHaveBeenCalledWith('graph-editor', { resume: true });
  });

  it('un tutorial a medias ofrece continuar y dice por dónde iba', async () => {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        'graph-editor': {
          tutorialId: 'graph-editor',
          status: 'SKIPPED',
          lastStep: 3,
          version: 2,
        },
      }),
    );
    render(<TutorialCenterPage />);
    await screen.findByText('Centro de Tutoriales');

    const card = screen
      .getByText('El editor de grafo, herramienta por herramienta')
      .closest('article');
    const scope = within(card as HTMLElement);
    expect(scope.getByText(/Lo dejaste en el paso 4/)).toBeInTheDocument();
    expect(scope.getByRole('button', { name: /Continuar/ })).toBeInTheDocument();

    fireEvent.click(scope.getByRole('button', { name: /Reiniciar/ }));
    expect(start).toHaveBeenCalledWith('graph-editor', { repeat: true });
  });

  it('un tutorial completado se puede repetir y cuenta como avance', async () => {
    const entry = { status: 'COMPLETED', lastStep: 0, version: 99 };
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ 'graph-editor': { tutorialId: 'graph-editor', ...entry } }),
    );
    render(<TutorialCenterPage />);
    await screen.findByText('Centro de Tutoriales');

    const card = screen
      .getByText('El editor de grafo, herramienta por herramienta')
      .closest('article');
    expect(within(card as HTMLElement).getByText('Completado')).toBeInTheDocument();
    expect(
      within(card as HTMLElement).getByRole('button', { name: /Repetir/ }),
    ).toBeInTheDocument();
  });

  it('un tutorial completado en una versión vieja se marca como actualizado', async () => {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        'graph-editor': {
          tutorialId: 'graph-editor',
          status: 'COMPLETED',
          lastStep: 0,
          // Versión anterior a la del catálogo: el recorrido cambió desde entonces.
          version: 1,
        },
      }),
    );
    render(<TutorialCenterPage />);
    await screen.findByText('Centro de Tutoriales');

    const card = screen
      .getByText('El editor de grafo, herramienta por herramienta')
      .closest('article');
    const scope = within(card as HTMLElement);
    expect(scope.getByText('Actualizado')).toBeInTheDocument();
    expect(scope.getByText(/Cambió desde que lo hiciste/)).toBeInTheDocument();
  });

  it('avisa de los recorridos previos que conviene hacer antes', async () => {
    render(<TutorialCenterPage />);
    await screen.findByText('Centro de Tutoriales');

    const card = screen
      .getByText('El editor de grafo, herramienta por herramienta')
      .closest('article');
    // `graph-editor` exige variables y artefactos, ninguno completado todavía.
    // Es sugerencia, no bloqueo: la tarjeta lo dice y deja empezar igual.
    expect(within(card as HTMLElement).getByText(/Antes conviene:/)).toBeInTheDocument();
  });
});
