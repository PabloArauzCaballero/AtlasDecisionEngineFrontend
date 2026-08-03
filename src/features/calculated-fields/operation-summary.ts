import type { OperationArg, OperationNode } from './calculated-field.types';

/**
 * Texto legible del árbol del constructor visual (§6.1), p. ej.
 * `divide(deuda_mensual, ingreso_mensual)`. No depende del catálogo de
 * operaciones del backend: usa el `operation`/`input` tal cual, que ya son
 * códigos descriptivos, para poder mostrarse sin una petición adicional.
 */
export function summarizeOperation(node: OperationNode): string {
  const args = node.args.map(summarizeArg).join(', ');
  return `${node.operation}(${args})`;
}

function summarizeArg(arg: OperationArg): string {
  if ('literal' in arg) return JSON.stringify(arg.literal);
  if ('input' in arg) return arg.input;
  return summarizeOperation(arg);
}
