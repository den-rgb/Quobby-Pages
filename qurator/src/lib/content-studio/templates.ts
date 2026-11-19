import type { CampaignInput, TemplateId } from './types';

export const CURATED_TEMPLATE_IDS = [
  'focus-blocker-problem-solution',
  'flashcards-before-exam',
  'study-streak-meme',
] as const satisfies readonly TemplateId[];

// Auto-generated stock memes are created by "Generate meme", not the manual template picker.
export const MEME_TEMPLATE_LABEL = 'Auto meme (stock clip + AI caption)';

export function templateLabel(id: TemplateId): string {
  return id === 'meme-classic' ? MEME_TEMPLATE_LABEL : CURATED_TEMPLATES.find((template) => template.id === id)?.label ?? id;
}

interface CuratedTemplate {
  id: TemplateId;
  label: string;
  description: string;
  requiredAssetLabels: readonly string[];
  defaultCopy: Pick<CampaignInput, 'title' | 'hook' | 'cta' | 'voiceText'>;
}

export const CURATED_TEMPLATES: readonly CuratedTemplate[] = [
  {
    id: 'focus-blocker-problem-solution',
    label: 'Focus blocker: problem → solution',
    description: 'Start with a distraction, show the focus blocker, and finish with a clear next step.',
    requiredAssetLabels: ['Focus blocker recording'],
    defaultCopy: {
      title: 'Make room for focused study',
      hook: 'One more scroll, or one focused study session?',
      cta: 'Start your next focus session with Quobby.',
      voiceText: 'When distractions get in the way, give yourself space to focus. Open Quobby, block the noise, and take your next study step.',
    },
  },
  {
    id: 'flashcards-before-exam',
    label: 'Flashcards before an exam',
    description: 'Turn the pre-exam scramble into a short flashcard study flow.',
    requiredAssetLabels: ['Flashcard recording'],
    defaultCopy: {
      title: 'A little practice before exam day',
      hook: 'Exam coming up? Start with one flashcard.',
      cta: 'Build your next revision session in Quobby.',
      voiceText: 'Break a big revision session into small steps. Work through your flashcards in Quobby, check what you remember, and keep practicing.',
    },
  },
  {
    id: 'study-streak-meme',
    label: 'Study streak meme',
    description: 'Pair a relatable study hook with progress and reward footage.',
    requiredAssetLabels: ['Study streak or reward recording'],
    defaultCopy: {
      title: 'The study streak continues',
      hook: 'Me: just five minutes. Also me: protecting my study streak.',
      cta: 'Keep your study habit going with Quobby.',
      voiceText: 'Small study sessions add up. Show up for a few minutes, make a little progress, and give yourself credit for keeping the habit going.',
    },
  },
];
