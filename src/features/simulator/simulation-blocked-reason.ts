/**
 * Por qué «Ejecutar simulación» está apagado: un botón apagado dice qué falta, en el orden en
 * que la persona lo resolvería. `undefined` cuando no falta nada.
 */
export function simulationBlockedReason(state: {
  artifactCode: string;
  environments: number;
  deployedHere: boolean;
}): string | undefined {
  if (!state.artifactCode) return 'Elige primero un algoritmo.';
  if (!state.environments) return 'No hay un ambiente de pruebas disponible para simular.';
  if (!state.deployedHere) {
    return 'Este algoritmo no está desplegado en el ambiente elegido; elige otro ambiente.';
  }
  return undefined;
}
