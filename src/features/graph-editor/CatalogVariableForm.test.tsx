import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../../api/http-client';
import { CatalogVariableForm } from './CatalogVariableForm';

vi.mock('../../api/http-client', () => ({ apiRequest: vi.fn() }));
const mockedApiRequest = vi.mocked(apiRequest);

/** La vista de opciones del motor, con su forma real `{ value, label }`. */
const OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  ownerTeam: [
    { value: 'RIESGO', label: 'Riesgo' },
    { value: 'FRAUDE', label: 'Fraude' },
  ],
  dataClassification: [
    { value: 'INTERNAL', label: 'Interno' },
    { value: 'CONFIDENTIAL', label: 'Confidencial' },
  ],
};

function renderForm() {
  const onSubmit = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CatalogVariableForm pending={false} onSubmit={onSubmit} />
    </QueryClientProvider>,
  );
  return onSubmit;
}

/**
 * Localiza el CONTROL de un campo, no su botón de ayuda.
 *
 * Cada campo lleva un botón «Qué es…» cuyo nombre accesible repite la etiqueta,
 * así que buscar sólo por texto devuelve el botón en cuanto aparece. Y un
 * `fireEvent.change` sobre un botón no cambia nada: el borrador se enviaba con
 * los dos campos de catálogo vacíos sin que nada lo delatara.
 */
const field = (label: RegExp) =>
  screen.getByLabelText(label, { selector: 'input, select, textarea' });

describe('CatalogVariableForm', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
    mockedApiRequest.mockImplementation((path: string) => {
      const group = new URL(path, 'http://local').searchParams.get('group') ?? '';
      return Promise.resolve(OPTIONS[group] ?? []) as never;
    });
  });

  it('no inventa ningún dato de gobierno: arranca todo vacío', () => {
    renderForm();

    // El fallo que corrige: el portal enviaba clasificación INTERNAL, equipo
    // DECISION_ENGINE y una descripción generada que nadie escribió, y el código
    // venía prerrellenado con «scoring».
    for (const label of [
      /Código/,
      /Nombre/,
      /Equipo responsable/,
      /Clasificación de datos/,
      /Para qué sirve/,
    ]) {
      expect(field(label)).toHaveValue('');
    }
  });

  it('pide el equipo y la clasificación al motor, no a una lista escrita a mano', () => {
    renderForm();

    const endpoints = mockedApiRequest.mock.calls.map((call) => String(call[0]));
    expect(endpoints).toContain('/v1/views/options?group=ownerTeam');
    expect(endpoints).toContain('/v1/views/options?group=dataClassification');
  });

  it('entrega lo que la persona escribió, sin añadidos', async () => {
    const onSubmit = renderForm();

    // Los desplegables de catálogo llegan vacíos y se pueblan cuando el motor
    // responde: elegir antes no guardaría nada. Se espera por el texto de la
    // opción y no por su rol, porque jsdom no expone como `option` el contenido
    // de un desplegable cerrado.
    await screen.findByText('Riesgo');
    await screen.findByText('Confidencial');

    fireEvent.change(field(/Código/), { target: { value: 'score_riesgo' } });
    fireEvent.change(field(/Nombre/), { target: { value: 'Score de riesgo' } });
    fireEvent.change(field(/Equipo responsable/), { target: { value: 'RIESGO' } });
    fireEvent.change(field(/Clasificación de datos/), {
      target: { value: 'CONFIDENTIAL' },
    });
    fireEvent.change(field(/Para qué sirve/), {
      target: { value: 'Riesgo estimado del solicitante.' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar y elegir' }));

    expect(onSubmit).toHaveBeenCalledWith({
      variableCode: 'score_riesgo',
      canonicalName: 'Score de riesgo',
      businessDescription: 'Riesgo estimado del solicitante.',
      dataClassification: 'CONFIDENTIAL',
      ownerTeam: 'RIESGO',
      dataType: 'NUMBER',
    });
  });
});
