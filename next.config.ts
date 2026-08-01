import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
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
