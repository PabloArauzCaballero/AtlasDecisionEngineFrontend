import type { NextConfig } from 'next';

const decisionEngineUrl = (process.env.DECISION_ENGINE_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
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
