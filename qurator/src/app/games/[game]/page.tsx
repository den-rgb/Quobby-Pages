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
  return <GamePlayer key={game} game={game} />;
}
