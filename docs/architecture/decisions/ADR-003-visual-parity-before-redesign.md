# ADR-003 — Paridad visual y funcional antes de rediseñar

- Estado: Aceptada
- Fecha: 2026-07-16

## Contexto

El frontend dispone de 25 vistas Stitch aprobadas y una implementación React/Vite que ya reproduce su estructura general. El alcance solicitado es migrar a Next.js y corregir errores, no reemplazar la experiencia por un nuevo diseño.

Una migración que modifique al mismo tiempo framework, navegación, sesión y diseño dificultaría identificar la causa de las regresiones.

## Decisión

La migración se ejecutará con estrategia de paridad primero:

1. Preservar composición, densidad, jerarquía, copy y acciones existentes.
2. Migrar rutas, layouts, providers, sesión y red sin rediseñar.
3. Añadir únicamente estados ausentes de carga, error, vacío, permiso y conflicto.
4. Corregir accesibilidad y responsive sin alterar el flujo de negocio.
5. Comparar cada ruta con su captura Stitch.
6. Aplazar cambios estéticos opcionales hasta completar la paridad y las pruebas.

## Cambios permitidos durante la migración

- Foco visible.
- Labels y atributos accesibles.
- Skeletons y feedback de mutación.
- Corrección de contraste insuficiente.
- Ajustes responsive.
- Eliminación de saltos de layout.
- División interna de componentes y CSS.
- Correcciones de copy evidentes que no cambien el significado.

## Cambios que requieren aprobación separada

- Nueva paleta.
- Cambio de navegación o agrupación por fases.
- Sustitución de tablas por tarjetas.
- Eliminación o combinación de vistas.
- Cambio de términos del dominio.
- Nuevos pasos de flujo.
- Cambios de permisos o acciones disponibles.

## Consecuencias

### Positivas

- Reduce el riesgo de regresión.
- Permite comparar Vite y Next ruta por ruta.
- Mantiene reconocibilidad para usuarios actuales.
- Separa deuda técnica de decisiones de producto.

### Negativas

- Algunas decisiones visuales heredadas se conservarán temporalmente.
- El design system se formalizará de forma progresiva.
- La migración puede requerir adaptadores temporales.

## Verificación

La decisión se verifica mediante:

- `docs/ui/ui-ux-source-traceability.md`.
- `docs/ui/stitch-view-parity-matrix.md`.
- Capturas Playwright.
- Auditoría de accesibilidad.
- Pruebas de rutas, auth y mutaciones.
