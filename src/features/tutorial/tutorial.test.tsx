import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { TutorialProvider } from './TutorialProvider';
import { useTutorial } from './useTutorial';
import { TUTORIAL_STEPS } from './tutorial-steps';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

// This jsdom/Node combination doesn't provide a working window.localStorage by
// default (Node's experimental global one shadows jsdom's) — a minimal in-memory
// stand-in is enough to exercise TutorialProvider's persistence.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number) {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}
Object.defineProperty(window, 'localStorage', { value: new MemoryStorage(), configurable: true });

function HelpButton() {
  const tutorial = useTutorial();
  return (
    <button type="button" onClick={tutorial.start}>
      start-tutorial
    </button>
  );
}

function renderWithProvider() {
  return render(
    <TutorialProvider>
      <HelpButton />
    </TutorialProvider>,
  );
}

describe('TutorialProvider (Fase 4 — interactive tutorial)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    push.mockClear();
  });

  it('is not completed and not active before the user starts it', () => {
    renderWithProvider();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('starts on the first step and shows its title', () => {
    renderWithProvider();
    fireEvent.click(screen.getByText('start-tutorial'));
    expect(screen.getByRole('dialog', { name: TUTORIAL_STEPS[0].title })).toBeInTheDocument();
    expect(screen.getByText('Paso 1 de ' + TUTORIAL_STEPS.length)).toBeInTheDocument();
  });

  it("navigates to a step's route when advancing to it", () => {
    renderWithProvider();
    fireEvent.click(screen.getByText('start-tutorial'));
    // Steps 0 and 1 have no route; advance until the step that does.
    const routedIndex = TUTORIAL_STEPS.findIndex((step) => step.route);
    for (let i = 0; i < routedIndex; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: /Siguiente|Finalizar/ }));
    }
    expect(push).toHaveBeenCalledWith(TUTORIAL_STEPS[routedIndex].route);
  });

  it('goes back with "Atrás" and disables it on the first step', () => {
    renderWithProvider();
    fireEvent.click(screen.getByText('start-tutorial'));
    expect(screen.getByRole('button', { name: 'Atrás' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Siguiente|Finalizar/ }));
    expect(screen.getByRole('button', { name: 'Atrás' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
    expect(screen.getByRole('dialog', { name: TUTORIAL_STEPS[0].title })).toBeInTheDocument();
  });

  it('exits without marking completion, but finishing the last step marks it complete in localStorage', () => {
    renderWithProvider();
    fireEvent.click(screen.getByText('start-tutorial'));
    fireEvent.click(screen.getByLabelText('Salir del tutorial'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('atlas.tutorial.completed')).toBeNull();

    fireEvent.click(screen.getByText('start-tutorial'));
    for (let i = 0; i < TUTORIAL_STEPS.length; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: /Siguiente|Finalizar/ }));
    }
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('atlas.tutorial.completed')).toBe('true');
  });
});
