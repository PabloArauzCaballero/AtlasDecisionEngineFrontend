import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * El contrato de la pantalla de último recurso, comprobado sobre el código.
 *
 * No se renderiza aquí: monta su propio `<html>`, y jsdom no admite dos. Lo que
 * importa tampoco es lo que pinta, sino lo que arrastra consigo — y eso se lee
 * en los imports. Next reemplaza el layout raíz por este archivo, así que todo
 * lo que el layout traía hay que volver a traerlo, o la pantalla sale desnuda
 * justo cuando ya ha fallado todo lo demás.
 */
const source = readFileSync(join(process.cwd(), 'src/app/global-error.next.tsx'), 'utf8');

describe('pantalla de error global', () => {
  it('trae la hoja de estilos, que no hereda de ningún layout', () => {
    expect(source).toContain("import '../styles/global.css'");
  });

  it('resuelve el tema antes de pintar', () => {
    // Sin esto, quien trabaja en oscuro recibe un fogonazo blanco a pantalla
    // completa en el peor momento posible.
    expect(source).toContain('THEME_BOOTSTRAP_SCRIPT');
  });

  it('se anuncia como alerta y ofrece una salida', () => {
    expect(source).toContain('role="alert"');
    expect(source).toContain('onClick={reset}');
  });

  it('muestra el código de diagnóstico, que es lo único accionable', () => {
    expect(source).toContain('error.digest');
  });
});
