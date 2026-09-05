import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SemanticModelSettingsPanel } from './SemanticModelSettingsPanel';
import {
  fetchModelSettings,
  fetchOpenRouterCatalog,
  probeModelSettings,
  saveModelSettings,
  type SemanticModelSettings,
} from './model-settings.api';

vi.mock('./model-settings.api', async (importar) => ({
  ...(await importar<typeof import('./model-settings.api')>()),
  fetchModelSettings: vi.fn(),
  fetchOpenRouterCatalog: vi.fn(),
  saveModelSettings: vi.fn(),
  resetModelSettings: vi.fn(),
  probeModelSettings: vi.fn(),
}));
const notify = vi.fn();
vi.mock('../../notifications/useNotifications', () => ({
  useNotifications: () => ({ notify }),
}));

const leer = vi.mocked(fetchModelSettings);
const catalogo = vi.mocked(fetchOpenRouterCatalog);
const guardar = vi.mocked(saveModelSettings);
const probar = vi.mocked(probeModelSettings);

/**
 * La pestaña de configuración del modelo, tal como la pantalla lo AFIRMA.
 *
 * Lo que se protege: que diga qué está en uso y de dónde sale; que un gateway
 * sin credencial se ofrezca deshabilitado y con el motivo, no escondido; que
 * guardar mande exactamente lo elegido; y que en un despliegue sin gateway
 * remoto la pestaña lo explique en vez de dejar guardar algo sin efecto.
 */
function ajustes(overrides: Partial<SemanticModelSettings> = {}): SemanticModelSettings {
  return {
    mode: 'cascade',
    applies: true,
    effective: {
      gateway: 'litellm',
      fastModel: 'semantic-classifier-fast',
      deepModel: 'semantic-classifier-deep',
      source: 'environment',
      version: 0,
      updatedBy: null,
      updatedAt: null,
    },
    litellm: {
      available: true,
      fastModel: 'semantic-classifier-fast',
      deepModel: 'semantic-classifier-deep',
    },
    openrouter: {
      available: true,
      fastModel: 'openai/gpt-4.1-mini',
      deepModel: 'anthropic/claude-sonnet-4.5',
    },
    ...overrides,
  };
}

const CATALOGO = {
  fetchedAt: '2026-09-04T12:00:00.000Z',
  models: [
    {
      id: 'openai/gpt-4.1-mini',
      name: 'OpenAI: GPT-4.1 Mini',
      contextLength: 1_047_576,
      promptUsdPerMillion: 0.4,
      completionUsdPerMillion: 1.6,
      recommended: true,
    },
    {
      id: 'anthropic/claude-sonnet-4.5',
      name: 'Anthropic: Claude Sonnet 4.5',
      contextLength: 1_000_000,
      promptUsdPerMillion: 3,
      completionUsdPerMillion: 15,
      recommended: true,
    },
    {
      id: 'google/gemini-2.5-flash',
      name: 'Google: Gemini 2.5 Flash',
      contextLength: 1_048_576,
      promptUsdPerMillion: 0.3,
      completionUsdPerMillion: 2.5,
      recommended: false,
    },
  ],
};

function pintar() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SemanticModelSettingsPanel active />
    </QueryClientProvider>,
  );
}

