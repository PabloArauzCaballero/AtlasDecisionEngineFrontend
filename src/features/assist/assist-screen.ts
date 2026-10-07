import { navigation, type NavigationItem } from '../../navigation/navigation';

/**
 * En qué sección está la persona, dicho con el nombre que ve en el menú («Gobierno › Despliegues»).
 *
 * Se deriva del propio menú y no de un mapa aparte: una entrada nueva del menú aparece aquí sola, y
 * una renombrada no deja al asistente hablando de una sección que ya no existe.
 */

/** Rutas de detalle que no tienen entrada propia en el menú: se nombran por la sección que las abre. */
const DETAIL_ROUTES: readonly { prefix: string; label: string }[] = [
  { prefix: '/artifact-versions', label: 'Diseño › Versión de artefacto' },
  { prefix: '/approval-requests', label: 'Gobierno › Solicitud de aprobación' },
  { prefix: '/security-review', label: 'Gobierno › Revisión de seguridad' },
  { prefix: '/test-runs', label: 'Calidad › Corrida de prueba' },
];

/** El formato que acepta Core: letras, números, espacios y `›/·_-().,`, de 1 a 80. */
const NOT_ALLOWED = /[^\p{L}\p{N} ›/·_\-().,]/gu;
const MAX_LENGTH = 80;

function matches(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

function flatten(items: readonly NavigationItem[], trail: string[]): [string, string[]][] {
  return items.flatMap((item) => {
    // Un grupo de pantallas hermanas («Catálogos», «Pruebas») es un estante del menú, no un sitio:
    // toma prestada la ruta de su primera pantalla y no entra en el nombre. La persona está en
    // «Diseño › Variables», igual que antes de agruparlas.
    const shelf = (item.children ?? []).some((child) => child.path === item.path);
    if (shelf) return flatten(item.children ?? [], trail);
    return [
      [item.path, [...trail, item.label]] as [string, string[]],
      ...flatten(item.children ?? [], [...trail, item.label]),
    ];
  });
}

const MENU_ROUTES = navigation.flatMap((section) => flatten(section.items, [section.label]));

export function sanitizeScreen(label: string): string | undefined {
  const clean = label.replace(NOT_ALLOWED, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_LENGTH);
  return clean.trim() || undefined;
}

export function assistScreenFor(pathname: string): string | undefined {
  const detail = DETAIL_ROUTES.find((route) => matches(pathname, route.prefix));
  if (detail) return sanitizeScreen(detail.label);

  // La coincidencia más larga gana: `/workers/audio-tts` es «Locución», no «Workers».
  let best: [string, string[]] | undefined;
  for (const entry of MENU_ROUTES) {
    if (matches(pathname, entry[0]) && (!best || entry[0].length > best[0].length)) best = entry;
  }
  return best ? sanitizeScreen(best[1].join(' › ')) : undefined;
}
