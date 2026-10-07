import { expect, type Locator } from '@playwright/test';

/**
 * Las imágenes de una zona que el navegador NO pudo pintar.
 *
 * Una imagen rota no siempre deja rastro en la red ni en la consola: un blob con el tipo
 * equivocado, un archivo truncado o una respuesta 200 que no es una imagen se «cargan» bien, y en
 * pantalla queda sólo el texto alternativo. Que el carrusel exista y cuente «1 / 3» no dice nada de
 * eso. Lo único que lo delata es que la imagen, ya terminada, no tiene dimensiones.
 *
 * Se espera a que las pendientes terminen (con tope) antes de mirar. Los SVG sin tamaño propio
 * pueden medir 0 legítimamente y se dejan fuera.
 */
export function brokenImages(scope: Locator): Promise<string[]> {
  return scope.evaluate(async (root) => {
    const imagenes = Array.from(root.querySelectorAll('img')).filter(
      (img) => img.currentSrc || img.src,
    );
    await Promise.all(
      imagenes.map((img) =>
        img.complete
          ? null
          : new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
              setTimeout(resolve, 5_000);
            }),
      ),
    );
    const esSvg = (src: string) => /\.svg(\?|#|$)|^data:image\/svg/i.test(src);
    return imagenes
      .filter((img) => img.complete && img.naturalWidth === 0 && !esSvg(img.currentSrc || img.src))
      .map((img) => `${img.alt || '(sin alt)'} — ${(img.currentSrc || img.src).slice(0, 80)}`);
  });
}

/** Que haya exactamente `cantidad` imágenes en la zona y que TODAS se hayan pintado. */
export async function expectImagesPainted(scope: Locator, cantidad: number): Promise<void> {
  await expect(scope.locator('img')).toHaveCount(cantidad);
  expect(await brokenImages(scope), 'imágenes que no se pudieron pintar').toEqual([]);
}
