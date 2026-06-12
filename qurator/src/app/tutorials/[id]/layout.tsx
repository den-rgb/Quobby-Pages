import { DEMO_TUTORIALS } from '@/lib/demo-tutorials';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

interface TutorialJsonLd {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  estimatedMinutes?: number;
  ratingAvg?: number;
  ratingCount?: number;
  steps?: string[];
}

function buildHowToJsonLd(data: TutorialJsonLd) {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: data.title,
    description: data.description,
    url: data.url,
    ...(data.imageUrl && { image: data.imageUrl }),
    ...(data.estimatedMinutes && {
      totalTime: `PT${data.estimatedMinutes}M`,
    }),
  };

  if (data.ratingAvg && data.ratingCount && data.ratingCount > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: data.ratingAvg.toFixed(1),
      ratingCount: data.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (data.steps && data.steps.length > 0) {
    jsonLd.step = data.steps.map((heading, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: heading,
      url: `${data.url}#step-${i + 1}`,
    }));
  }

  return jsonLd;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  const demo = DEMO_TUTORIALS[id];
  if (demo) {
    return {
      title: demo.tutorial.title,
      description: demo.tutorial.description,
      openGraph: {
        title: demo.tutorial.title,
        description: demo.tutorial.description,
        url: `https://qurator.quobby.com/tutorials/${id}`,
        type: 'article',
      },
      twitter: {
        card: 'summary',
        title: demo.tutorial.title,
        description: demo.tutorial.description,
      },
      alternates: { canonical: `https://qurator.quobby.com/tutorials/${id}` },
    };
  }

  try {
    const supabase = await createClient();
    const { data: tutorial } = await supabase
      .from('tutorials')
      .select('title, description, cover_image_url, rating_avg, rating_count, estimated_minutes, games(title)')
      .eq('id', id)
      .single();

    if (!tutorial) return {};

    const games = tutorial.games as unknown as { title: string } | null;
    const gameTitle = games?.title;
    const title = gameTitle
      ? `${tutorial.title} — ${gameTitle}`
      : tutorial.title;

    const images = [
      { url: `https://qurator.quobby.com/api/og?id=${id}`, width: 1200, height: 630, alt: tutorial.title },
    ];

    return {
      title,
      description: tutorial.description,
      openGraph: {
        title,
        description: tutorial.description,
        url: `https://qurator.quobby.com/tutorials/${id}`,
        type: 'article',
        images,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description: tutorial.description,
        images: [images[0].url],
      },
      alternates: { canonical: `https://qurator.quobby.com/tutorials/${id}` },
    };
  } catch {
    return {};
  }
}

export default async function TutorialLayout({ params, children }: Props) {
  const { id } = await params;
  let jsonLd: Record<string, unknown> | null = null;

  const demo = DEMO_TUTORIALS[id];
  if (demo) {
    jsonLd = buildHowToJsonLd({
      title: demo.tutorial.title,
      description: demo.tutorial.description,
      url: `https://qurator.quobby.com/tutorials/${id}`,
      estimatedMinutes: demo.tutorial.estimated_minutes,
      ratingAvg: demo.tutorial.rating_avg,
      ratingCount: demo.tutorial.rating_count,
      steps: demo.steps.map((s) => s.heading),
    });
  } else {
    try {
      const supabase = await createClient();
      const { data: tutorial } = await supabase
        .from('tutorials')
        .select('title, description, cover_image_url, rating_avg, rating_count, estimated_minutes')
        .eq('id', id)
        .single();

      if (tutorial) {
        const { data: steps } = await supabase
          .from('tutorial_steps')
          .select('content_json')
          .eq('tutorial_id', id)
          .eq('step_type', 'content')
          .order('sort_order');

        const stepHeadings = (steps ?? [])
          .map((s) => (s.content_json as { heading?: string } | null)?.heading)
          .filter((h): h is string => !!h);

        jsonLd = buildHowToJsonLd({
          title: tutorial.title,
          description: tutorial.description,
          url: `https://qurator.quobby.com/tutorials/${id}`,
          imageUrl: tutorial.cover_image_url ?? undefined,
          estimatedMinutes: tutorial.estimated_minutes,
          ratingAvg: tutorial.rating_avg,
          ratingCount: tutorial.rating_count,
          steps: stepHeadings,
        });
      }
    } catch {
      // Structured data is best-effort
    }
  }

  const oembedUrl = `https://qurator.quobby.com/api/oembed?url=${encodeURIComponent(`https://qurator.quobby.com/tutorials/${id}`)}&format=json`;

  return (
    <>
      <link
        rel="alternate"
        type="application/json+oembed"
        href={oembedUrl}
        title="Qurator Tutorial"
      />
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
