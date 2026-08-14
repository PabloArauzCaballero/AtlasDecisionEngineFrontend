import { createServer, type Server } from 'node:http';

/**
 * Recolector de correo para las pruebas contra el motor REAL.
 *
 * Con el segundo factor activo, entrar por la pantalla de acceso exige un PIN que sale por correo, y
 * una batería automatizada no tiene buzón que leer. La salida fácil —apagar `AUTH_LOGIN_PIN_ENABLED`
 * mientras corren las pruebas— deja la corrida en verde habiendo ejercitado un camino de acceso que
 * NO es el que corre en producción: precisamente el tramo que más importa comprobar, y encima
 * apagando un control de seguridad para que el reloj no se agote.
 *
 * Lo que se hace en su lugar es levantar aquí un servidor mínimo y apuntarle el canal de correo del
 * proveedor de identidad (`NOTIFICATION_EMAIL_PROVIDER=webhook` +
 * `NOTIFICATION_EMAIL_WEBHOOK_URL=http://host.docker.internal:<puerto>/correo`). El PIN se lee por
 * donde de verdad salió y los DOS pasos quedan ejercitados.
 *
 * Sólo entra en juego cuando `PW_PIN_INBOX_PORT` está configurado. Sin esa variable, el andamiaje
 * no inventa nada: si aparece la pantalla del PIN, la prueba falla diciendo exactamente qué falta.
 */

export const PUERTO_BUZON = Number(process.env.PW_PIN_INBOX_PORT ?? 0);
export const HAY_BUZON = PUERTO_BUZON > 0;

const PIN = /\b(\d{6})\b/;

interface CorreoRecibido {
  to: string;
  body: string;
  recibidoEn: number;
}

export class BuzonPin {
  private readonly correos: CorreoRecibido[] = [];
  private servidor: Server | null = null;

  async abrir(puerto: number): Promise<void> {
    this.servidor = createServer((request, response) => {
      if (request.method !== 'POST') {
        response.writeHead(405).end();
        return;
      }
      const trozos: Buffer[] = [];
      request.on('data', (trozo: Buffer) => trozos.push(trozo));
      request.on('end', () => {
        try {
          const cuerpo = JSON.parse(Buffer.concat(trozos).toString('utf8')) as {
            to?: string;
            body?: string;
          };
          this.correos.push({
            to: cuerpo.to ?? '',
            body: cuerpo.body ?? '',
            recibidoEn: Date.now(),
          });
        } catch {
          /* Un cuerpo ilegible no es un PIN: se ignora y la espera acabará agotándose. */
        }
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ id: 'buzon-e2e' }));
      });
    });

    await new Promise<void>((resolver) => this.servidor?.listen(puerto, resolver));
  }

  async cerrar(): Promise<void> {
    await new Promise<void>((resolver) => {
      if (!this.servidor) return resolver();
      this.servidor.close(() => resolver());
    });
    this.servidor = null;
  }

  /** Descarta lo anterior: un PIN de un intento previo ya no sirve y confundiría al siguiente. */
  vaciar(): void {
    this.correos.length = 0;
  }

  /**
   * Espera el PIN dirigido a un correo concreto. Sondea en vez de bloquear en un `await` del
   * servidor porque el correo llega mientras el navegador ya está en la pantalla del código: las dos
   * cosas ocurren en paralelo y no hay orden garantizado entre ellas.
   */
  async esperarPin(destinatario: string, tiempoMaximoMs = 60_000): Promise<string> {
    const limite = Date.now() + tiempoMaximoMs;
    while (Date.now() < limite) {
      const correo = this.correos.find(
        (candidato) =>
          candidato.to.toLowerCase() === destinatario.toLowerCase() && PIN.test(candidato.body),
      );
      const encontrado = correo?.body.match(PIN)?.[1];
      if (encontrado) return encontrado;
      await new Promise((resolver) => setTimeout(resolver, 250));
    }
    throw new Error(
      `No llegó ningún correo con PIN para ${destinatario} en ${tiempoMaximoMs / 1000} s. ` +
        'Comprueba que el proveedor de identidad tiene NOTIFICATION_EMAIL_PROVIDER=webhook y ' +
        `NOTIFICATION_EMAIL_WEBHOOK_URL=http://host.docker.internal:${PUERTO_BUZON}/correo.`,
    );
  }
}
