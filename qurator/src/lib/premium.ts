export const FREE_VIDEO_RAW_MAX_BYTES = 250 * 1024 * 1024;
export const PREMIUM_VIDEO_RAW_MAX_BYTES = 1024 * 1024 * 1024;

export function videoRawMaxBytes(isPremium: boolean): number {
  return isPremium ? PREMIUM_VIDEO_RAW_MAX_BYTES : FREE_VIDEO_RAW_MAX_BYTES;
}

export function videoRawMaxLabel(isPremium: boolean): string {
  return isPremium ? '1 GB' : '250 MB';
}

export const PREMIUM_FEATURES = [
  {
    category: 'Qurator',
    title: 'Up to 35% off tutorials',
    description: 'Get up to 35% off paid Qurator tutorials with Premium. T&C apply.',
  },
  {
    category: 'Qurator',
    title: 'Larger video uploads',
    description: 'Upload videos up to 1 GB (free users: 250 MB).',
  },
  {
    category: 'Qurator',
    title: 'Video splitting',
    description: 'Split long videos into segments, each becoming its own tutorial step.',
  },
  {
    category: 'Qurator',
    title: 'Tutorial analytics',
    description: 'See play counts, ratings, and trends for every tutorial you publish.',
  },
  {
    category: 'Quobby App',
    title: 'Unlimited decks & cards',
    description: 'Create as many flashcard decks and cards as you need.',
  },
  {
    category: 'Quobby App',
    title: 'Cloud sync',
    description: 'Sync your data across all your devices.',
  },
  {
    category: 'Quobby App',
    title: 'AI vocabulary generation',
    description: 'AI-powered sentence and vocabulary flashcard generation for language decks.',
  },
  {
    category: 'Quobby App',
    title: 'Unlimited document scans',
    description: 'Scan and store unlimited documents with 50 MB uploads.',
  },
  {
    category: 'Quobby App',
    title: 'AI document flashcards',
    description: 'Auto-generate flashcards from scanned documents using AI.',
  },
  {
    category: 'Quobby App',
    title: 'Import decks',
    description: 'Import flashcards from Anki, Quizlet, CSV, and JSON.',
  },
  {
    category: 'Quobby App',
    title: 'Profile customization',
    description: 'Custom avatar and name colors.',
  },
  {
    category: 'Quobby App',
    title: 'Streak saves & shields',
    description: '3 streak saves and 3 streak shields to protect your progress.',
  },
] as const;
