import { DEMO_CATEGORY_SLUGS, DEMO_TUTORIALS } from '@/lib/demo-tutorials';
import { createClient } from '@/lib/supabase/server';
import {
  hasWebFindings,
  recipeSearchName,
  resolveTutorialWebEntity,
  sameAsUrls,
} from '@/lib/web-entity';
import { cache } from 'react';

export type CatalogEntry = { title: string; tutorialId: string };

export type PublishedCatalog = {
  games: CatalogEntry[];
  recipes: CatalogEntry[];
};

function demoCatalog(): PublishedCatalog {
  const games: CatalogEntry[] = [];
  const recipes: CatalogEntry[] = [];
  const seenGames = new Set<string>();

  for (const [id, demo] of Object.entries(DEMO_TUTORIALS)) {
    const slug = demo.tutorial.category_id
      ? DEMO_CATEGORY_SLUGS[demo.tutorial.category_id]
      : undefined;
    const gameTitle = demo.tutorial.game?.title;
    if (gameTitle && !seenGames.has(gameTitle)) {
      seenGames.add(gameTitle);
      games.push({ title: gameTitle, tutorialId: id });
    }
    if (slug === 'cooking' && demo.tutorial.title) {
      recipes.push({ title: demo.tutorial.title, tutorialId: id });
    }
  }

  return { games, recipes };
}

export async function getPublishedCatalog(): Promise<PublishedCatalog> {
  const demos = demoCatalog();
  const games: CatalogEntry[] = [];
  const recipes: CatalogEntry[] = [];
  const seenGames = new Set<string>();
  const seenRecipes = new Set<string>();

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('tutorials')
      .select('id, title, games(title), categories(slug)')
      .eq('status', 'published')
      .order('play_count', { ascending: false })
      .limit(80);

    for (const row of data ?? []) {
      const game = row.games as unknown as { title: string } | null;
      const slug = (row.categories as unknown as { slug: string } | null)?.slug;
      if (game?.title && !seenGames.has(game.title)) {
        seenGames.add(game.title);
        games.push({ title: game.title, tutorialId: row.id });
      }
      if (slug === 'cooking' && row.title && !seenRecipes.has(row.title)) {
        seenRecipes.add(row.title);
        recipes.push({ title: row.title, tutorialId: row.id });
      }
    }
  } catch {
    // Fall through to demo catalog
  }

  for (const g of demos.games) {
    if (!seenGames.has(g.title)) {
      seenGames.add(g.title);
      games.push(g);
    }
  }
  for (const r of demos.recipes) {
    if (!seenRecipes.has(r.title)) {
      seenRecipes.add(r.title);
      recipes.push(r);
    }
  }

  return { games, recipes };
}

export function clipDescription(text: string, max = 300): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return `${(lastStop > 80 ? cut.slice(0, lastStop + 1) : cut).trim()}…`;
}

export function buildSeoDescription(opts: {
  tutorialTitle: string;
  gameTitle?: string;
  tutorialDescription?: string;
  webDescription?: string | null;
  gameDescription?: string | null;
  isRecipe?: boolean;
}): string {
  const findings = opts.webDescription || opts.gameDescription || '';
  const web = findings ? clipDescription(findings, 220) : '';
  if (opts.gameTitle) {
    const base = `Learn how to play ${opts.gameTitle} with this free interactive tutorial. ${opts.tutorialTitle}`;
    if (opts.tutorialDescription) return clipDescription(`${base} ${opts.tutorialDescription}`, 320);
    if (web) return clipDescription(`${base} ${web}`, 320);
    return `${base}. Step-by-step rules, setup guide, strategy tips, and recommendations.`;
  }
  if (opts.isRecipe) {
    const base = `Free interactive recipe tutorial: ${opts.tutorialTitle}.`;
    if (opts.tutorialDescription) return clipDescription(`${base} ${opts.tutorialDescription}`, 320);
    if (web) return clipDescription(`${base} ${web}`, 320);
    return `${base} Step-by-step cooking guide with ingredients and technique.`;
  }
  if (opts.tutorialDescription) return clipDescription(opts.tutorialDescription, 320);
  if (web) return web;
  return `${opts.tutorialTitle} - Free interactive step-by-step tutorial with quizzes and branching paths.`;
}

