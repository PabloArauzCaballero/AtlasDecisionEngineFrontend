/**
 * Rol entrada→salida de cada tipo de nodo, en lenguaje llano.
 *
 * Vive aparte del panel de propiedades porque es copia de producto, no lógica de
 * formulario: se revisa con otro criterio y se reutiliza desde el lienzo.
 */
export function dataFlowHint(type: string): string {
  switch (type) {
    case 'START':
      return 'Entrada: recibe las variables de entrada de la decisión. No produce salida.';
    case 'CONDITION':
      return 'Entrada: lee variables para decidir el camino. Salida: la rama (sí / no) según su regla.';
    case 'SWITCH':
      return 'Entrada: lee una variable. Salida: la rama del caso que coincide.';
    case 'EXPRESSION':
    case 'SCORE':
      return 'Entrada: variables que usa el cálculo. Salida: la variable destino que escribe.';
    case 'RESULT':
      return 'Entrada: variables del flujo. Salida: las variables de resultado (lo que devuelve la decisión).';
    case 'MANUAL_REVIEW':
      return 'Entrada: el caso y su evidencia. Salida: deriva a una persona (no decide automáticamente).';
    case 'END':
      return 'Cierra el flujo sin producir un resultado.';
    default:
      return 'Configura las entradas que lee y las salidas que escribe este paso.';
  }
}
