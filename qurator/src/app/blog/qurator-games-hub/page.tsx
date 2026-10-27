import { TrackedLink } from '@/components/analytics/tracked-link';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, Gamepad2 } from 'lucide-react';

const articleUrl = 'https://qurator.quobby.com/blog/qurator-games-hub';
const articleDate = '2026-10-27';
const title = 'Meet Qurator Games: three fresh daily puzzles';
const description =
  'Qurator Games brings an original daily word puzzle, number challenge, and classic-style riddle together. Every player gets the same daily challenge, and you can choose just one mode.';

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'Qurator Games',
    'daily word puzzle',
    'five-letter word game',
    'daily number puzzle',
    'arithmetic puzzle game',
    'daily riddle game',
    'free online puzzle games',
  ],
  openGraph: {
    title,
    description,
    url: articleUrl,
    siteName: 'Qurator',
    type: 'article',
    publishedTime: `${articleDate}T00:00:00.000Z`,
    modifiedTime: `${articleDate}T00:00:00.000Z`,
    images: [{ url: '/app-icon.png', width: 512, height: 512, alt: 'Qurator Games' }],
  },
  twitter: { card: 'summary', title, description, images: ['/app-icon.png'] },
  alternates: { canonical: articleUrl },
};

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: title,
  description,
  image: ['https://qurator.quobby.com/app-icon.png'],
  datePublished: articleDate,
  dateModified: articleDate,
  author: { '@type': 'Organization', name: 'Qurator', url: 'https://qurator.quobby.com' },
  publisher: {
    '@type': 'Organization',
    name: 'Quobby',
    url: 'https://www.quobby.com',
    logo: { '@type': 'ImageObject', url: 'https://qurator.quobby.com/app-icon.png' },
  },
  mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://qurator.quobby.com' },
    { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://qurator.quobby.com/blog' },
    { '@type': 'ListItem', position: 3, name: title, item: articleUrl },
  ],
};

export default function QuratorGamesArticle() {
  return (
    <div className="px-5 sm:px-6 py-10 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([articleJsonLd, breadcrumbJsonLd]) }} />
      <article className="max-w-[780px] mx-auto">
        <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-foreground-faint hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Qurator Blog
        </Link>

        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-3">Product update</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight text-foreground">{title}</h1>
          <p className="text-lg text-foreground-muted leading-relaxed mt-5">{description}</p>
          <div className="flex items-center gap-2 text-xs text-foreground-faint mt-5">
            <CalendarDays className="w-3.5 h-3.5" />
            <time dateTime={articleDate}>October 27, 2026</time>
            <span aria-hidden="true">·</span>
            <span>Qurator</span>
          </div>
        </header>

        <div className="space-y-8 text-foreground-secondary leading-relaxed">
          <p>
            Qurator now has a home for a quick daily brain break. <strong className="text-foreground">Qurator Games</strong> brings three original puzzle modes together: a five-letter word deduction game, a numbers-to-target challenge, and a traditional-style riddle. The names, daily puzzle set, and presentation are made for Qurator.
          </p>

          <section aria-labelledby="letter-ledger">
            <h2 id="letter-ledger" className="text-2xl font-bold text-foreground mb-3">Letter Ledger: read the color counts</h2>
            <p>
              Guess a hidden five-letter word with no repeated letters. You have up to eight guesses and a clue to get started. After each guess, three counts show how your letters compare with the answer: green for letters in the correct positions, yellow for letters that belong elsewhere, and red for letters that are absent. It keeps the familiar satisfaction of narrowing down a word, with feedback you can scan at a glance.
            </p>
          </section>

          <section aria-labelledby="number-trail">
            <h2 id="number-trail" className="text-2xl font-bold text-foreground mb-3">Number Trail: make the target</h2>
            <p>
              Combine five displayed numbers with addition, subtraction, multiplication, division, and parentheses to reach the day’s target. Each number can be used at most once. Number Trail is untimed, so you can try expressions at your own pace or reveal a solution when you are ready.
            </p>
          </section>

          <section aria-labelledby="riddle-master">
            <h2 id="riddle-master" className="text-2xl font-bold text-foreground mb-3">Riddle Master: think sideways</h2>
            <p>
              Work through a short, classic-style riddle with up to five guesses. When the round ends, Qurator shows the answer so you can see how the clue fits together.
            </p>
          </section>

          <section aria-labelledby="same-daily-puzzle">
            <h2 id="same-daily-puzzle" className="text-2xl font-bold text-foreground mb-3">One shared challenge, your choice of mode</h2>
            <p>
              Each mode has one shared challenge for everyone on a given UTC date, changing at midnight UTC. You do not have to complete the full set: choose the word, number, or riddle game that sounds fun that day. Finishing any one mode counts toward the separate Qurator Games streak. Signed-in players can save their result to their Quobby profile and earn 25 XP for each mode once per day; guests can play first and see the profile prompt after a round.
            </p>
          </section>

          <section aria-labelledby="try-games">
            <h2 id="try-games" className="text-2xl font-bold text-foreground mb-3">Play today’s Qurator Games</h2>
            <p>
              Pick a mode, make your guesses, and compare notes without sharing the answer. You can come back tomorrow for a fresh shared challenge.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <TrackedLink
                href="/games"
                eventName="games_article_play_clicked"
                eventProperties={{ placement: 'qurator_games_article' }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-accent text-black font-semibold hover:bg-accent-light transition-colors"
              >
                <Gamepad2 className="w-4 h-4" /> Explore all games <ArrowRight className="w-4 h-4" />
              </TrackedLink>
              <TrackedLink
                href="/games/letter-ledger"
                eventName="game_selected"
                eventProperties={{ game: 'letter-ledger', placement: 'qurator_games_article' }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/[0.1] bg-white/[0.04] text-foreground font-semibold hover:bg-white/[0.08] transition-colors"
              >
                Try Letter Ledger <ArrowRight className="w-4 h-4" />
              </TrackedLink>
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}
