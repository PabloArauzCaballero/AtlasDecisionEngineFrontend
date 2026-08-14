import { crc32 } from 'node:zlib';
import { deflateSync } from 'node:zlib';
import type { Page } from '@playwright/test';

/**
 * Dibuja una cédula sintética LEGIBLE usando el lienzo del propio navegador.
 *
 * Hace falta porque el motor lee el documento de verdad: una imagen de ruido ya
 * no vale como «documento subido», la rechaza —correctamente— por no ser un
 * documento. Y el texto no se puede componer desde Node sin arrastrar aquí una
 * librería de imagen; el navegador que ya está abierto tiene tipografías y un
 * `canvas`, así que dibuja él.
 *
 * No se parece a una cédula real y no debe parecerse: lo que ejercita es el
 * camino —subida, OCR, clasificación y anclajes del analizador—, no el diseño.
 */
export async function cedulaLegible(page: Page, numero: string): Promise<Buffer> {
  const dataUrl = await page.evaluate((n) => {
    const lienzo = document.createElement('canvas');
    lienzo.width = 1400;
    lienzo.height = 900;
    const ctx = lienzo.getContext('2d');
    if (!ctx) throw new Error('sin contexto 2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.fillStyle = '#111111';
    const escribir = (texto: string, y: number, tam: number, negrita = false) => {
      ctx.font = `${negrita ? 'bold ' : ''}${tam}px sans-serif`;
      ctx.fillText(texto, 70, y);
    };
    escribir('ESTADO PLURINACIONAL DE BOLIVIA', 130, 44);
    escribir('CEDULA DE IDENTIDAD', 205, 52, true);
    // `No <numero>` es el anclaje que imprime el anverso de verdad.
    escribir(`No ${n} SC`, 315, 54);
    escribir('A: PERSONA PRUEBA DEMO SINTETICO', 405, 46);
    escribir('Nacido el 15 de Enero de 2000', 485, 42);
    escribir('En SANTA CRUZ - ANDRES IBANEZ', 560, 42);
    escribir('Valida hasta el 26 de Enero de 2035', 640, 42);
    escribir('NACIONALIDAD: BOLIVIANA', 715, 38);
    return lienzo.toDataURL('image/png');
  }, numero);
  return Buffer.from(dataUrl.split(',')[1] ?? '', 'base64');
}

/**
 * Una foto NORMAL: lisa, nítida y sin una sola letra.
 *
 * Es la entrada del caso «esto no es un documento». Tiene que ser lisa y no
 * ruidosa: sobre ruido de alta frecuencia, Tesseract alucina cientos de
 * caracteres de basura y el rechazo llega por la rama equivocada («tiene texto
 * y no es un documento» en vez de «no se leyó ni una letra»). Se comprobó
 * midiendo: 640 caracteres con ruido, 0 con formas grandes.
 */
export async function fotoLisa(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const lienzo = document.createElement('canvas');
    lienzo.width = 1200;
    lienzo.height = 800;
    const ctx = lienzo.getContext('2d');
    if (!ctx) throw new Error('sin contexto 2d');
    const cielo = ctx.createLinearGradient(0, 0, 0, 560);
    cielo.addColorStop(0, '#3f82d2');
    cielo.addColorStop(1, '#bedcf0');
    ctx.fillStyle = cielo;
    ctx.fillRect(0, 0, 1200, 560);
    ctx.fillStyle = '#fceca0';
    ctx.beginPath();
    ctx.arc(280, 170, 86, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#46683f';
    ctx.beginPath();
    ctx.moveTo(0, 560);
    ctx.lineTo(340, 330);
    ctx.lineTo(640, 560);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#35562f';
    ctx.beginPath();
    ctx.moveTo(420, 560);
    ctx.lineTo(820, 300);
    ctx.lineTo(1200, 560);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2d4a26';
    ctx.fillRect(0, 560, 1200, 240);
    ctx.fillStyle = '#6a4d30';
    ctx.fillRect(0, 640, 1200, 26);
    return lienzo.toDataURL('image/png');
  });
  return Buffer.from(dataUrl.split(',')[1] ?? '', 'base64');
}

/**
 * Genera un PNG de ruido, sin dependencias.
 *
 * Existe para que la prueba de subida mande imágenes DE VERDAD por
 * `multipart/form-data` en vez de un escenario del catálogo: el camino del
 * archivo real es donde viven el tipo declarado, los bytes mágicos, el techo de
 * tamaño y el límite de resolución, y ninguno de ellos se ejercita eligiendo un
 * escenario.
 *
 * Ruido y no un color plano porque el motor mide contraste y nitidez: una
 * imagen uniforme se rechaza a propósito (`IDENTITY_DOCUMENT_BLURRY`), que es
 * justo lo que esta ayuda NO quiere provocar. Y determinista, porque la
 * idempotencia del worker se apoya en la huella del contenido: dos imágenes
 * iguales serían la misma verificación.
 */
export function pngDeRuido(width: number, height: number, semilla: string): Buffer {
  // Cada scanline de un PNG empieza por su byte de filtro; con 0 («ninguno»)
  // los píxeles van tal cual y no hay que deshacer ninguna predicción.
  const raw = Buffer.alloc(height * (1 + width * 3));
  let state = hash(semilla);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0;
    offset += 1;
    for (let x = 0; x < width * 3; x += 1) {
      state = (state * 1_664_525 + 1_013_904_223) >>> 0;
      raw[offset] = 24 + ((state >>> 16) % 208);
      offset += 1;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 2; // color verdadero, sin alfa
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // filtrado adaptativo
  ihdr[12] = 0; // sin entrelazado

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  // El CRC del PNG cubre el TIPO y los datos, no la longitud.
  checksum.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([length, body, checksum]);
}

function hash(seed: string): number {
  let value = 2_166_136_261;
  for (let i = 0; i < seed.length; i += 1) {
    value ^= seed.charCodeAt(i);
    value = Math.imul(value, 16_777_619) >>> 0;
  }
  return value;
}
