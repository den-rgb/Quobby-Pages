import type { Metadata } from 'next';
import { GamesHub } from '@/components/games/games-hub';

const gameModes = [
  {
    name: 'Letter Ledger',
    description: 'Find the shared five-letter answer with eight guesses, a clue, and green, yellow, and red letter counts.',
    url: 'https://qurator.quobby.com/games/letter-ledger',
  },
  {
    name: 'Number Trail',
    description: 'Use five numbers and arithmetic to reach the shared daily target without a timer.',
    url: 'https://qurator.quobby.com/games/number-trail',
  },
  {
    name: 'Riddle Master',
    description: 'Solve a traditional-style daily riddle in up to five guesses.',
    url: 'https://qurator.quobby.com/games/riddle-master',
  },
];

export const metadata: Metadata = {
  title: 'Daily Word, Number & Riddle Games',
  description: 'Play Qurator’s original daily word, number, and riddle games. Choose a mode; every player gets the same shared challenge each day.',
  keywords: [
    'daily word puzzle',
    'five-letter word game',
    'daily number puzzle',
    'arithmetic target game',
    'daily riddle game',
    'free online puzzle games',
  ],
  openGraph: {
    title: 'Qurator Games: Daily Word, Number & Riddle Puzzles',
    description: 'Choose an original daily word, number, or riddle challenge. The puzzle is shared with every player.',
    url: 'https://qurator.quobby.com/games',
    siteName: 'Qurator',
    type: 'website',
    images: [{ url: '/app-icon.png', width: 512, height: 512, alt: 'Qurator Games' }],
  },
  twitter: {
    card: 'summary',
    title: 'Qurator Games: Daily Word, Number & Riddle Puzzles',
    description: 'Choose an original daily word, number, or riddle challenge.',
    images: ['/app-icon.png'],
  },
  alternates: { canonical: 'https://qurator.quobby.com/games' },
};

export default function GamesPage() {
  const gamesJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Qurator Games: Daily Word, Number & Riddle Puzzles',
    description: 'Original daily word, number, and riddle games with one shared challenge for every player.',
    url: 'https://qurator.quobby.com/games',
    mainEntity: {
      '@type': 'ItemList',
      name: 'Daily Qurator puzzle games',
      itemListElement: gameModes.map((mode, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: mode.name,
        description: mode.description,
        url: mode.url,
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(gamesJsonLd) }} />
      <GamesHub />
    </>
  );
}
