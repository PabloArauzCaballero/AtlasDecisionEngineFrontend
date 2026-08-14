import type { Page } from '@playwright/test';

/**
 * Motor simulado del generador documental (`/pdf/*`).
 *
 * Se instala ADEMÁS del de workers, no en su lugar: el generador convive en la
 * misma pantalla que los cuatro workers pero no comparte ni catálogo ni
 * métricas, así que sus rutas son otras y su simulado también.
 *
 * Devuelve un contrato con los tipos que de verdad cambian de control —texto,
 * número, enum, booleano y una lista— porque el formulario se construye a partir
 * de esta respuesta: un simulado con tres cadenas dejaría sin ejercitar
 * justamente la parte que puede romperse.
 */

const HEALTH = {
  status: 'ok',
  renderer: 'playwright-chromium',
  templateEngine: 'handlebars',
  checks: [
    { name: 'renderer', ok: true, detail: '149.0.7827.55 · 0/4 carriles' },
    { name: 'templates', ok: true, detail: '3 pareja(s) id@versión registradas' },
    { name: 'brand', ok: true, detail: 'atlas · sin logotipo' },
    {
      name: 'fonts',
      ok: false,
      detail: 'ninguna fuente embebida; se depende de la pila de respaldo del sistema',
    },
    { name: 'storage', ok: true, detail: 'desactivado (PDF_STORAGE_ENABLED=false)' },
  ],
  timestamp: '2026-08-11T18:24:04.000Z',
};

const TEMPLATES = {
  templates: [
    {
      id: 'generic-result-report',
      version: '1.0.0',
      title: 'Informe de resultado',
      description:
        'Documento genérico para publicar el resultado de cualquier algoritmo: cifras destacadas, avisos, secciones con campos y tablas.',
      tags: ['generico', 'resultado'],
      classification: 'INTERNAL',
      requiredFields: ['title', 'sections'],
    },
    {
      id: 'credit-analysis-report',
      version: '1.1.0',
      title: 'Informe de análisis crediticio',
      description: 'Veredicto del motor sobre una solicitud de crédito.',
      tags: ['credito', 'riesgo'],
      classification: 'CONFIDENTIAL',
      requiredFields: ['customerName', 'score', 'decision'],
    },
  ],
};

const SCHEMA = {
  templateId: 'generic-result-report',
  version: '1.0.0',
  title: 'Informe de resultado',
  description: 'Documento genérico para publicar el resultado de cualquier algoritmo.',
  fields: {
    title: { type: 'string', required: true, description: 'Título del informe' },
    subtitle: { type: 'string', required: false, description: 'Subtítulo o contexto breve' },
    score: { type: 'number', required: false, description: 'Puntaje del modelo' },
    decision: {
      type: 'enum',
      required: true,
      values: ['APPROVED', 'REJECTED', 'REVIEW'],
      description: 'Veredicto',
    },
    revisado: { type: 'boolean', required: false },
    sections: {
      type: 'array',
      required: true,
      maxItems: 60,
      items: { type: 'object', required: true },
    },
  },
  example: {
    title: 'Resultado del análisis',
    decision: 'REVIEW',
    sections: [{ title: 'Identificación' }],
  },
};

/** Un PDF mínimo pero VÁLIDO: empieza por la firma, que es lo que el portal comprueba. */
const PDF_BYTES = Buffer.from(
  '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n',
  'latin1',
);

/**
 * Un artefacto cuyo contrato de salida NO cubre todo lo que el documento exige.
 *
 * Es el caso que importa: uno compatible sólo demuestra que la pantalla pinta
 * verde. Aquí falta `decision` —obligatorio— y sobra `debtRatio`, que es lo que
 * permite comprobar las dos mitades de la regla a la vez.
 */
const ARTIFACTS = {
  artifacts: [
    {
      artifactId: 'riesgo-credito',
      artifactVersion: '2.1.0',
      title: 'Evaluación de riesgo crediticio',
      outputFieldCount: 3,
    },
    {
      artifactId: 'informe-generico',
      artifactVersion: '1.0.0',
      title: 'Generador de informes',
      outputFieldCount: 4,
    },
  ],
};

/** El que SÍ encaja: es el único que debe llegar al desplegable. */
const COMPATIBLE = {
  compatible: true,
  templateId: 'generic-result-report',
  templateVersion: '1.0.0',
  artifactId: 'informe-generico',
  artifactVersion: '1.0.0',
  matched: ['title', 'sections', 'decision'],
  unusedByTemplate: ['interno'],
  findings: [],
};

const COMPATIBILITY = {
  compatible: false,
  templateId: 'generic-result-report',
  templateVersion: '1.0.0',
  artifactId: 'riesgo-credito',
  artifactVersion: '2.1.0',
  matched: ['title', 'score'],
  unusedByTemplate: ['debtRatio'],
  findings: [
    {
      field: 'decision',
      severity: 'error',
      problem: 'el artefacto no publica este campo y el documento lo exige',
      expected: 'enum',
    },
  ],
};

export async function mockPdfBackend(page: Page): Promise<void> {
  await page.route('**/pdf/**', (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/pdf/health')) return route.fulfill({ json: HEALTH });
    if (url.includes('/pdf/artifacts')) return route.fulfill({ json: ARTIFACTS });
    if (url.includes('/compatibility')) {
      return route.fulfill({
        json: url.includes('informe-generico') ? COMPATIBLE : COMPATIBILITY,
      });
    }
    if (url.includes('/sample')) {
      return route.fulfill({
        json: {
          templateId: 'generic-result-report',
          artifactId: 'riesgo-credito',
          artifactVersion: '2.1.0',
          payload: { title: 'Evaluación de riesgo', score: 782 },
          missing: ['decision'],
          compatibility: COMPATIBILITY,
        },
      });
    }

    // El contrato va ANTES del catálogo: `/pdf/templates/x/schema` casa con las
    // dos, y sólo el sufijo las distingue.
    if (url.includes('/pdf/templates/') && url.includes('/schema')) {
      return route.fulfill({ json: SCHEMA });
    }
    if (url.includes('/pdf/templates/') && url.includes('/validate')) {
      return route.fulfill({
        json: { valid: true, templateId: 'generic-result-report', version: '1.0.0', issues: [] },
      });
    }
    if (url.includes('/pdf/template-format/example')) {
      return route.fulfill({ json: { manifest: { id: 'certificado-de-cuenta' } } });
    }
    if (url.includes('/pdf/templates')) return route.fulfill({ json: TEMPLATES });

    if ((url.includes('/pdf/generate') || url.includes('/pdf/preview')) && method === 'POST') {
      return route.fulfill({
        contentType: 'application/pdf',
        headers: {
          'content-disposition': 'attachment; filename="informe.pdf"',
          'x-document-id': 'DOC-17EA7F239BCD',
          'x-template': 'generic-result-report@1.0.0',
        },
        body: PDF_BYTES,
      });
    }

    return route.fulfill({ status: 404, json: { title: 'NOT_FOUND', status: 404 } });
  });
}
