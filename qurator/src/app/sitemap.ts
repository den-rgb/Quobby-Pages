import { DEMO_TUTORIAL_LIST } from '@/lib/demo-tutorials';
import { createClient } from '@/lib/supabase/server';
import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: 'https://qurator.quobby.com',
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://qurator.quobby.com/tutorials',
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];

  try {
    const supabase = await createClient();
    const { data: tutorials } = await supabase
      .from('tutorials')
      .select('id, updated_at')
      .eq('status', 'published')
      .order('updated_at', { ascending: false });

    if (tutorials) {
      for (const t of tutorials) {
        entries.push({
          url: `https://qurator.quobby.com/tutorials/${t.id}`,
          lastModified: new Date(t.updated_at),
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      }
    }
  } catch {
    // Supabase unavailable during build — include demo tutorials only
  }

  for (const demo of DEMO_TUTORIAL_LIST) {
    const alreadyIncluded = entries.some((e) => e.url.endsWith(`/tutorials/${demo.id}`));
    if (!alreadyIncluded) {
      entries.push({
        url: `https://qurator.quobby.com/tutorials/${demo.id}`,
        changeFrequency: 'monthly',
        priority: 0.6,
      });
    }
  }

  return entries;
}
