import type { NextConfig } from "next";

const baseHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const defaultCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co https://api.stripe.com https://boardgamegeek.com https://query.wikidata.org https://commons.wikimedia.org https://en.wikipedia.org https://www.bing.com",
  "frame-src https://js.stripe.com https://www.youtube.com https://youtube.com https://player.vimeo.com https://www.dailymotion.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'cf.geekdo-images.com' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'commons.wikimedia.org' },
    ],
  },
  async headers() {
    return [
      {
        source: '/embed/:path*',
        headers: [
          ...baseHeaders,
          {
            key: 'Content-Security-Policy',
            value: [...defaultCsp, "frame-ancestors *"].join('; '),
          },
        ],
      },
      {
        source: '/((?!embed/).*)',
        headers: [
          ...baseHeaders,
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Content-Security-Policy',
            value: [...defaultCsp, "frame-ancestors 'none'"].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
