import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { tutorialById } from '../features/tutorial/interactive-catalog';

// El menú de ayuda de la cabecera lee contextos que esta prueba no monta.
vi.mock('../features/tutorial/TutorialMenu', () => ({ TutorialMenu: () => null }));
vi.mock('../navigation/NavLink', () => ({
  NavLink: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const { QaLabTutorialPage } = await import('./QaLabTutorialPage');

describe('el tutorial del Laboratorio de pruebas, en su página', () => {
  it('cuenta TODOS los pasos del recorrido, en orden y sin copiarlos', () => {
    render(<QaLabTutorialPage />);
    const tutorial = tutorialById('qa-lab')!;

    const pasos = within(screen.getByTestId('qa-lab-tutorial-steps')).getAllByRole('listitem');
    expect(pasos).toHaveLength(tutorial.steps.length);
    tutorial.steps.forEach((step, index) => {
      expect(
        within(pasos[index]!).getByRole('heading', { name: step.title.replace(/^\d+\.\s*/, '') }),
      ).toBeInTheDocument();
    });
  });

  it('se vuelve al laboratorio con un enlace: la página no arranca nada encima de él', () => {
    render(<QaLabTutorialPage />);

    expect(screen.getByRole('link', { name: /Volver al laboratorio/ })).toHaveAttribute(
      'href',
      '/qa-lab',
    );
    expect(screen.queryByRole('button', { name: /recorrido/i })).toBeNull();
  });
});
