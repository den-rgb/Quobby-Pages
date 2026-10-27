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
      {seo && (
        <article className="max-w-4xl mx-auto px-6 pt-12 pb-2 text-foreground-secondary">
          <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase mb-3">Interactive tutorial</p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">{seo.intro.title}</h1>
          <p className="text-lg leading-relaxed max-w-3xl">{seo.intro.description}</p>
          {seo.intro.firstStep && (
            <section className="mt-8 max-w-3xl border-l-2 border-accent/50 pl-5">
              <h2 className="text-xl font-semibold text-foreground mb-2">{seo.intro.firstStep.heading}</h2>
              <p className="leading-relaxed whitespace-pre-line">{seo.intro.firstStep.body}</p>
            </section>
          )}
        </article>
      )}
      {children}
    </>
  );
}
