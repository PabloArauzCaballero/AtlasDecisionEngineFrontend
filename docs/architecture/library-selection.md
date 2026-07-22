# Selección de librerías — Migración a Next.js

## Criterio

La migración conserva dependencias existentes cuando cumplen su responsabilidad y añade únicamente capacidades necesarias para App Router, validación runtime y pruebas verificables.

| Responsabilidad         | Decisión                   | Versión evaluada | Motivo                                                              | Alternativa de salida                                                    |
| ----------------------- | -------------------------- | ---------------: | ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Framework web           | Next.js App Router         |           16.2.1 | Routing por filesystem, layouts, boundaries y salida standalone     | Volver al tag Vite de línea base durante la migración                    |
| Runtime UI              | React                      |           19.2.7 | Versión estable compatible con Next y con correcciones de seguridad | Actualizar dentro de la rama estable 19.2 mediante verificación completa |
| Gestor de paquetes      | Yarn Classic               |          1.22.22 | El repositorio ya contiene `yarn.lock`; evita mezclar gestores      | Migración separada con ADR y lockfile nuevo                              |
| Estado servidor cliente | TanStack Query             |           5.83.x | Ya cubre caché, refetch, mutaciones y cancelación                   | Server Components para lecturas seguras no interactivas                  |
| Validación runtime      | Zod                        |           3.25.x | Valida configuración y respuestas externas antes de usarlas         | Valibot u otro schema library mediante ADR                               |
| Iconografía             | Lucide React               |          0.468.x | Ya forma parte del sistema visual Stitch                            | SVG internos si el paquete deja de mantenerse                            |
| TypeScript              | TypeScript                 |            5.8.x | Tipado estricto y soporte del stack seleccionado                    | Actualización controlada después de revisar compatibilidad               |
| Unit testing            | Vitest + Testing Library   |   3.2.x / 16.3.x | Preserva pruebas existentes y permite probar componentes            | Jest solo si una incompatibilidad real lo exige                          |
| Formato                 | Prettier                   |            3.6.x | Ya configurado y usado como gate                                    | Formateador alternativo mediante decisión de equipo                      |
| Lint                    | ESLint + typescript-eslint |        9.x / 8.x | Ya configurado; se adapta a App Router                              | Configuración oficial Next cuando sea compatible con la matriz existente |

## Decisiones diferidas

No se instalarán todavía:

- Otra librería de estado global.
- Otra librería HTTP.
- Una librería de animación.
- TanStack Table.
- React Hook Form.
- shadcn/ui o Radix de forma masiva.

Estas capacidades se incorporarán únicamente cuando una vista concreta demuestre la necesidad y exista una prueba de paridad que evite una reescritura visual innecesaria.

## Seguridad y bundle

- Los secretos no usan prefijo `NEXT_PUBLIC_*`.
- El navegador solo conoce rutas de mismo origen.
- Zod se usa en límites de confianza, no para duplicar validaciones internas triviales.
- El proxy del servidor resuelve `DECISION_ENGINE_URL` en cada solicitud; la dirección interna no se serializa en el bundle.
