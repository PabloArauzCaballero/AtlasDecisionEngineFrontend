'use client';

/**
 * La vía de escape a la caché de ejecuciones del motor.
 *
 * Reenviar la misma entrada devuelve la ejecución que ya existe, y por omisión
 * eso es lo correcto: repetir un trabajo idéntico gasta lectura, comparación
 * biométrica o llamadas al proveedor sin cambiar el desenlace. El motor
 * recalcula solo cuando cambia algo que PUEDE cambiarlo —la calibración, el
 * catálogo de reglas, la versión del canal de lectura—.
 *
 * Pero cuando eso no basta, sin esta casilla no había forma de pedir una
 * ejecución nueva desde la pantalla, y un resultado guardado se lee exactamente
 * igual que un arreglo que no funcionó. Pasó: se corrigió el lector de
 * documentos, la misma cédula siguió devolviendo el veredicto viejo, y lo
 * razonable era concluir que la corrección no servía.
 */
export function ForceFreshRun({
  checked,
  onChange,
  label,
  help,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  help: string;
}) {
  return (
    <label className="worker-force-fresh">
      <input
        type="checkbox"
        checked={checked}
        onChange={(evento) => onChange(evento.target.checked)}
      />
      <span>
        {label}
        <small className="field-help">{help}</small>
      </span>
    </label>
  );
}
