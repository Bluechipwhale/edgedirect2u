import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  serverExternalPackages: ['node:sqlite'],
  images: { remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }, { protocol: 'https', hostname: '**.supabase.co' }] },
  turbopack: { root: process.cwd(), rules: { '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' } } },
  webpack(config) {
    // Run the same CSS loader in-process on hosts that cannot start Turbopack's CSS worker.
    config.module.rules.push({ test: /globals\.css$/, enforce: 'pre', use: ['@tailwindcss/turbopack'] });
    return config;
  },
  async headers() { return [{ source: '/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }, { key: 'X-Frame-Options', value: 'SAMEORIGIN' }, {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}, ...(process.env.NODE_ENV==='production'&&process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://')?[{key:'Strict-Transport-Security',value:'max-age=31536000'}]:[])] }]; },
};
export default config;
