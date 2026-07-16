# Trazabilidad UI/UX — Migración a Next.js

## Objetivo

Preservar la identidad visual y el comportamiento operativo de las 25 vistas Stitch durante la migración desde Vite/React Router hacia Next.js App Router.

La migración no autoriza un rediseño. Cualquier ajuste visual debe resolver accesibilidad, feedback, responsive o consistencia sin cambiar arbitrariamente la composición aprobada.

## Fuentes revisadas

1. `docs/STITCH_VISUAL_QA.md`.
2. Las 25 capturas ubicadas en `docs/stitch-reference/*/screen.png`.
3. `VIEW_INVENTORY.md`.
4. Componentes, layouts, páginas y estilos existentes.
5. Prompt frontend de producción 10/10.
6. Principios Lean UX aplicables a una migración con solución visual ya aprobada.

## Reglas verificables

| Regla UI/UX | Vista o componente afectado | Decisión de migración | Criterio de aceptación |
|---|---|---|---|
| Conservar navegación lateral agrupada por fase | `Sidebar`, `AppShell` | Convertir el shell en layout de `(portal)` sin cambiar agrupación ni jerarquía | Las mismas secciones, títulos, rutas e indicador activo permanecen visibles |
| Conservar barra superior compacta | `Topbar` | Mantener búsqueda, ambiente, acciones y usuario como isla cliente mínima | No cambia la altura visual ni se pierden acciones existentes |
| Mantener fondo gris claro y paneles blancos | Layout y `Panel` | Migrar tokens visuales antes de dividir CSS | Comparación visual sin cambios críticos en fondo, borde, radio y elevación |
| Mantener densidad operativa de tablas | `DataTable` y páginas de inventario | No convertir tablas densas en tarjetas como patrón principal | Columnas, filtros, paginación y acciones siguen accesibles |
| Mantener identificadores y hashes monoespaciados | `DefinitionGrid`, tablas y detalles | Conservar clase/tokens mono | IDs, checksums y códigos siguen diferenciándose visualmente |
| Mantener negro como acción principal y turquesa como estado activo | Botones, navegación y estados | Documentar tokens y reutilizarlos | No aparecen colores arbitrarios para acciones equivalentes |
| No aparentar congelamiento | Todas las rutas y mutaciones | Añadir `loading.tsx`, skeletons y estados pendientes específicos | Toda navegación o mutación superior a percepción inmediata muestra feedback |
| Mostrar error real y acción de recuperación | Rutas, consultas y formularios | Usar boundaries y alertas por contexto | El usuario distingue error, vacío, permiso y sesión vencida |
| No ocultar permisos insuficientes | Navegación y acciones protegidas | Representar `403` y deshabilitar/ocultar según contrato | El backend continúa siendo autoridad y la UI no simula autorización |
| Preservar layouts especializados | Grafo, wizard, simulador, gobierno y trazabilidad | Migrar cada layout como feature, no mediante página CRUD genérica | Cada flujo conserva su composición y controles especializados |
| Responsive sin degradar operación | Shell, tablas y detalles | Drawer lateral y apilado controlado; scroll horizontal solo donde sea necesario | 360 px, 768 px y escritorio son operables sin pérdida de acciones |
| Accesibilidad de teclado | Navegación, formularios, grafo y dialogs | Conservar foco visible y orden lógico; usar primitivas accesibles | Flujos principales pueden recorrerse sin mouse |
| Respetar `prefers-reduced-motion` | Feedback y transiciones | Solo microinteracciones útiles | Animaciones no bloquean ni provocan movimiento innecesario |
| Evitar CLS | Iconos, imágenes y skeletons | Reservar dimensiones | El contenido no salta al cargar |
| Evitar overfetch | Pickers, filtros y listados | Consumir endpoints proyectados cuando existan | No descargar entidades completas para mostrar pocos campos |
| Mantener idioma y términos de dominio aprobados | Todas las vistas | No traducir masivamente durante la migración | Los textos existentes permanecen salvo corrección documentada |

## Estados obligatorios por vista

Cada ruta debe contemplar, según corresponda:

- Carga inicial.
- Recarga silenciosa.
- Estado vacío.
- Error de red.
- Timeout.
- Error de contrato.
- No autenticado.
- Sin permisos.
- Mutación pendiente.
- Mutación exitosa.
- Conflicto o validación.

## Hipótesis de migración

**Hipótesis:** migrar primero estructura, rutas y contratos, reutilizando componentes visuales existentes como Client Components pequeños, reducirá regresiones frente a reescribir las 25 vistas.

La hipótesis se considera soportada cuando:

- Las 25 rutas mantienen paridad visual y funcional.
- No existen errores de hidratación.
- Login, refresh, logout y redirecciones mantienen su comportamiento.
- Las capturas comparativas no muestran regresiones críticas.
- Build, pruebas y auditorías automatizadas pasan.

## Restricciones

- No reemplazar vistas especializadas por CRUD genérico.
- No introducir datos estáticos para ocultar endpoints faltantes.
- No convertir todo el portal en Client Component.
- No exponer refresh token ni secretos mediante `NEXT_PUBLIC_*`.
- No eliminar rutas antiguas sin redirección y verificación de enlaces.