export function buildSeoKeywords(opts: {
  gameTitle?: string;
  categoryName?: string;
  isRecipe?: boolean;
  recipeName?: string;
  yearPublished?: number | null;
  minPlayers?: number;
  maxPlayers?: number;
}): string[] {
  const keywords: string[] = [];
  if (opts.gameTitle) {
    keywords.push(
      `how to play ${opts.gameTitle}`,
      `${opts.gameTitle} rules`,
      `${opts.gameTitle} tutorial`,
      `${opts.gameTitle} setup`,
      `${opts.gameTitle} strategy`,
      `learn ${opts.gameTitle}`,
      `${opts.gameTitle} board game`,
      `${opts.gameTitle} guide`,
      `${opts.gameTitle} for beginners`,
    );
    if (opts.yearPublished) keywords.push(`${opts.gameTitle} ${opts.yearPublished}`);
    if (opts.minPlayers && opts.maxPlayers) {
      keywords.push(`${opts.gameTitle} ${opts.minPlayers}-${opts.maxPlayers} players`);
    }
  }
  if (opts.isRecipe && opts.recipeName) {
    keywords.push(
      `${opts.recipeName} recipe`,
      `how to make ${opts.recipeName}`,
      `how to cook ${opts.recipeName}`,
      `${opts.recipeName} tutorial`,
      `${opts.recipeName} ingredients`,
    );
  }
  if (opts.categoryName) {
    keywords.push(
      `${opts.categoryName.toLowerCase()} tutorial`,
      `interactive ${opts.categoryName.toLowerCase()} guide`,
    );
  }
  keywords.push(
    'interactive tutorial',
    'step by step guide',
    'free tutorial',
    'online tutor',
    'find a tutor',
  );
  return keywords;
}

const INGREDIENT_LINE = /^[-*•]\s+(.+)$/;

export type IngredientStep = {
  heading?: string;
  body?: string;
  interactive?: { type?: string; items?: { label?: string }[] };
};

export function extractIngredientsFromContent(steps: IngredientStep[]): string[] {
  const found: string[] = [];
  for (const step of steps) {
    const heading = step.heading ?? '';
    const body = step.body ?? '';
    const inIngredientsSection = /ingredient/i.test(heading) || /ingredient/i.test(body);
    if (!inIngredientsSection) continue;
    if (step.interactive?.type === 'checklist') {
      for (const item of step.interactive.items ?? []) {
        const label = item.label?.replace(/\*\*/g, '').trim();
        if (label) found.push(label);
      }
    }
    for (const line of body.split('\n')) {
      const m = line.trim().match(INGREDIENT_LINE);
      if (m) found.push(m[1].replace(/\*\*/g, '').trim());
    }
  }
  return [...new Set(found)].filter(Boolean).slice(0, 30);
}

export type HowToJsonLdInput = {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  estimatedMinutes?: number;
  ratingAvg?: number;
  ratingCount?: number;
  steps?: string[];
  about?: Record<string, unknown>;
  sameAs?: string[];
};

export function buildHowToJsonLd(data: HowToJsonLdInput) {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: data.title,
    description: data.description,
    url: data.url,
    ...(data.imageUrl && { image: data.imageUrl }),
    ...(data.estimatedMinutes && { totalTime: `PT${data.estimatedMinutes}M` }),
    ...(data.about && { about: data.about }),
    ...(data.sameAs && data.sameAs.length > 0 && { sameAs: data.sameAs }),
  };

  if (data.ratingAvg && data.ratingCount && data.ratingCount > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: data.ratingAvg.toFixed(1),
      ratingCount: data.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (data.steps && data.steps.length > 0) {
    jsonLd.step = data.steps.map((heading, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: heading,
      url: `${data.url}#step-${i + 1}`,
    }));
  }

  return jsonLd;
}

