import { expect, test } from '@playwright/test';
import { mockBackend } from './support/backend-mock';

/**
 * El informe en PDF de una ejecución.
 *
 * Lo que se comprueba no es «se descarga algo», sino las dos cosas que podían salir mal al
 * conectar la pantalla de auditoría con el generador documental:
 *
 *  1. Que lo que viaja al generador lleva ENMASCARADO lo mismo que la pantalla enmascara. Un PDF
 *     es la copia más fácil de reenviar que existe: si el valor en claro llega al worker, ya salió
 *     de la pantalla, aunque la plantilla no lo pintara.
 *  2. Que el archivo se pide por la puerta autenticada y llega como PDF —no como la ficha JSON de
 *     la misma ruta—, que es el defecto que produce «PDF corrupto» al abrirlo.
 */

const EJECUCION = {
  id: 'exec-1',
  requestId: 'REQ-1',
  artifactCode: 'SCORING_CREDITO',
  versionNumber: 4,
  environmentCode: 'DEV',
  principalId: 'usr-9',
  createdAt: '2026-07-20T10:00:00Z',
  status: 'COMPLETED',
  outcome: 'APPROVED',
  durationMs: 143,
  variables: [
    {
      variableCode: 'ingreso_mensual',
      value: 8500,
      sensitivityClass: 'PII',
      sourceType: 'INPUT',
    },
    { variableCode: 'score', value: 712, sensitivityClass: 'INTERNAL', sourceType: 'MODEL' },
  ],
  traceSteps: [{ nodeKey: 'corte_score', evaluation: 'score >= 650', durationUs: 340 }],
};

test('la ejecución se descarga como informe y los datos personales no salen en claro', async ({
  page,
}) => {
  await mockBackend(page);
  // Después del simulado general para que gane sobre su comodín `/v1/**`.
  await page.route('**/v1/audit/executions/exec-1*', (route) => route.fulfill({ json: EJECUCION }));

  let encargo: unknown;
  await page.route('**/pdf/generate', async (route) => {
    encargo = JSON.parse(route.request().postData() ?? '{}');
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/pdf' },
      body: Buffer.from('%PDF-1.4\n% documento de prueba\n'),
    });
  });

  await page.goto('/executions/exec-1');

  const descarga = page.waitForEvent('download');
  await page.getByTestId('descargar-pdf-ejecucion').click();
  const archivo = await descarga;

  // El nombre lleva el identificador de petición, que es lo que se cita al reclamar una decisión.
  expect(archivo.suggestedFilename()).toBe('ejecucion-REQ-1.pdf');

  const enviado = JSON.stringify(encargo);
  expect(enviado).toContain('generic-result-report');
  expect(enviado).toContain('•••');
  // El ingreso del solicitante NO viaja.
  expect(enviado).not.toContain('8500');
  // El valor no clasificado sí: enmascarar todo dejaría el informe sin contenido.
  expect(enviado).toContain('712');
});
