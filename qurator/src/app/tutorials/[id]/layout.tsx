import { getTutorialPageSeo } from '@/lib/seo';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const seo = await getTutorialPageSeo(id);
  if (!seo) return {};

  return {
    title: seo.pageTitle,
    description: seo.description,
    keywords: seo.keywords,
    openGraph: {
      title: seo.pageTitle,
      description: seo.description,
      url: seo.url,
      type: 'article',
      ...(seo.ogImages && { images: seo.ogImages }),
    },
    twitter: {
      card: seo.ogImages ? 'summary_large_image' : 'summary',
      title: seo.pageTitle,
      description: seo.description,
      ...(seo.ogImages && { images: [seo.ogImages[0].url] }),
    },
    alternates: { canonical: seo.url },
  };
}

export default async function TutorialLayout({ params, children }: Props) {
  const { id } = await params;
  const seo = await getTutorialPageSeo(id);
  const oembedUrl = `https://qurator.quobby.com/api/oembed?url=${encodeURIComponent(`https://qurator.quobby.com/tutorials/${id}`)}&format=json`;

  return (
    <>
      <link
        rel="alternate"
        type="application/json+oembed"
        href={oembedUrl}
        title="Qurator Tutorial"
      />
      {seo?.howTo && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.howTo) }}
        />
      )}
      {seo?.game && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.game) }}
        />
      )}
      {seo?.recipe && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.recipe) }}
        />
      )}
      {seo?.breadcrumb && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.breadcrumb) }}
        />
      )}
      {children}
    </>
  );
}
