import { createClient } from '@/lib/supabase/server';
import { BASE_BROWSE_KEYWORDS, catalogKeywords, getPublishedCatalog } from '@/lib/seo';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const catalog = await getPublishedCatalog();
  const liveKeywords = catalogKeywords(catalog);
  const gameNames = catalog.games.slice(0, 8).map((g) => g.title);
  const recipeNames = catalog.recipes.slice(0, 4).map((r) => r.title);
  const catalogBlurb = [
    gameNames.length > 0 ? `Learn how to play ${gameNames.join(', ')}, and more.` : null,
    recipeNames.length > 0 ? `Cooking tutorials include ${recipeNames.join(', ')}.` : null,
  ]
    .filter(Boolean)
    .join(' ');
  const description = catalogBlurb
    ? `Discover free interactive tutorials created by the community. ${catalogBlurb} Cooking recipes, DIY guides, software tutorials - all with step-by-step walkthroughs, quizzes, and video.`
    : 'Discover free interactive tutorials created by the community. Learn how to play board games, follow cooking recipes, and more with guided walkthroughs, quizzes, and video.';

  return {
    title: 'Browse Interactive Tutorials - Board Games, Cooking, Software & More',
    description,
    keywords: [...BASE_BROWSE_KEYWORDS, ...liveKeywords],
    openGraph: {
      title: 'Browse Interactive Tutorials - Board Games, Cooking, Software & More',
      description,
      url: 'https://qurator.quobby.com/tutorials',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: 'Browse Interactive Tutorials | Qurator',
      description:
        'Discover free interactive tutorials for board games, cooking, software, and more.',
    },
    alternates: {
      canonical: 'https://qurator.quobby.com/tutorials',
    },
  };
}

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://qurator.quobby.com',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Tutorials',
      item: 'https://qurator.quobby.com/tutorials',
    },
  ],
};

async function buildItemListJsonLd() {
  try {
    const supabase = await createClient();
    const { data: tutorials } = await supabase
      .from('tutorials')
      .select('id, title, description, play_count, rating_avg, rating_count, games(title, bgg_image_url)')
      .eq('status', 'published')
      .order('play_count', { ascending: false })
      .limit(50);

    if (!tutorials || tutorials.length === 0) return null;

    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Interactive Tutorials',
      description: 'Community-created interactive tutorials for board games, cooking, software, and more.',
      numberOfItems: tutorials.length,
      itemListElement: tutorials.map((t, i) => {
        const game = t.games as unknown as { title: string; bgg_image_url: string | null } | null;
        return {
          '@type': 'ListItem',
          position: i + 1,
          url: `https://qurator.quobby.com/tutorials/${t.id}`,
          name: game?.title ? `${t.title} - ${game.title}` : t.title,
          ...(t.description && { description: t.description }),
          ...(game?.bgg_image_url && { image: game.bgg_image_url }),
        };
      }),
    };
  } catch {
    return null;
  }
}

export default async function TutorialsLayout({ children }: { children: React.ReactNode }) {
  const itemListJsonLd = await buildItemListJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}
      {children}
    </>
  );
}
