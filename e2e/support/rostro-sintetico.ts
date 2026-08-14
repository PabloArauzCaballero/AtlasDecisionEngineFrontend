import type { Page } from '@playwright/test';

/**
 * Un rostro DIBUJADO, con el lienzo del propio navegador.
 *
 * Hace falta porque la biometría del motor es real: detecta, describe y compara
 * caras de verdad. Una selfie de ruido ya no vale como selfie —la rechaza,
 * correctamente, por no haber ningún rostro que comparar—, exactamente igual que
 * una imagen de ruido dejó de valer como documento cuando el OCR pasó a ser
 * real. Es la misma lección dos veces: en cuanto una comprobación deja de ser
 * simulada, la entrada de prueba tiene que ser algo que esa comprobación pueda
 * mirar.
 *
 * Se dibuja y no se versiona una foto: un rostro real metido en el historial de
 * git ya no sale, y este worker existe justamente para proteger ese dato. Y se
 * dibuja en el NAVEGADOR porque componer imágenes desde Node exigiría arrastrar
 * aquí una librería de imagen; el navegador ya está abierto y tiene lienzo.
 *
 * El grano del final no es decoración: un dibujo liso no tiene detalle fino, y
 * el medidor de calidad del motor lo lee —con razón— como una foto desenfocada.
 */

/** Dónde va el retrato dentro de la cédula que dibuja `cedulaConRetrato`. */
const RETRATO = { x: 1010, y: 190, w: 300, h: 380 };

/**
 * El dibujo, como texto que se evalúa en la página.
 *
 * Va como cadena y no como función importada porque `page.evaluate` serializa lo
 * que recibe: dentro del navegador no existe nada de este módulo.
 */
const DIBUJAR = `(ctx, x, y, w, h, semilla) => {
  const r = (() => { let s = semilla >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
  const entre = (a, b) => a + r() * (b - a);
  const cx = x + w / 2;
  const cy = y + h * 0.5;
  const caraW = w * 0.34;
  const caraH = h * 0.38;
  const ojoY = y + h * 0.42;
  const ojoSep = w * 0.14;
  const piel = 'rgb(' + Math.round(entre(150, 235)) + ',' + Math.round(entre(110, 190)) + ',' + Math.round(entre(85, 155)) + ')';
  const pelo = 'rgb(' + Math.round(entre(20, 90)) + ',' + Math.round(entre(15, 70)) + ',' + Math.round(entre(10, 55)) + ')';

  const fondo = ctx.createRadialGradient(cx, y + h * 0.3, 10, cx, y + h * 0.3, w * 0.8);
  fondo.addColorStop(0, '#cfd5da');
  fondo.addColorStop(1, '#8d949c');
  ctx.fillStyle = fondo;
  ctx.fillRect(x, y, w, h);

  // hombros y cuello
  ctx.fillStyle = '#3f4a58';
  ctx.beginPath();
  ctx.ellipse(cx, y + h * 1.18, w * 0.62, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = piel;
  ctx.fillRect(cx - w * 0.11, cy + caraH * 0.6, w * 0.22, h * 0.2);

  // pelo detrás
  ctx.fillStyle = pelo;
  ctx.beginPath();
  ctx.ellipse(cx, cy - caraH * 0.12, caraW * 1.16, caraH * 1.06, 0, 0, Math.PI * 2);
  ctx.fill();

  // orejas
  ctx.fillStyle = piel;
  for (const lado of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + lado * caraW, cy + caraH * 0.08, caraW * 0.13, caraH * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // rostro
  const tono = ctx.createRadialGradient(cx, cy - caraH * 0.25, 5, cx, cy, caraW * 1.5);
  tono.addColorStop(0, piel);
  tono.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = tono;
  ctx.beginPath();
  ctx.ellipse(cx, cy, caraW, caraH, 0, 0, Math.PI * 2);
  ctx.fill();

  // flequillo
  ctx.fillStyle = pelo;
  ctx.beginPath();
  ctx.ellipse(cx, cy - caraH * 0.72, caraW * 1.02, caraH * 0.38, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // cejas
  ctx.strokeStyle = pelo;
  ctx.lineWidth = Math.max(3, w * 0.016);
  ctx.lineCap = 'round';
  for (const lado of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + lado * (ojoSep + w * 0.06), ojoY - h * 0.055);
    ctx.quadraticCurveTo(cx + lado * ojoSep, ojoY - h * 0.085, cx + lado * (ojoSep - w * 0.055), ojoY - h * 0.058);
    ctx.stroke();
  }

  // ojos
  const iris = 'rgb(' + Math.round(entre(35, 95)) + ',' + Math.round(entre(25, 85)) + ',' + Math.round(entre(15, 70)) + ')';
  for (const lado of [-1, 1]) {
    const ox = cx + lado * ojoSep;
    ctx.fillStyle = '#f6f2ee';
    ctx.beginPath();
    ctx.ellipse(ox, ojoY, w * 0.062, h * 0.028, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = iris;
    ctx.beginPath();
    ctx.arc(ox, ojoY, w * 0.027, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#141014';
    ctx.beginPath();
    ctx.arc(ox, ojoY, w * 0.012, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(ox - w * 0.009, ojoY - h * 0.009, w * 0.007, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4a3a2e';
    ctx.lineWidth = Math.max(2, w * 0.008);
    ctx.beginPath();
    ctx.ellipse(ox, ojoY, w * 0.062, h * 0.028, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
  }

  // nariz
  ctx.fillStyle = 'rgba(120,80,55,0.5)';
  ctx.beginPath();
  ctx.moveTo(cx, ojoY + h * 0.01);
  ctx.lineTo(cx - w * 0.022, ojoY + h * 0.1);
  ctx.lineTo(cx + w * 0.022, ojoY + h * 0.1);
  ctx.closePath();
  ctx.fill();

  // boca
  ctx.fillStyle = 'rgb(' + Math.round(entre(140, 195)) + ',' + Math.round(entre(70, 110)) + ',' + Math.round(entre(65, 100)) + ')';
  ctx.beginPath();
  ctx.ellipse(cx, ojoY + h * 0.175, w * 0.075, h * 0.032, 0, 0, Math.PI * 2);
  ctx.fill();

  // grano: sin detalle fino, el motor lee el dibujo como una foto movida
  const datos = ctx.getImageData(x, y, w, h);
  for (let i = 0; i < datos.data.length; i += 4) {
    const d = Math.round((r() - 0.5) * 34);
    datos.data[i] = Math.min(255, Math.max(0, datos.data[i] + d));
    datos.data[i + 1] = Math.min(255, Math.max(0, datos.data[i + 1] + d));
    datos.data[i + 2] = Math.min(255, Math.max(0, datos.data[i + 2] + d));
  }
  ctx.putImageData(datos, x, y);
}`;

