import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/profile', '/create/', '/premium/'],
      },
      {
        userAgent: ['GPTBot', 'ChatGPT-User', 'Google-Extended', 'Anthropic-AI', 'ClaudeBot', 'PerplexityBot', 'Cohere-AI'],
        allow: ['/', '/llms.txt'],
        disallow: ['/api/', '/profile', '/create/', '/premium/'],
      },
    ],
    sitemap: 'https://qurator.quobby.com/sitemap.xml',
  };
}
