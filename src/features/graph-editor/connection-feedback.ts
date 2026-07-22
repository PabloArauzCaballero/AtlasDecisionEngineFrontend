import type { EdgeCreationError } from './graph-authoring';

export interface ConnectionNotice {
  tone: 'info' | 'success' | 'error';
  text: string;
}

const messages: Record<EdgeCreationError, string> = {
  SAME_NODE: 'El origen y el destino deben ser nodos diferentes.',
  DUPLICATE_EDGE: 'Esos nodos ya están conectados.',
  SOURCE_NOT_FOUND: 'No se encontró el nodo de origen.',
  TERMINAL_SOURCE: 'Un nodo terminal no puede tener conexiones de salida.',
  TOO_MANY_BRANCHES: 'Una condición admite como máximo dos rutas de salida.',
  SOURCE_IS_NOT_CONDITIONAL: 'Este tipo de nodo sólo admite una conexión de salida.',
  PROHIBITED_CYCLE: 'La conexión crearía un ciclo y el motor requiere un flujo acíclico.',
};

export function connectionErrorNotice(error: EdgeCreationError): ConnectionNotice {
  return { tone: 'error', text: messages[error] };
}