/** Una selfie: el rostro solo, encuadrado como lo encuadra una cámara frontal. */
export async function selfieSintetica(page: Page, semilla: number): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ({ dibujar, semilla: s }) => {
      const lienzo = document.createElement('canvas');
      lienzo.width = 720;
      lienzo.height = 720;
      const ctx = lienzo.getContext('2d');
      if (!ctx) throw new Error('sin contexto 2d');
      const pintar = new Function('return ' + dibujar)() as (
        c: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        semilla: number,
      ) => void;
      pintar(ctx, 0, 0, 720, 720, s);
      return lienzo.toDataURL('image/png');
    },
    { dibujar: DIBUJAR, semilla },
  );
  return Buffer.from(dataUrl.split(',')[1] ?? '', 'base64');
}

/**
 * Una cédula legible CON su retrato.
 *
 * El documento también necesita una cara: sin ella el motor corta antes de
 * comparar, y con razón —no hay nada contra qué comparar la selfie—. Lleva la
 * misma semilla que la selfie, así que las dos caras son de la misma persona.
 */
export async function cedulaConRetrato(
  page: Page,
  numero: string,
  semilla: number,
): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ({ dibujar, numero: n, semilla: s, caja }) => {
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
      escribir(`No ${n} SC`, 315, 54);
      escribir('A: PERSONA PRUEBA DEMO SINTETICO', 405, 46);
      escribir('Nacido el 15 de Enero de 2000', 485, 42);
      escribir('En SANTA CRUZ - ANDRES IBANEZ', 560, 42);
      escribir('Valida hasta el 26 de Enero de 2035', 640, 42);
      escribir('NACIONALIDAD: BOLIVIANA', 715, 38);
      const pintar = new Function('return ' + dibujar)() as (
        c: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        semilla: number,
      ) => void;
      pintar(ctx, caja.x, caja.y, caja.w, caja.h, s);
      return lienzo.toDataURL('image/png');
    },
    { dibujar: DIBUJAR, numero, semilla, caja: RETRATO },
  );
  return Buffer.from(dataUrl.split(',')[1] ?? '', 'base64');
}
