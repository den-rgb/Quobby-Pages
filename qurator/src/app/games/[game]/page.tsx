import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GamePlayer } from '@/components/games/game-player';
import { isGameKey } from '@/lib/games/challenges';
import type { GameKey } from '@/lib/games/types';

const descriptions: Record<GameKey, { title: string; description: string }> = {
  'letter-ledger': {
    title: 'Letter Ledger',
    description: 'Find today’s shared five-letter word in up to eight guesses. Every answer uses unique letters, with green, yellow, and red counts for feedback.',
  },
  'number-trail': {
    title: 'Number Trail',
    description: 'Use each of today’s five numbers at most once with arithmetic and parentheses to reach the target. Number Trail has no timer.',
  },
  'riddle-master': {
    title: 'Riddle Master',
    description: 'Solve a classic-style Qurator daily riddle in up to five guesses. The answer appears when the round ends.',
  },
};

const gameInstructions: Record<GameKey, { heading: string; intro: string; steps: string[] }> = {
  'letter-ledger': {
    heading: 'How to play Letter Ledger',
    intro: 'Letter Ledger is Qurator’s shared daily five-letter word challenge.',
    steps: [
      'Find the answer in up to eight guesses.',
      'Each guess shows green, yellow, and red letter counts to guide your next try.',
      'Everyone plays the same word for the day.',
    ],
  },
  'number-trail': {
    heading: 'How to play Number Trail',
    intro: 'Number Trail is an untimed daily arithmetic puzzle shared by every player.',
    steps: [
      'Use each of today’s five numbers at most once.',
      'Combine addition, subtraction, multiplication, division, and parentheses to reach the target.',
      'Keep trying until you find a valid expression or give up to reveal the solution.',
    ],
  },
  'riddle-master': {
    heading: 'How to play Riddle Master',
    intro: 'Riddle Master is Qurator’s shared daily classic-style riddle challenge.',
    steps: [
      'Read the daily riddle and make up to five guesses.',
      'Use each response to narrow down the answer.',
      'The answer appears when the round ends.',
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ game: string }> }): Promise<Metadata> {
  const { game } = await params;
  if (!isGameKey(game)) return { title: 'Daily Games' };
  const details = descriptions[game];
  return {
    title: details.title,
    description: details.description,
    keywords: [details.title, 'daily puzzle game', 'Qurator Games'],
    openGraph: {
      title: `${details.title} | Qurator Games`,
      description: details.description,
      url: `https://qurator.quobby.com/games/${game}`,
      siteName: 'Qurator',
      type: 'website',
      images: [{ url: '/app-icon.png', width: 512, height: 512, alt: `${details.title} by Qurator` }],
    },
    twitter: {
      card: 'summary',
      title: `${details.title} | Qurator Games`,
      description: details.description,
      images: ['/app-icon.png'],
    },
    alternates: { canonical: `https://qurator.quobby.com/games/${game}` },
  };
}

export default async function GamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (!isGameKey(game)) notFound();
  const instructions = gameInstructions[game];

  return (
    <>
      <GamePlayer key={game} game={game} />
      <section aria-labelledby={`how-to-play-${game}`} className="px-5 sm:px-6 pb-12 sm:pb-16">
        <div className="max-w-[760px] mx-auto p-6 sm:p-8 rounded-3xl border border-white/[0.07] bg-white/[0.025]">
          <h2 id={`how-to-play-${game}`} className="text-xl sm:text-2xl font-bold text-foreground">{instructions.heading}</h2>
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-foreground-muted">{instructions.intro}</p>
          <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm sm:text-base leading-relaxed text-foreground-muted">
            {instructions.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </div>
      </section>
    </>
  );
}
