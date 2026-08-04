import { expect, test } from '@playwright/test';
import { denseBackend } from './support/dense-backend';

/**
 * ¿Detecta algo la prueba de desbordamiento?
 *
 * `e2e/responsive.spec.ts` compara `documentElement.scrollWidth` con
 * `clientWidth`. Pero `.app-shell` lleva `overflow-x: clip`, y un contenedor
 * recortado NO propaga el ancho de su contenido al documento. Si eso es cierto,
 * la prueba está midiendo una magnitud que su propio CSS mantiene constante:
 * pasaría igual con la vista rota.
 *
 * Esto no se argumenta, se comprueba: se mete a la fuerza un bloque el doble de
 * ancho que la ventana y se mira si alguna de las dos medidas se entera.
 */
test('la medida por scrollWidth es ciega dentro del marco recortado', async ({ page }) => {
  await denseBackend(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/variables');
  await page.waitForSelector('.app-shell');

  const medida = await page.evaluate(() => {
    const doc = document.documentElement;
    const antes = doc.scrollWidth - doc.clientWidth;

    const intruso = document.createElement('div');
    intruso.id = 'sonda-desborde';
    intruso.style.width = `${window.innerWidth * 2}px`;
    intruso.style.height = '10px';
    document.querySelector('.content')?.append(intruso);

    const despues = doc.scrollWidth - doc.clientWidth;
    const borde = intruso.getBoundingClientRect().right;
    intruso.remove();
    return { antes, despues, borde, ventana: doc.clientWidth };
  });

  // El bloque mide el doble de la ventana: su borde derecho la desborda.
  expect(medida.borde).toBeGreaterThan(medida.ventana + 1);

  // Y aun así el documento no se entera: la medida clásica sigue en cero. Este
  // `expect` documenta la ceguera; si algún día `overflow-x: clip` desaparece
  // del marco, fallará y avisará de que la red de seguridad ya no está.
  expect(
    medida.despues,
    'Si esto falla, el marco dejó de recortar: revisa `.app-shell { overflow-x: clip }`',
  ).toBe(medida.antes);
});
