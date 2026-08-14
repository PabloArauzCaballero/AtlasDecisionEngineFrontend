import { display, type UnknownRecord } from '../../utils/records';

/**
 * El formulario de pruebas guarda texto; el motor exige el tipo declarado.
 *
 * Vive aparte del panel porque lo usan los dos sentidos —lo que se teclea y lo que llega
 * generado— y porque es lo único de esa pantalla que se puede probar sin montar React.
 */
export function parseInputValues(
  inputs: UnknownRecord[],
  values: Record<string, string>,
): Record<string, unknown> {
  const parsed: Record<string, unknown> = {};
  for (const input of inputs) {
    const id = display(input, 'id');
    const raw = values[id];
    if (raw === undefined || raw === '') continue;
    const type = display(input, 'dataType');
    if (['INTEGER', 'DECIMAL', 'PERCENTAGE', 'CURRENCY'].includes(type)) {
      parsed[id] = Number(raw);
    } else if (type === 'BOOLEAN') {
      parsed[id] = raw === 'true';
    } else if (type === 'LIST' || type === 'OBJECT') {
      try {
        parsed[id] = JSON.parse(raw);
      } catch {
        parsed[id] = raw;
      }
    } else {
      parsed[id] = raw;
    }
  }
  return parsed;
}

/**
 * Un caso generado, escrito en las casillas del formulario.
 *
 * Dos cuidados que parecen detalles y no lo son. Los textos se copian tal cual: pasarlos
 * por `JSON.stringify` les pondría comillas que después viajarían dentro del valor. Y un
 * valor ausente deja la casilla VACÍA, no la palabra «null»: un caso generado para una
 * entrada opcional trae `null`, y escribirlo como texto convertía «no mandes nada» en
 * mandar la cadena `null`, que para un decimal llega al motor como `NaN`.
 */
export function stringifyInput(input: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      if (value === null || value === undefined) return [key, ''];
      return [key, typeof value === 'string' ? value : JSON.stringify(value)];
    }),
  );
}