describe('configuración del modelo del worker semántico', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leer.mockResolvedValue(ajustes());
    catalogo.mockResolvedValue(CATALOGO);
  });

  it('dice qué está en uso y que lo dicta el entorno', async () => {
    pintar();

    // La píldora «En uso», no la tarjeta del gateway: las dos dicen el nombre.
    const enUso = await screen.findByText('En uso');
    expect(enUso.closest('li')).toHaveTextContent('LiteLLM (gateway propio)');
    expect(screen.getByText('Rápido').closest('li')).toHaveTextContent('semantic-classifier-fast');
    expect(screen.getByText(/Configurado por el entorno del motor/)).toBeInTheDocument();
    // Sin elección del portal no hay a qué volver.
    expect(screen.queryByRole('button', { name: /Volver al entorno/ })).not.toBeInTheDocument();
  });

  it('un gateway sin credencial se ofrece deshabilitado y con el motivo', async () => {
    leer.mockResolvedValue(
      ajustes({ openrouter: { available: false, fastModel: 'x/y', deepModel: 'x/z' } }),
    );
    pintar();

    const radio = await screen.findByRole('radio', { name: /OpenRouter/ });
    expect(radio).toBeDisabled();
    expect(screen.getByText(/falta/)).toHaveTextContent('OPENROUTER_API_KEY');
  });

  it('elegir OpenRouter y un modelo del catálogo, y guardar manda exactamente eso', async () => {
    guardar.mockResolvedValue(
      ajustes({
        effective: {
          gateway: 'openrouter',
          fastModel: 'openai/gpt-4.1-mini',
          deepModel: 'google/gemini-2.5-flash',
          source: 'portal',
          version: 1,
          updatedBy: 'ana@atlas',
          updatedAt: '2026-09-04T12:00:00.000Z',
        },
      }),
    );
    pintar();

    fireEvent.click(await screen.findByRole('radio', { name: /OpenRouter/ }));
    // Al cambiar de gateway, los modelos pasan a los que dicta el entorno para ÉSE.
    const profundo = await screen.findByLabelText(/Nivel profundo/);
    await waitFor(() => expect(profundo).toHaveValue('anthropic/claude-sonnet-4.5'));
    // El catálogo llega aparte: hasta que no está, la opción no existe y el
    // cambio no tendría a qué agarrarse.
    await screen.findAllByRole('option', { name: /gemini-2\.5-flash/ });
    fireEvent.change(profundo, { target: { value: 'google/gemini-2.5-flash' } });
    expect(profundo).toHaveValue('google/gemini-2.5-flash');

    const boton = screen.getByRole('button', { name: /^Guardar/ });
    await waitFor(() => expect(boton).toBeEnabled());
    fireEvent.click(boton);

    // React Query llama a `mutationFn(variables, contexto)`: se mira el primer
    // argumento y no la llamada entera.
    await waitFor(() => expect(guardar).toHaveBeenCalled());
    expect(guardar.mock.calls[0]?.[0]).toEqual({
      gateway: 'openrouter',
      fastModel: 'openai/gpt-4.1-mini',
      deepModel: 'google/gemini-2.5-flash',
    });
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ tone: 'success' })),
    );
  });

  it('sin cambios, Guardar está apagado: no hay nada que aplicar', async () => {
    pintar();
    const boton = await screen.findByRole('button', { name: /^Guardar/ });
    expect(boton).toBeDisabled();
  });

  it('probar enseña quién respondió, cuánto tardó y cuánto costó, y el nivel que falló', async () => {
    probar.mockResolvedValue({
      gateway: 'litellm',
      tiers: [
        {
          tier: 'FAST',
          model: 'semantic-classifier-fast',
          ok: true,
          respondedBy: 'gemini-2.0-flash',
          latencyMs: 812,
          usage: { totalTokens: 507, estimatedCost: 0.000367 },
          topCategory: 'GASTOS.SUPERMERCADO',
          confidence: 0.95,
        },
        {
          tier: 'DEEP',
          model: 'semantic-classifier-deep',
          ok: false,
          latencyMs: 30_000,
          error: 'LiteLLM respondió con HTTP 400 (model_not_found).',
        },
      ],
    });
    pintar();

    fireEvent.click(await screen.findByRole('button', { name: /Probar con una glosa/ }));

    await waitFor(() => expect(screen.getByText('gemini-2.0-flash')).toBeInTheDocument());
    expect(screen.getByText('812 ms')).toBeInTheDocument();
    expect(screen.getByText('$0.000367 · 507 tokens')).toBeInTheDocument();
    expect(screen.getByText('GASTOS.SUPERMERCADO · 95 %')).toBeInTheDocument();
    expect(screen.getByText(/model_not_found/)).toBeInTheDocument();
  });

  it('en un despliegue sin gateway remoto lo explica y no deja guardar', async () => {
    leer.mockResolvedValue(ajustes({ mode: 'transformer', applies: false }));
    pintar();

    await waitFor(() =>
      expect(screen.getByText(/no usa ningún gateway remoto/)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /^Guardar/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Probar/ })).toBeDisabled();
  });
});
