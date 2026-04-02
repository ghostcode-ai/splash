import type { NextConfig } from 'next';
import { resolve } from 'path';

const nextConfig: NextConfig = {
  reactStrictMode: false,
  devIndicators: false,
  turbopack: {
    root: resolve('.'),
  },
};

export default nextConfig;
