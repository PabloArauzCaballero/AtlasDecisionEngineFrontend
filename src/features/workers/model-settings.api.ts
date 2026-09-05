import { apiRequest } from '../../api/http-client';

/**
 * Qué gateway y qué modelos atienden el escalón remoto del worker semántico.
 *
 * Es configuración del DESPLIEGUE, no del tenant: el motor tiene un proveedor
 * construido, un lease y una caché de veredictos, y los tres cambian a la vez
 * cuando alguien guarda aquí. El cambio surte efecto en la siguiente glosa (el
 * worker sondea la fila cada pocos segundos), sin desplegar nada.
 *
 * Ninguna credencial pasa por aquí: el motor sólo dice si TIENE la de cada
 * gateway, nunca cuál es.
 */

export type ModelGateway = 'litellm' | 'openrouter';

export const GATEWAY_LABELS: Record<ModelGateway, string> = {
  litellm: 'LiteLLM (gateway propio)',
  openrouter: 'OpenRouter',
};

export interface GatewayEnvironment {
  /** Sin credencial en el motor no se puede elegir: arrancaría y fallaría en cada glosa. */
  available: boolean;
  fastModel: string;
  deepModel: string;
}

export interface EffectiveModelSettings {
  gateway: ModelGateway;
  fastModel: string;
  deepModel: string;
  /** `environment` cuando manda el entorno; `portal` cuando alguien lo eligió aquí. */
  source: 'environment' | 'portal';
  version: number;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface SemanticModelSettings {
  /** `SEMANTIC_ANALYSIS_PROVIDER` del despliegue: transformer, cascade, litellm, openrouter, openai. */
  mode: string;
  /** Si la elección de gateway tiene efecto en este despliegue. */
  applies: boolean;
  effective: EffectiveModelSettings;
  litellm: GatewayEnvironment;
  openrouter: GatewayEnvironment;
}

export interface ModelSettingsInput {
  gateway: ModelGateway;
  fastModel: string;
  deepModel: string;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  contextLength: number;
  promptUsdPerMillion: number;
  completionUsdPerMillion: number;
  recommended: boolean;
}

export interface OpenRouterCatalog {
  models: OpenRouterModel[];
  fetchedAt: string;
}

export interface ModelProbeTier {
  tier: 'FAST' | 'DEEP';
  model: string;
  ok: boolean;
  respondedBy?: string;
  latencyMs?: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    estimatedCost?: number;
  };
  topCategory?: string;
  confidence?: number;
  error?: string;
}

export interface ModelProbe {
  gateway: ModelGateway;
  tiers: ModelProbeTier[];
}

const RUTA = '/v1/workers/semantic-analysis/model-settings';

export function fetchModelSettings(signal?: AbortSignal): Promise<SemanticModelSettings> {
  return apiRequest<SemanticModelSettings>(RUTA, { signal });
}

export function saveModelSettings(input: ModelSettingsInput): Promise<SemanticModelSettings> {
  return apiRequest<SemanticModelSettings>(RUTA, { method: 'PUT', body: input });
}

/** Quita la elección del portal: vuelve a mandar el entorno. */
export function resetModelSettings(): Promise<SemanticModelSettings> {
  return apiRequest<SemanticModelSettings>(RUTA, { method: 'DELETE' });
}

/**
 * Sólo los modelos que sostienen salida estructurada: el motor filtra los demás
 * porque con ellos cada glosa acabaría en revisión humana.
 */
export function fetchOpenRouterCatalog(signal?: AbortSignal): Promise<OpenRouterCatalog> {
  return apiRequest<OpenRouterCatalog>(`${RUTA}/catalog`, { signal });
}

/**
 * Clasifica una glosa de prueba con la configuración candidata, sin guardarla.
 * Cuesta lo que cuestan dos glosas; a cambio se ve latencia, coste y quién
 * respondió ANTES de que la elección alcance a la cola.
 */
export function probeModelSettings(input: ModelSettingsInput): Promise<ModelProbe> {
  return apiRequest<ModelProbe>(`${RUTA}/test`, { method: 'POST', body: input });
}
