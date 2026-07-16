# QA visual contra las vistas Stitch

Se revisaron las 25 capturas suministradas. Las referencias originales están preservadas en `docs/stitch-reference/<vista>/screen.png` para que la comparación permanezca junto al código.

## Sistema visual conservado

- Navegación lateral fija, clara y agrupada por fase.
- Barra superior compacta con búsqueda, ambiente, acciones y usuario.
- Fondo gris muy claro, paneles blancos, bordes finos y baja elevación.
- Tipografía corporativa compacta, identificadores y hashes en monoespaciado.
- Negro para acciones principales y turquesa para navegación/estado activo.
- Tablas densas con filtros, estados, paginación y acciones por fila.
- Layouts especializados para grafo, wizard, simulador, gobierno, ejecución y trazabilidad.
- Adaptación responsiva: navegación tipo drawer y columnas apiladas en pantallas pequeñas.

## Cobertura por fase

| Fase      | Referencias | Implementación                                     |
| --------- | ----------: | -------------------------------------------------- |
| F0        |           2 | Login corporativo y Platform Health                |
| F1        |           2 | Variables y Reason Codes                           |
| F2        |           4 | Inventario, detalle, editor de grafo y compilación |
| F3        |           4 | Suites, casos, ejecución y cobertura               |
| F4        |           4 | Revisiones, solicitud, ambientes y despliegues     |
| F5        |           3 | Simulador, cola manual y detalle del caso          |
| F6        |           3 | Ejecuciones, detalle y auditoría                   |
| F7        |           3 | Objetivos, detalle y matriz de cobertura           |
| **Total** |      **25** | **25 rutas funcionales**                           |

## Criterios técnicos

- Las rutas están protegidas salvo `/login`.
- Las páginas de ruta usan carga diferida.
- El estado remoto se gestiona con React Query.
- El editor de grafo está separado en `NodeLibrary`, `GraphCanvas` y `NodeProperties`.
- Los elementos comunes se componen mediante `Panel`, `PageHeader`, `DataTable`, `StatusBadge`, `MetricCard`, `DefinitionGrid`, `ProgressBar` y `Timeline`.
- Ningún componente de la aplicación supera 140 líneas; la configuración declarativa está separada del renderizado.