export type GameJsonLdData = {
  title: string;
  bggId?: number | null;
  imageUrl?: string | null;
  minPlayers?: number;
  maxPlayers?: number;
  playTime?: number;
  yearPublished?: number | null;
  bggRating?: number | null;
  description?: string | null;
  sameAs?: string[];
};

export function buildGameJsonLd(game: GameJsonLdData, tutorialUrl: string) {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Game',
    name: game.title,
    url: tutorialUrl,
    gamePlatform: 'Tabletop',
    ...(game.imageUrl && { image: game.imageUrl }),
    ...(game.description && { description: clipDescription(game.description, 400) }),
    ...(game.minPlayers && {
      numberOfPlayers: {
        '@type': 'QuantitativeValue',
        minValue: game.minPlayers,
        ...(game.maxPlayers && { maxValue: game.maxPlayers }),
      },
    }),
    ...(game.playTime && { timeRequired: `PT${game.playTime}M` }),
    ...(game.yearPublished && { datePublished: String(game.yearPublished) }),
    ...(game.sameAs && game.sameAs.length > 0 && { sameAs: game.sameAs }),
  };

  if (game.bggRating && game.bggRating > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: game.bggRating.toFixed(1),
      bestRating: 10,
      worstRating: 1,
      ratingCount: 1,
    };
  }

  return jsonLd;
}

export function buildRecipeJsonLd(opts: {
  name: string;
  description: string;
  url: string;
  imageUrl?: string;
  estimatedMinutes?: number;
  instructions: string[];
  ingredients: string[];
  sameAs?: string[];
}) {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    ...(opts.imageUrl && { image: opts.imageUrl }),
    ...(opts.estimatedMinutes && { totalTime: `PT${opts.estimatedMinutes}M`, cookTime: `PT${opts.estimatedMinutes}M` }),
    ...(opts.sameAs && opts.sameAs.length > 0 && { sameAs: opts.sameAs }),
  };

  if (opts.ingredients.length > 0) {
    jsonLd.recipeIngredient = opts.ingredients;
  }

  if (opts.instructions.length > 0) {
    jsonLd.recipeInstructions = opts.instructions.map((name, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name,
      url: `${opts.url}#step-${i + 1}`,
    }));
  }

  return jsonLd;
}

export function buildBreadcrumbJsonLd(tutorialTitle: string, id: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://qurator.quobby.com' },
      { '@type': 'ListItem', position: 2, name: 'Tutorials', item: 'https://qurator.quobby.com/tutorials' },
      { '@type': 'ListItem', position: 3, name: tutorialTitle, item: `https://qurator.quobby.com/tutorials/${id}` },
    ],
  };
}

export function entityAbout(opts: {
  isRecipe: boolean;
  name: string;
  description?: string | null;
  sameAs: string[];
  imageUrl?: string | null;
}): Record<string, unknown> | undefined {
  if (!opts.name) return undefined;
  return {
    '@type': opts.isRecipe ? 'Recipe' : 'Game',
    name: opts.name,
    ...(opts.description && { description: clipDescription(opts.description, 400) }),
    ...(opts.imageUrl && { image: opts.imageUrl }),
    ...(opts.sameAs.length > 0 && { sameAs: opts.sameAs }),
    ...(!opts.isRecipe && { gamePlatform: 'Tabletop' }),
  };
}

export function catalogKeywords(catalog: PublishedCatalog): string[] {
  const keys: string[] = [];
  for (const g of catalog.games.slice(0, 25)) {
    keys.push(`how to play ${g.title}`, `${g.title} rules`, `${g.title} tutorial`);
  }
  for (const r of catalog.recipes.slice(0, 15)) {
    keys.push(`${r.title} recipe`, `how to make ${r.title}`);
  }
  return keys;
}

