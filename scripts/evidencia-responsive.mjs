#!/usr/bin/env node
/**
 * Genera la evidencia responsive del portal contra el motor REAL, y la audita.
 *
 * Playwright deja las capturas y el informe; este script existe para lo que
 * Playwright no hace: comprobar que lo que quedó en disco SIRVE. Una corrida
 * puede terminar en verde y dejar 440 fotos de un spinner —pasó, y lo descubrió
 * una persona abriendo los PNG a mano—, así que aquí se revisa el resultado
 * antes de darlo por bueno:
 *
 *   1. cada celda de la matriz tiene su captura y su medición;
 *   2. ninguna captura pesa lo que pesa una pantalla en blanco;
 *   3. el informe no trae celdas sin asentar ni desbordes horizontales.
 *
 * Uso (las credenciales NUNCA se escriben en el repositorio):
 *
 *   PW_BASE_URL=http://localhost:5180 PW_TENANT_ID=1 \
 *     PW_USER=<correo> PW_PASSWORD=<clave> \
 *     yarn evidencia:responsive
 *
 *   --solo-auditar   revisa lo que ya hay en disco, sin volver a capturar
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CARPETA = 'docs/visual-evidence/real';
const INFORME = join(CARPETA, 'responsive-real.json');

/**
 * Suelo de tamaño de una captura, en bytes.
 *
 * Un PNG de página completa con contenido real no baja de unas decenas de kB.
 * Una pantalla de carga —fondo liso y un spinner— comprime a muy poco, así que
 * este umbral atrapa la clase de fallo que motivó el script incluso si la
 * prueba llegara a capturarla.
 */
const MINIMO_BYTES = 12_000;

const soloAuditar = process.argv.includes('--solo-auditar');

function generar() {
  console.log('\nGenerando evidencia responsive contra el motor real…\n');
  const resultado = spawnSync(
    'npx',
    ['playwright', 'test', 'e2e/responsive-real.spec.ts', '--reporter=list'],
    { stdio: 'inherit', shell: true },
  );
  return resultado.status ?? 1;
}

function auditar() {
  let informe;
  try {
    informe = JSON.parse(readFileSync(INFORME, 'utf8'));
  } catch {
    console.error(`\n  No hay informe en ${INFORME}. ¿Se llegó a generar la evidencia?\n`);
    return 1;
  }

  const problemas = [];
  const hallazgos = informe.hallazgos ?? [];
  const esperadas = (informe.rutas ?? 0) * (informe.anchos?.length ?? 0);

  if (hallazgos.length !== esperadas) {
    problemas.push(`el informe trae ${hallazgos.length} celdas y la matriz son ${esperadas}`);
  }

  const sinAsentar = hallazgos.filter((h) => h.error !== undefined);
  if (sinAsentar.length > 0) {
    problemas.push(`${sinAsentar.length} celdas no se asentaron (pantalla de carga o fallo)`);
    for (const h of sinAsentar.slice(0, 10)) {
      console.error(`    sin asentar · ${h.ruta} @ ${h.ancho}px — ${h.error}`);
    }
  }

  const desbordes = hallazgos.filter((h) => (h.desborde ?? 0) > 1);
  if (desbordes.length > 0) {
    problemas.push(`${desbordes.length} celdas desbordan en horizontal`);
    for (const h of desbordes.slice(0, 10)) {
      console.error(
        `    desborde · ${h.ruta} @ ${h.ancho}px → ${h.desborde}px · ${(h.culpables ?? []).join('; ')}`,
      );
    }
  }

  // Las capturas en sí: que existan y que no sean una pantalla en blanco.
  const capturas = readdirSync(CARPETA).filter((nombre) => nombre.endsWith('.png'));
  if (capturas.length !== esperadas) {
    problemas.push(`hay ${capturas.length} capturas en disco y la matriz son ${esperadas}`);
  }
  const sospechosas = capturas.filter(
    (nombre) => statSync(join(CARPETA, nombre)).size < MINIMO_BYTES,
  );
  if (sospechosas.length > 0) {
    problemas.push(
      `${sospechosas.length} capturas pesan menos de ${MINIMO_BYTES} bytes: ` +
        'casi seguro son pantallas de carga o vistas vacías',
    );
    for (const nombre of sospechosas.slice(0, 10)) {
      console.error(`    sospechosa · ${nombre} (${statSync(join(CARPETA, nombre)).size} bytes)`);
    }
  }

  console.log(`\n  celdas medidas : ${hallazgos.length} de ${esperadas}`);
  console.log(`  capturas       : ${capturas.length}`);
  console.log(`  desbordes      : ${desbordes.length}`);
  console.log(`  sin asentar    : ${sinAsentar.length}`);
  console.log(`  generada el    : ${informe.generadoEn ?? '(sin fecha)'}`);

  if (problemas.length > 0) {
    console.error('\n  EVIDENCIA NO UTILIZABLE:');
    for (const problema of problemas) console.error(`    - ${problema}`);
    console.error('');
    return 1;
  }

  console.log('\n  EVIDENCIA COMPLETA Y UTILIZABLE\n');
  return 0;
}

const codigoGeneracion = soloAuditar ? 0 : generar();
const codigoAuditoria = auditar();
// La auditoría manda: una corrida que termina en verde con evidencia inservible
// es exactamente el fallo que este script existe para atrapar.
process.exitCode = codigoAuditoria || codigoGeneracion;
