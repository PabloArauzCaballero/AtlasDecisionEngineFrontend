/** La fecha de una conversación en español de persona: «hace 5 min», «ayer», «12 sep». */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return date.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' }).replace('.', '');
}

/** Cada turno son dos mensajes: la pregunta y la respuesta. */
export function countMessages(turnCount: number): string {
  const total = turnCount * 2;
  return total === 1 ? '1 mensaje' : `${total} mensajes`;
}