export const BASE_SITE_KEYWORDS = [
  'interactive tutorials',
  'online tutor',
  'find a tutor',
  'become a tutor',
  'tutoring platform',
  'tutor marketplace',
  'tutor lessons',
  'tutorial maker',
  'how to create tutorials',
  'board game tutorial',
  'how to play board games',
  'board game rules explained',
  'learn board games online',
  'step by step guide maker',
  'free tutorial creator',
  'interactive learning platform',
  'visual flow editor',
  'branching tutorials',
  'embeddable tutorials',
  'cooking tutorials',
  'recipe tutorials',
  'cooking guide',
  'step by step recipes',
  'DIY tutorials',
  'software tutorials',
  'community tutorials',
  'learn by doing',
];

export const BASE_BROWSE_KEYWORDS = [
  'find a tutor',
  'online tutors',
  'tutor lessons',
  'paid tutorials',
  'board game tutorials',
  'how to play board games',
  'board game rules',
  'learn board games',
  'cooking tutorials',
  'recipe guides',
  'interactive tutorials',
  'step by step guides',
  'board game strategy',
  'free tutorials',
  'interactive learning',
  'DIY tutorials',
  'software tutorials',
];

type GameRow = {
  title: string;
  bgg_id: number | null;
  bgg_image_url: string | null;
  min_players: number;
  max_players: number;
  play_time_minutes: number;
  year_published: number | null;
  bgg_rating: number | null;
  description?: string | null;
};

export type TutorialPageSeo = {
  pageTitle: string;
  description: string;
  keywords: string[];
  url: string;
  ogImages?: { url: string; width: number; height: number; alt: string }[];
  howTo: Record<string, unknown>;
  game: Record<string, unknown> | null;
  recipe: Record<string, unknown> | null;
  breadcrumb: Record<string, unknown>;
};

async function assembleTutorialSeo(input: {
  id: string;
  title: string;
  description: string;
  coverImageUrl?: string | null;
  estimatedMinutes?: number;
  ratingAvg?: number;
  ratingCount?: number;
  steps: IngredientStep[];
  isRecipe: boolean;
  categoryName?: string;
  game?: GameRow | null;
  useOgApi: boolean;
}): Promise<TutorialPageSeo> {
  const url = `https://qurator.quobby.com/tutorials/${input.id}`;
  const gameTitle = input.game?.title;
  const recipeName = input.isRecipe ? recipeSearchName(input.title) || input.title : undefined;
  const entity = await resolveTutorialWebEntity({
    isRecipe: input.isRecipe,
    bggId: input.game?.bgg_id,
    tutorialTitle: input.title,
  });
  const bggUrl = input.game?.bgg_id
    ? `https://boardgamegeek.com/boardgame/${input.game.bgg_id}`
    : null;
  const sameAs = sameAsUrls(entity, [bggUrl]);
  const webDescription = entity.description;
  const gameDescription = input.game?.description ?? null;
  const aboutName = input.isRecipe ? (recipeName ?? input.title) : gameTitle;
  const imageUrl = input.coverImageUrl || input.game?.bgg_image_url || undefined;
  const stepHeadings = input.steps.map((s) => s.heading).filter((h): h is string => !!h);
  const ingredients = input.isRecipe ? extractIngredientsFromContent(input.steps) : [];
  const seoDescription = buildSeoDescription({
    tutorialTitle: input.title,
    gameTitle: input.isRecipe ? undefined : gameTitle,
    tutorialDescription: input.description,
    webDescription,
    gameDescription: input.isRecipe ? undefined : gameDescription,
    isRecipe: input.isRecipe,
  });
  const pageTitle = gameTitle && !input.isRecipe
    ? `How to Play ${gameTitle} - ${input.title}`
    : input.title;
  const about = aboutName
    ? entityAbout({
      isRecipe: input.isRecipe,
      name: aboutName,
      description: webDescription || (input.isRecipe ? input.description : gameDescription),
      sameAs,
      imageUrl,
    })
    : undefined;

  const howTo = buildHowToJsonLd({
    title: input.title,
    description: seoDescription,
    url,
    imageUrl,
    estimatedMinutes: input.estimatedMinutes,
    ratingAvg: input.ratingAvg,
    ratingCount: input.ratingCount,
    steps: stepHeadings,
    about,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  });

  const gameJson = !input.isRecipe && gameTitle
    ? buildGameJsonLd({
      title: gameTitle,
      bggId: input.game?.bgg_id,
      imageUrl: input.game?.bgg_image_url,
      minPlayers: input.game?.min_players,
      maxPlayers: input.game?.max_players,
      playTime: input.game?.play_time_minutes,
      yearPublished: input.game?.year_published,
      bggRating: input.game?.bgg_rating,
      description: webDescription || gameDescription,
      sameAs,
    }, url)
    : null;

  const emitRecipe = input.isRecipe && (hasWebFindings(entity) || ingredients.length > 0);
  const recipeJson = emitRecipe
    ? buildRecipeJsonLd({
      name: recipeName ?? input.title,
      description: seoDescription,
      url,
      imageUrl,
      estimatedMinutes: input.estimatedMinutes,
      instructions: stepHeadings,
      ingredients,
      sameAs,
    })
    : null;

  return {
    pageTitle,
    description: seoDescription,
    keywords: buildSeoKeywords({
      gameTitle: input.isRecipe ? undefined : gameTitle,
      categoryName: input.categoryName,
      isRecipe: input.isRecipe,
      recipeName,
      yearPublished: input.game?.year_published,
      minPlayers: input.game?.min_players,
      maxPlayers: input.game?.max_players,
    }),
    url,
    ogImages: input.useOgApi
      ? [{ url: `https://qurator.quobby.com/api/og?id=${input.id}`, width: 1200, height: 630, alt: input.title }]
      : undefined,
    howTo,
    game: gameJson,
    recipe: recipeJson,
    breadcrumb: buildBreadcrumbJsonLd(input.title, input.id),
  };
}

