import { BookCheck } from 'lucide-react';
import { NavLink } from '../../navigation/NavLink';
import type { InventoryCheck } from './useInventoryCheck';

/**
 * Estado de la comprobación contra los catálogos gobernados, en una línea.
 *
 * Se dice también cuando NO se pudo comprobar: callarlo dejaría creer que el
 * contrato pasó la revisión cuando en realidad nadie la hizo.
 */
export function InventoryCheckNote({ check }: { check: InventoryCheck }) {
  if (!check.declared) return null;
  return (
    <p className="muted-text">
      <BookCheck size={13} aria-hidden="true" /> {summary(check)}{' '}
      {check.missing ? (
        <NavLink href="/variables" showSpinner={false}>
          Declararlas en el catálogo
        </NavLink>
      ) : null}
    </p>
  );
}

function summary(check: InventoryCheck): string {
  if (check.isLoading) return 'Comprobando el contrato contra el inventario…';
  if (check.isError) {
    return 'No se pudo consultar el inventario; el motor lo revalidará al guardar.';
  }
  if (check.missing) {
    return `${check.missing} de ${check.declared} variables del contrato no existen en el inventario.`;
  }
  return `Las ${check.declared} variables del contrato existen en el inventario.`;
}
