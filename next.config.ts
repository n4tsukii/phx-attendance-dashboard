import type { NextConfig } from 'next';
const isExport = process.env.NEXT_EXPORT === 'true';
const config: NextConfig = {
  output: isExport ? 'export' : 'standalone',
  basePath: process.env.BASE_PATH || '',
  poweredByHeader: false,
  images: { unoptimized: true },
};
export default config;
