import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // В standalone попадает минимальный runtime Next для multi-stage образа.
  output: 'standalone',
  // Иначе file tracing может посчитать workspace root только apps/web.
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
};

export default nextConfig;
