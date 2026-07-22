# ATLAS Decision Engine Frontend

Portal Next.js 16 (App Router, React 19) para gobernar artefactos de decisión:
autoría de grafos, pruebas, aprobaciones, simulación y auditoría.

## Comprender la estructura: usa graphify-out primero

Antes de explorar el código a ciegas, lee el grafo de estructura generado por
`graphify` en `graphify-out/`:

- `graphify-out/GRAPH_REPORT.md` — resumen navegable: hubs por comunidad,
  abstracciones núcleo (god nodes como `display()`, `apiRequest()`,
  `useNotifications()`) y conexiones no obvias. **Empieza aquí.**
- `graphify-out/graph.json` — grafo completo (nodos/aristas) para rastrear
  dependencias exactas de un símbolo o archivo.
- `graphify-out/manifest.json` — índice por archivo.
- `graphify-out/graph.html` — visualización interactiva (para humanos).

### Frescura del grafo

`GRAPH_REPORT.md` indica el commit desde el que se construyó. Compáralo con
`git rev-parse HEAD`; si difieren o hay cambios sin commitear, considera el
grafo orientativo y verifica en el código real antes de afirmar dependencias.

### Mantenerlo actualizado

Un hook `Stop` en `.claude/settings.json` ejecuta `graphify update .` en
segundo plano al final de cada turno con cambios, así que normalmente el grafo
se mantiene al día solo. Si necesitas frescura inmediata dentro de un turno
(p. ej. tras crear varios módulos y antes de razonar sobre ellos), ejecuta
`graphify update .` manualmente (~40 s, sin costo de API).

## Reglas del repositorio (las aplica `yarn verify`)

- Máximo 299 líneas por archivo fuente (incluye CSS) — `scripts/verify-source.mjs`.
- Todo HTTP pasa por `src/api/http-client.ts`; `fetch()` directo está prohibido.
- Gate completo: `yarn verify` (format:check, lint, verify:source, typecheck,
  test, build). Córrelo antes de dar por cerrado un cambio.

## Convenciones clave

- Notificaciones: `useNotifications()` — los errores de mutaciones se reportan
  globalmente vía `MutationCache` en `src/app/QueryProvider.tsx`; las páginas
  solo añaden toasts de éxito.
- Navegación con feedback: usa `NavLink` (`src/navigation/NavLink.tsx`), no
  `next/link` directo, para alimentar la barra de progreso de rutas.
- Rutas nuevas: registra el patrón en `src/auth/route-access.ts` — las rutas
  desconocidas se deniegan por defecto.
- Editores de nodos del grafo: `src/features/graph-editor/NodeProperties.tsx`
  despacha un editor dedicado por tipo de nodo; los nodos de código comparten
  el contrato `config.script = { language, source }` y `script-lint.ts`.
