import { z } from 'zod';

/**
 * Espejo de lo que publica el generador documental del motor (`/pdf/*`).
 *
 * No es autoritativo —el motor revalida siempre—, pero sí es lo que decide qué
 * puede pintar esta vista. Se declara laxo a propósito: `passthrough` en las
 * respuestas y campos nuevos ignorados, porque un despliegue del motor por
 * delante del portal es lo normal y un campo añadido allí no puede dejar la
 * pantalla en blanco aquí.
 *
 * Lo que SÍ se exige estricto es lo que la vista usa para decidir: sin `fields`
 * no se puede construir el formulario, y sin `status` no se puede decir si el
 * generador está sano.
 */

/** Descriptor de un campo, tal y como lo publica `GET /pdf/templates/:id/schema`. */
export interface TemplateFieldDescriptor {
  type: string;
  required: boolean;
  description?: string;
  values?: readonly string[];
  items?: TemplateFieldDescriptor;
  fields?: Readonly<Record<string, TemplateFieldDescriptor>>;
}

/**
 * El tercer parámetro es `unknown` —el tipo de ENTRADA— y no se puede omitir.
 *
 * `z.ZodType<T>` fija entrada y salida al mismo tipo, y aquí no coinciden:
 * `required` lleva `.default(false)`, así que a la entrada es opcional y a la
 * salida siempre está. Sin esto TypeScript rechaza la anotación, que es
 * obligatoria porque el esquema se referencia a sí mismo y no puede inferirse.
 */
const fieldDescriptorSchema: z.ZodType<TemplateFieldDescriptor, z.ZodTypeDef, unknown> = z.lazy(
  () =>
    z.object({
      type: z.string(),
      required: z.boolean().default(false),
      description: z.string().optional(),
      values: z.array(z.string()).optional(),
      items: fieldDescriptorSchema.optional(),
      fields: z.record(fieldDescriptorSchema).optional(),
    }),
);

export const templateSummarySchema = z
  .object({
    id: z.string(),
    version: z.string(),
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()).default([]),
    classification: z.string().optional(),
    requiredFields: z.array(z.string()).default([]),
    deprecated: z
      .object({
        since: z.string(),
        reason: z.string(),
        replacedBy: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const templateListSchema = z.object({
  templates: z.array(templateSummarySchema),
});

export const templateSchemaResultSchema = z
  .object({
    templateId: z.string(),
    version: z.string(),
    title: z.string(),
    description: z.string(),
    fields: z.record(fieldDescriptorSchema),
    example: z.unknown(),
  })
  .passthrough();

/**
 * Informe de salud del generador.
 *
 * `status` es `ok` o `degraded`; el motor responde 200 en los dos casos a
 * propósito, porque el veredicto está en el cuerpo y un 503 escondería justo lo
 * que se viene a leer. La vista tiene que distinguirlos, no el código HTTP.
 */
export const pdfHealthSchema = z
  .object({
    status: z.enum(['ok', 'degraded']),
    renderer: z.string(),
    templateEngine: z.string(),
    checks: z.array(
      z
        .object({
          name: z.string(),
          ok: z.boolean(),
          detail: z.string().optional(),
        })
        .passthrough(),
    ),
    timestamp: z.string(),
  })
  .passthrough();

/** Ficha del documento generado. Sin el búfer: ése viaja como archivo. */
export const generatedDocumentSchema = z
  .object({
    documentId: z.string(),
    template: z.object({ id: z.string(), version: z.string() }),
    filename: z.string(),
    sizeBytes: z.number(),
    checksum: z.string(),
    createdAt: z.string(),
    status: z.string(),
  })
  .passthrough();

export const payloadIssueSchema = z
  .object({
    field: z.string(),
    problem: z.string(),
    expected: z.string().optional(),
    received: z.string().optional(),
  })
  .passthrough();

export const validationResultSchema = z
  .object({
    valid: z.boolean(),
    templateId: z.string(),
    version: z.string(),
    issues: z.array(payloadIssueSchema).default([]),
  })
  .passthrough();

export type TemplateSummary = z.infer<typeof templateSummarySchema>;
export type TemplateSchemaResult = z.infer<typeof templateSchemaResultSchema>;
export type PdfHealthReport = z.infer<typeof pdfHealthSchema>;
export type GeneratedDocument = z.infer<typeof generatedDocumentSchema>;
export type PayloadIssue = z.infer<typeof payloadIssueSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Casar un documento con un artefacto, a nivel de datos.
//
// La pregunta que responden estos contratos es la del negocio: lo que el
// artefacto RESPONDE, ¿lo acepta este documento? Y su recíproca, que es la que
// se olvida: que sobren campos del artefacto no es un problema, porque un
// artefacto alimenta varios documentos y cada uno cuenta una parte.
// ─────────────────────────────────────────────────────────────────────────────

export const bindableArtifactSchema = z
  .object({
    artifactId: z.string(),
    artifactVersion: z.string(),
    title: z.string(),
    outputFieldCount: z.number(),
  })
  .passthrough();

export const artifactListSchema = z.object({ artifacts: z.array(bindableArtifactSchema) });

export const compatibilityFindingSchema = z
  .object({
    field: z.string(),
    severity: z.enum(['error', 'warning']),
    problem: z.string(),
    expected: z.string().optional(),
    found: z.string().optional(),
  })
  .passthrough();

export const compatibilityReportSchema = z
  .object({
    compatible: z.boolean(),
    templateId: z.string(),
    templateVersion: z.string(),
    artifactId: z.string(),
    artifactVersion: z.string(),
    matched: z.array(z.string()).default([]),
    /** Campos del artefacto que este documento no usa. Se informan, no se corrigen. */
    unusedByTemplate: z.array(z.string()).default([]),
    findings: z.array(compatibilityFindingSchema).default([]),
  })
  .passthrough();

export const artifactSampleSchema = z
  .object({
    templateId: z.string(),
    artifactId: z.string(),
    artifactVersion: z.string(),
    payload: z.record(z.unknown()),
    /** Campos obligatorios que el artefacto NO pudo rellenar. No se inventan. */
    missing: z.array(z.string()).default([]),
    compatibility: compatibilityReportSchema,
  })
  .passthrough();

export type BindableArtifact = z.infer<typeof bindableArtifactSchema>;
export type CompatibilityFinding = z.infer<typeof compatibilityFindingSchema>;
export type CompatibilityReport = z.infer<typeof compatibilityReportSchema>;
export type ArtifactSample = z.infer<typeof artifactSampleSchema>;
