import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiRequest } from '../../api/http-client';
import { SimulatorSampleBar } from './SimulatorSampleBar';
import type { ImportField } from './sample-import';

vi.mock('../../api/http-client', () => ({ apiRequest: vi.fn() }));
const mockedApiRequest = vi.mocked(apiRequest);

const contract: ImportField[] = [
  { code: 'score', dataType: 'INTEGER', required: true },
  { code: 'country', dataType: 'STRING', required: true },
];

function renderBar(
  artifactCode = 'RIESGO',
  options: { contract?: ImportField[]; contractLoading?: boolean } = {},
) {
  const onLoad = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SimulatorSampleBar
        artifactCode={artifactCode}
        environmentCode="DEV"
        contract={options.contract ?? contract}
        contractLoading={options.contractLoading}
        onLoad={onLoad}
      />
    </QueryClientProvider>,
  );
  return onLoad;
}

/** jsdom no implementa `File.text()`. */
function fileWith(name: string, content: string): File {
  const file = new File([content], name);
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
  return file;
}

describe('SimulatorSampleBar', () => {
  beforeEach(() => mockedApiRequest.mockReset());

  it('pide los valores al backend y carga el primer caso en el formulario', async () => {
    mockedApiRequest.mockResolvedValue({
      seed: 'k3f2',
      kind: 'VALID',
      cases: [
        { index: 0, kind: 'VALID', input: { score: 700, country: 'PE' } },
        { index: 1, kind: 'VALID', input: { score: 810, country: 'CL' } },
      ],
    } as never);
    const onLoad = renderBar();

    fireEvent.change(screen.getByLabelText('Valores de prueba'), { target: { value: 'VALID' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar valores/ }));

    await waitFor(() => expect(onLoad).toHaveBeenCalledWith({ score: 700, country: 'PE' }));
    const [path, options] = mockedApiRequest.mock.calls[0];
    expect(path).toBe('/v1/simulations/RIESGO/sample-inputs');
    expect(options?.body).toMatchObject({ environmentCode: 'DEV', kind: 'VALID' });
    // La semilla se muestra: sin ella, un caso interesante no se puede volver a obtener.
    expect(await screen.findByText(/semilla k3f2/)).toBeInTheDocument();
  });

  it('por omisión pide un caso por desenlace y rotula cada uno con el suyo', async () => {
    mockedApiRequest.mockResolvedValue({
      seed: 's',
      kind: 'OUTCOMES',
      totalOutcomes: 2,
      cases: [
        { index: 0, kind: 'OUTCOME', outcome: 'APPROVED', input: { score: 810 } },
        { index: 1, kind: 'OUTCOME', outcome: 'Revisión manual', input: { score: 640 } },
      ],
    } as never);
    renderBar();

    fireEvent.click(screen.getByRole('button', { name: /Generar valores/ }));

    await waitFor(() =>
      expect(mockedApiRequest.mock.calls[0][1]?.body).toMatchObject({ kind: 'OUTCOMES' }),
    );
    expect(await screen.findByRole('button', { name: 'Caso 1 · APPROVED' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Caso 2 · Revisión manual' })).toBeInTheDocument();
  });

  it('avisa de los desenlaces que la tanda NO cubre', async () => {
    mockedApiRequest.mockResolvedValue({
      seed: 's',
      kind: 'OUTCOMES',
      totalOutcomes: 4,
      cases: [
        {
          index: 0,
          kind: 'OUTCOME',
          outcome: 'APPROVED',
          input: { score: 810 },
          unresolved: ['e_rev: «dti_alto» no depende de las entradas'],
        },
      ],
    } as never);
    renderBar();

    fireEvent.click(screen.getByRole('button', { name: /Generar valores/ }));

    expect(await screen.findByText(/faltan 3 por cubrir/)).toBeInTheDocument();
    expect(screen.getByText(/no están garantizadas/)).toBeInTheDocument();
  });

  it('pasa la clase pedida al backend', async () => {
    mockedApiRequest.mockResolvedValue({ seed: 's', kind: 'INVALID', cases: [] } as never);
    renderBar();

    fireEvent.change(screen.getByLabelText('Valores de prueba'), { target: { value: 'INVALID' } });
    fireEvent.click(screen.getByRole('button', { name: /Generar valores/ }));

    await waitFor(() =>
      expect(mockedApiRequest.mock.calls[0][1]?.body).toMatchObject({ kind: 'INVALID' }),
    );
  });

  it('carga un CSV subido sin llamar al backend', async () => {
    const onLoad = renderBar();
    const input = screen.getByLabelText(/Subir archivo JSON o CSV/);

    fireEvent.change(input, {
      target: { files: [fileWith('casos.csv', 'score,country\n700,PE\n810,CL')] },
    });

    await waitFor(() => expect(onLoad).toHaveBeenCalledWith({ score: 700, country: 'PE' }));
    expect(mockedApiRequest).not.toHaveBeenCalled();
    // Con varios casos aparece el selector para recorrerlos.
    fireEvent.click(await screen.findByRole('button', { name: 'Caso 2' }));
    expect(onLoad).toHaveBeenLastCalledWith({ score: 810, country: 'CL' });
  });

  it('carga un JSON subido', async () => {
    const onLoad = renderBar();
    fireEvent.change(screen.getByLabelText(/Subir archivo JSON o CSV/), {
      target: { files: [fileWith('caso.json', '{"score": 640, "country": "PE"}')] },
    });
    await waitFor(() => expect(onLoad).toHaveBeenCalledWith({ score: 640, country: 'PE' }));
  });

  it('un archivo ilegible avisa y no carga nada', async () => {
    const onLoad = renderBar();
    fireEvent.change(screen.getByLabelText(/Subir archivo JSON o CSV/), {
      target: { files: [fileWith('roto.json', '{no')] },
    });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(onLoad).not.toHaveBeenCalled();
  });

  it('sin artefacto elegido, ambas acciones están deshabilitadas', () => {
    renderBar('');
    expect(screen.getByRole('button', { name: /Generar valores/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Subir JSON o CSV/ })).toBeDisabled();
  });

  /*
   * El contrato llega por red, y hasta que llega no se sabe dónde entra un
   * documento. Subir el PDF en ese hueco se rechazaba con «este artefacto no
   * declara ninguna variable de documento» —falso: sí la declara— y el analista
   * se quedaba con el formulario vacío y un «faltan variables obligatorias».
   * Como dependía de la latencia, fallaba «a veces» y nunca al probarlo.
   */
  it('no acepta archivos mientras el contrato no ha llegado', () => {
    renderBar('EXTRACTO', { contract: [], contractLoading: true });

    const subir = screen.getByRole('button', { name: /Leyendo el contrato/ });
    expect(subir).toBeDisabled();
  });

  it('con el contrato en camino no afirma que el artefacto no admita documentos', async () => {
    const onLoad = renderBar('EXTRACTO', { contract: [], contractLoading: true });

    fireEvent.change(screen.getByLabelText(/Subir archivo/), {
      target: { files: [fileWith('extracto.pdf', '%PDF-1.4')] },
    });

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/contrato/i));
    expect(screen.getByRole('alert')).not.toHaveTextContent(/no declara ninguna variable/i);
    expect(onLoad).not.toHaveBeenCalled();
  });

  it('con el contrato ya leído sí dice la verdad: este artefacto no admite documentos', async () => {
    // `score`/`country` no son un hueco documental, y aquí el contrato SÍ llegó.
    const onLoad = renderBar('RIESGO');

    fireEvent.change(screen.getByLabelText(/Subir archivo/), {
      target: { files: [fileWith('extracto.pdf', '%PDF-1.4')] },
    });

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/no declara ninguna variable/i),
    );
    expect(onLoad).not.toHaveBeenCalled();
  });
});
