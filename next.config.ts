import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  /*
   * `camera=(self)` y no `camera=()`: la consola de verificación de identidad
   * deja tomar la selfie con la cámara del equipo, y con la lista vacía el
   * navegador rechaza `getUserMedia` ANTES de preguntarle nada al usuario —el
   * botón queda muerto y el error no menciona esta cabecera, así que cuesta
   * horas encontrarlo—.
   *
   * `self` es el permiso más estrecho que permite hacerlo: habilita la cámara
   * para este origen y **la sigue negando a cualquier iframe de terceros**, que
   * es de lo que esta cabecera protege. El micrófono, la ubicación, el pago y
   * USB siguen cerrados: nada del portal los usa.
   *
   * Sigue habiendo dos guardas por encima: el navegador pide permiso explícito
   * al usuario, y sólo lo ofrece en contexto seguro (HTTPS o localhost).
   */
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()',
  },
  /*
   * HSTS: los navegadores sólo la aplican cuando la respuesta llegó por HTTPS,
   * así que declararla aquí no rompe el desarrollo en `http://localhost`. Sin
   * ella, la primera visita escrita a mano viaja en claro y el token de sesión
   * queda expuesto a quien esté en la red.
   */
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
] as const;

/*
 * La Content-Security-Policy NO se declara aquí: lleva un nonce distinto por
 * respuesta y la emite `src/middleware.next.ts`.
 */

const nextConfig: NextConfig = {
  output: 'standalone',
  /*
   * Directorio de salida, con escape.
   *
   * Por omisión es `.next`, que es también donde escribe `next dev`. Compilar
   * con el servidor de desarrollo levantado le deja el suelo cambiado debajo
   * —rutas dando 404, «module factory is not available»— y sólo se cura parando
   * el servidor y borrando `.next`. `NEXT_DIST_DIR` permite compilar a otro
   * sitio para comprobar que la build sale limpia sin tocar la sesión de nadie,
   * que es exactamente lo que hace falta al verificar sobre un árbol vivo.
   */
  distDir: process.env.NEXT_DIST_DIR || '.next',
  pageExtensions: ['next.tsx', 'next.ts'],
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [...securityHeaders],
      },
    ];
  },
};

export default nextConfig;