export const getTutorialPageSeo = cache(async (id: string): Promise<TutorialPageSeo | null> => {
  const demo = DEMO_TUTORIALS[id];
  if (demo) {
    const slug = demo.tutorial.category_id
      ? DEMO_CATEGORY_SLUGS[demo.tutorial.category_id]
      : undefined;
    return assembleTutorialSeo({
      id,
      title: demo.tutorial.title,
      description: demo.tutorial.description,
      coverImageUrl: demo.tutorial.cover_image_url,
      estimatedMinutes: demo.tutorial.estimated_minutes,
      ratingAvg: demo.tutorial.rating_avg,
      ratingCount: demo.tutorial.rating_count,
      steps: demo.steps,
      isRecipe: slug === 'cooking',
      categoryName: slug === 'cooking' ? 'Cooking' : slug === 'board-games' ? 'Board Games' : undefined,
      game: demo.tutorial.game ?? null,
      useOgApi: false,
    });
  }

  try {
    const supabase = await createClient();
    const { data: tutorial } = await supabase
      .from('tutorials')
      .select('title, description, cover_image_url, rating_avg, rating_count, estimated_minutes, games(title, bgg_id, bgg_image_url, min_players, max_players, play_time_minutes, year_published, bgg_rating, description), categories(name, slug)')
      .eq('id', id)
      .single();

    if (!tutorial) return null;

    const { data: steps } = await supabase
      .from('tutorial_steps')
      .select('content_json')
      .eq('tutorial_id', id)
      .eq('step_type', 'content')
      .order('sort_order');

    const payloads = (steps ?? []).map((s) => (s.content_json ?? {}) as IngredientStep);
    const game = tutorial.games as unknown as GameRow | null;
    const category = tutorial.categories as unknown as { name: string; slug: string } | null;

    return assembleTutorialSeo({
      id,
      title: tutorial.title,
      description: tutorial.description,
      coverImageUrl: tutorial.cover_image_url,
      estimatedMinutes: tutorial.estimated_minutes,
      ratingAvg: tutorial.rating_avg,
      ratingCount: tutorial.rating_count,
      steps: payloads,
      isRecipe: category?.slug === 'cooking',
      categoryName: category?.name,
      game,
      useOgApi: true,
    });
  } catch {
    return null;
  }
});
