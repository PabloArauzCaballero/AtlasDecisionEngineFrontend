import type { NextConfig } from 'next';

const decisionEngineUrl = (process.env.DECISION_ENGINE_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
] as const;

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
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: `${decisionEngineUrl}/v1/:path*`,
      },
      {
        source: '/health/:path*',
        destination: `${decisionEngineUrl}/health/:path*`,
      },
      {
        source: '/metrics',
        destination: `${decisionEngineUrl}/metrics`,
      },
    ];
  },
};

export default nextConfig;
