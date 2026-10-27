import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Gamepad2 } from 'lucide-react';

const articleUrl = 'https://qurator.quobby.com/blog/qurator-games-hub';
const articleDate = '2026-10-27';
const articleTitle = 'Meet Qurator Games: three fresh daily puzzles';
const articleDescription =
  'Discover Letter Ledger, Number Trail, and Riddle Master: three original daily puzzles with shared challenges for every Qurator player.';

export const metadata: Metadata = {
  title: 'Qurator Blog',
  description: 'News and guides from Qurator. Read about our original daily word, number, and riddle games.',
  keywords: ['Qurator blog', 'daily puzzle games', 'word puzzle', 'number puzzle', 'daily riddle'],
  openGraph: {
    title: 'Qurator Blog',
    description: 'News and guides from Qurator, including a closer look at our daily games.',
    url: 'https://qurator.quobby.com/blog',
    siteName: 'Qurator',
    type: 'website',
    images: [{ url: '/app-icon.png', width: 512, height: 512, alt: 'Qurator' }],
  },
  twitter: {
    card: 'summary',
    title: 'Qurator Blog',
    description: 'News and guides from Qurator.',
    images: ['/app-icon.png'],
  },
  alternates: { canonical: 'https://qurator.quobby.com/blog' },
};

const blogJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  name: 'Qurator Blog',
  url: 'https://qurator.quobby.com/blog',
  description: 'News and guides from Qurator.',
  blogPost: [
    {
      '@type': 'BlogPosting',
      headline: articleTitle,
      url: articleUrl,
      datePublished: articleDate,
      description: articleDescription,
    },
  ],
};

export default function BlogPage() {
  return (
    <div className="px-5 sm:px-6 py-12 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd) }} />
      <div className="max-w-[900px] mx-auto">
        <header className="mb-10 sm:mb-14">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-3">From Qurator</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground">The Qurator Blog</h1>
          <p className="text-foreground-muted text-base sm:text-lg mt-4 max-w-2xl leading-relaxed">
            Product updates, ideas, and guides for making learning and play more interactive.
          </p>
        </header>

        <article className="p-6 sm:p-8 rounded-3xl border border-white/[0.08] bg-white/[0.025]">
          <div className="flex items-center gap-2 text-xs text-foreground-faint mb-4">
            <CalendarDays className="w-3.5 h-3.5" />
            <time dateTime={articleDate}>October 27, 2026</time>
            <span aria-hidden="true">·</span>
            <span>Product update</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
            <Link href="/blog/qurator-games-hub" className="hover:text-accent transition-colors">
              {articleTitle}
            </Link>
          </h2>
          <p className="text-sm sm:text-base text-foreground-muted leading-relaxed mt-3 max-w-3xl">
            {articleDescription}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/blog/qurator-games-hub" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] text-sm font-semibold text-foreground hover:bg-white/10 transition-colors">
              Read the article <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/games" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-accent/20 bg-accent/[0.06] text-sm font-semibold text-foreground hover:bg-accent/10 transition-colors">
              <Gamepad2 className="w-4 h-4 text-accent" /> Play Qurator Games
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
