export interface TutorialSearchDocument {
  title: string;
  description?: string | null;
  gameTitle?: string | null;
  categoryName?: string | null;
}

const GENERIC_SEARCH_TERMS = new Set([
  'a',
  'an',
  'for',
  'guide',
  'how',
  'learn',
  'make',
  'play',
  'recipe',
  'recipes',
  'the',
  'to',
  'tutorial',
  'tutorials',
]);

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function matchesTutorialSearch(tutorial: TutorialSearchDocument, query: string): boolean {
  const terms = normalize(query)
    .split(' ')
    .filter((term) => term && !GENERIC_SEARCH_TERMS.has(term));

  if (terms.length === 0) return true;

  const searchableText = normalize([
    tutorial.title,
    tutorial.description,
    tutorial.gameTitle,
    tutorial.categoryName,
  ].filter(Boolean).join(' '));

  return terms.every((term) => searchableText.includes(term));
}
