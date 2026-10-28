import { asPdfBlob } from './pdf-blob';

/** jsdom no implementa `Blob.text()`. */
function leer(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(lector.error);
    lector.readAsText(blob);
  });
}

describe('asPdfBlob', () => {
  it('fija application/pdf aunque el servidor haya declarado un tipo que un marco ejecutaría', async () => {
    for (const hostil of ['text/html', 'image/svg+xml', 'application/xhtml+xml', '']) {
      const original = new Blob(['<script>alert(1)</script>'], { type: hostil });
      const resultado = asPdfBlob(original);
      expect(resultado.type).toBe('application/pdf');
      // Los bytes no cambian: sólo el tipo con el que el marco decide cómo pintarlos.
      expect(await leer(resultado)).toBe('<script>alert(1)</script>');
    }
  });

  it('no copia el blob cuando ya es un PDF', () => {
    const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    expect(asPdfBlob(pdf)).toBe(pdf);
  });
});
