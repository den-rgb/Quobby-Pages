import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const BGG_API = 'https://boardgamegeek.com/xmlapi2';
const UA = 'Qurator/1.0 (board game tutorial platform)';
const BING_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: games, error } = await supabase
      .from('games')
      .select('*, tutorials(id)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = (games ?? []).filter(
      (g) => g.bgg_id != null || (g.tutorials && g.tutorials.length > 0),
    );

    const hasWeakImage = (url: string | null) =>
      !url ||
      url.includes('wikimedia') ||
      url.includes('wikipedia') ||
      url.includes('/0x0/') ||
      url.includes('ytimg.com') ||
      url.includes('youtube.com') ||
      url.includes('redd.it') ||
      url.includes('__square');

    const needsImage = list.filter(
      (g) => hasWeakImage(g.bgg_image_url) && g.bgg_id != null,
    );

    if (needsImage.length > 0) {
      // Tier 1: BGG API (primary source, requires token)
      const bggMap = await fetchBggImages(
        needsImage.map((g) => g.bgg_id!),
      );
      applyImages(needsImage, bggMap, supabase);

      // Tier 2: Bing Image Search (fallback for missing)
      const afterBgg = needsImage.filter((g) => !g.bgg_image_url);
      if (afterBgg.length > 0) {
        const bingMap = await fetchBingImages(afterBgg);
        applyImages(afterBgg, bingMap, supabase);
      }

      // Tier 3: Wikidata SPARQL (batch, fast)
      const afterBing = needsImage.filter((g) => !g.bgg_image_url);
      if (afterBing.length > 0) {
        const wikidataMap = await fetchWikidataImages(
          afterBing.map((g) => g.bgg_id!),
        );
        applyImages(afterBing, wikidataMap, supabase);
      }

      // Tier 4: Wikimedia Commons + Wikipedia articles
      const afterWikidata = needsImage.filter((g) => !g.bgg_image_url);
      if (afterWikidata.length > 0) {
        const wikimediaMap = await fetchWikimediaImages(afterWikidata);
        applyImages(afterWikidata, wikimediaMap, supabase);
      }
    }

    const cleaned = list.map(({ tutorials: _t, ...rest }) => rest);

    return NextResponse.json(cleaned, {
      headers: {
        'Cache-Control':
          'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyImages(games: any[], imageMap: Map<number, string>, supabase: any) {
  for (const game of games) {
    const url = imageMap.get(game.bgg_id!);
    if (url) {
      game.bgg_image_url = url;
      supabase
        .rpc('update_game_image', { p_game_id: game.id, p_image_url: url })
        .then(({ error }: { error: unknown }) => {
          if (error) {
            supabase
              .from('games')
              .update({ bgg_image_url: url })
              .eq('id', game.id)
              .then(() => { });
          }
        });
    }
  }
}

/* ── Tier 1: Bing Image Search (no API key) ── */

const PREFERRED_DOMAINS = [
  'cf.geekdo-images.com',
  'boardgamegeek.com',
  'm.media-amazon.com',
  'amazon.com',
];

const BLOCKED_DOMAINS = [
  'i.ytimg.com',
  'yt3.ggpht.com',
  'youtube.com',
  'redd.it',
  'preview.redd.it',
  'i.redd.it',
  'external-preview.redd.it',
  'pbs.twimg.com',
  'fbcdn.net',
];

const BLOCKED_PATH_KEYWORDS = [
  'expansion', 'promo', 'miniature', 'figurine', 'unboxing',
  'review', 'sleeve', 'insert', 'organizer', 'playmat',
  'kickstarter', 'pledge', 'addon', 'add-on', 'upgrade',
  'nesting', 'storage', 'component', 'deluxe', 'collector',
  'accessories', 'dice-tower', 'meeple', 'overlay',
];

function isCleanBoxArtUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (BLOCKED_DOMAINS.some((d) => lower.includes(d))) return false;
  if (BLOCKED_PATH_KEYWORDS.some((kw) => lower.includes(kw))) return false;
  if (lower.includes('/0x0/')) return false;
  return true;
}

async function fetchBingImages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  games: any[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const BATCH = 4;

  for (let i = 0; i < games.length; i += BATCH) {
    const batch = games.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map((g) => searchBingImage(g.title, g.bgg_id!)),
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        map.set(r.value[0], r.value[1]);
      }
    }
    if (i + BATCH < games.length) await delay(200);
  }

  return map;
}

async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': BING_UA },
      signal: AbortSignal.timeout(4000),
    });
    const ct = res.headers.get('content-type') ?? '';
    return res.ok && ct.startsWith('image/');
  } catch {
    return false;
  }
}

async function searchBingForQuery(
  query: string,
): Promise<string[]> {
  const res = await fetch(
    `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&count=20&qft=+filterui:imagesize-medium`,
    {
      headers: { 'User-Agent': BING_UA },
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!res.ok) return [];

  const html = await res.text();
  const urls: string[] = [];
  const pattern = /murl&quot;:&quot;(https?:\/\/[^&]+?)&quot;/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    if (isCleanBoxArtUrl(m[1])) urls.push(m[1]);
  }
  return urls;
}

async function pickBestImage(urls: string[]): Promise<string | null> {
  if (urls.length === 0) return null;

  const preferred = urls.filter((u) =>
    PREFERRED_DOMAINS.some((d) => u.includes(d)),
  );
  const ordered = [...preferred, ...urls.filter((u) => !preferred.includes(u))];

  for (const url of ordered.slice(0, 8)) {
    if (await validateImageUrl(url)) return url;
  }
  return null;
}

async function searchBingImage(
  title: string,
  bggId: number,
): Promise<[number, string] | null> {
  try {
    const bggQuery = `boardgamegeek.com "${title}" board game`;
    const bggUrls = await searchBingForQuery(bggQuery);
    const geekdoOnly = bggUrls.filter((u) => u.includes('cf.geekdo-images.com'));
    const bggResult = await pickBestImage(geekdoOnly);
    if (bggResult) return [bggId, bggResult];

    const genericQuery = `"${title}" board game box cover -expansion -unboxing -review`;
    const genericUrls = await searchBingForQuery(genericQuery);
    const genericResult = await pickBestImage(genericUrls);
    if (genericResult) return [bggId, genericResult];

    return null;
  } catch {
    return null;
  }
}

/* ── Tier 2: Wikidata SPARQL ── */

async function fetchWikidataImages(
  bggIds: number[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (bggIds.length === 0) return map;

  const values = bggIds.map((id) => `"${id}"`).join(' ');
  const query = `SELECT ?bggId ?image WHERE {
    ?item wdt:P2339 ?bggId .
    ?item wdt:P18 ?image .
    VALUES ?bggId { ${values} }
  }`;

  try {
    const res = await fetch(
      `${WIKIDATA_SPARQL}?query=${encodeURIComponent(query)}`,
      {
        headers: { Accept: 'application/json', 'User-Agent': UA },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) return map;

    const data = await res.json();
    for (const b of data?.results?.bindings ?? []) {
      const bggId = Number(b.bggId?.value);
      const imageUri: string = b.image?.value ?? '';
      if (!bggId || !imageUri) continue;

      const filename = imageUri.split('/Special:FilePath/').pop();
      if (filename) {
        map.set(
          bggId,
          `https://commons.wikimedia.org/wiki/Special:FilePath/${filename}?width=400`,
        );
      }
    }
  } catch {
    // Wikidata unreachable
  }
  return map;
}

/* ── Tier 3+4: Combined Wikimedia search (Commons + Wikipedia) ── */

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWikimediaImages(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  games: any[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>();

  for (const g of games) {
    const result = await searchAllWikimedia(g.title, g.bgg_id!);
    if (result) map.set(result[0], result[1]);
    if (games.length > 1) await delay(300);
  }

  return map;
}

async function searchAllWikimedia(
  title: string,
  bggId: number,
): Promise<[number, string] | null> {
  const commonsResult = await searchCommonsForGame(title, bggId);
  if (commonsResult) return commonsResult;

  await delay(200);

  return searchWikipediaImage(title, bggId);
}

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[:()'!?.,"]/g, '')
    .replace(/[_\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCoreName(title: string): string {
  const stripped = title.replace(/\s*[:(].*$/, '').trim();
  return stripped.length >= 3 ? stripped : title;
}

async function searchCommonsForGame(
  title: string,
  bggId: number,
): Promise<[number, string] | null> {
  const searchVariants = [
    `${title} board game`,
    `${extractCoreName(title)} board game`,
  ];

  for (const searchTerm of searchVariants) {
    const result = await tryCommonsSearch(searchTerm, title, bggId);
    if (result) return result;
  }
  return null;
}

async function tryCommonsSearch(
  searchTerm: string,
  title: string,
  bggId: number,
): Promise<[number, string] | null> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrnamespace: '6',
      gsrsearch: searchTerm,
      gsrlimit: '5',
      prop: 'imageinfo',
      iiprop: 'url|mime',
      iiurlwidth: '400',
      format: 'json',
      origin: '*',
    });

    const res = await fetch(`${COMMONS_API}?${params}`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;

    const normalTitle = normalizeForMatch(title);
    const coreName = normalizeForMatch(extractCoreName(title));
    const sorted = Object.values(pages).sort(
      (a: unknown, b: unknown) =>
        ((a as { index: number }).index ?? 0) -
        ((b as { index: number }).index ?? 0),
    );

    const gameKeywords = ['board game', 'card game', 'tabletop', 'brettspiel', 'jeu de'];
    for (const page of sorted) {
      const p = page as {
        title?: string;
        imageinfo?: { thumburl?: string; mime?: string }[];
      };
      const fname = normalizeForMatch(p.title ?? '');
      const info = p.imageinfo?.[0];

      if (!info?.thumburl || !info.mime?.startsWith('image/')) continue;
      if (info.mime === 'image/svg+xml') continue;

      const hasGameName = fname.includes(normalTitle) || fname.includes(coreName);
      const hasGameKeyword = gameKeywords.some((kw) => fname.includes(kw));

      if (!hasGameName || !hasGameKeyword) continue;

      return [bggId, info.thumburl];
    }
  } catch {
    // Commons unreachable
  }
  return null;
}

async function searchWikipediaImage(
  title: string,
  bggId: number,
): Promise<[number, string] | null> {
  const coreName = extractCoreName(title);
  const variants = [
    `${title.replace(/ /g, '_')}_(board_game)`,
    `${coreName.replace(/ /g, '_')}_(board_game)`,
    `${title.replace(/ /g, '_')}_(game)`,
    title.replace(/ /g, '_'),
  ];

  try {
    const titlesParam = variants.join('|');
    const articleRes = await fetch(
      `${WIKIPEDIA_API}?action=query&titles=${encodeURIComponent(titlesParam)}&prop=images&format=json&imlimit=10`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) },
    );
    if (!articleRes.ok) return null;

    const articleData = await articleRes.json();
    const pages = articleData?.query?.pages ?? {};

    const imageFiles: string[] = [];
    const normalName = normalizeForMatch(title);
    const normalCore = normalizeForMatch(coreName);

    for (const page of Object.values(pages)) {
      const p = page as { pageid?: number; images?: { title: string }[] };
      if (!p.pageid || p.pageid < 0) continue;
      for (const img of p.images ?? []) {
        const fname = normalizeForMatch(img.title);
        if (
          fname.endsWith('.svg') ||
          fname.includes('icon') ||
          fname.includes('logo') ||
          fname.includes('commons-logo')
        ) continue;
        const hasName = fname.includes(normalName) || fname.includes(normalCore);
        const hasGameWord =
          fname.includes('game') ||
          fname.includes('board') ||
          fname.includes('box') ||
          fname.includes('cover');
        if (hasName && hasGameWord) {
          imageFiles.push(img.title);
        }
      }
    }

    if (imageFiles.length === 0) return null;

    const fileParam = imageFiles.slice(0, 3).join('|');
    const infoRes = await fetch(
      `${WIKIPEDIA_API}?action=query&titles=${encodeURIComponent(fileParam)}&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) },
    );
    if (!infoRes.ok) return null;

    const infoData = await infoRes.json();
    const infoPages = infoData?.query?.pages ?? {};

    for (const p of Object.values(infoPages)) {
      const fp = p as {
        imageinfo?: { thumburl?: string; url?: string }[];
      };
      const thumbUrl = fp.imageinfo?.[0]?.thumburl || fp.imageinfo?.[0]?.url;
      if (thumbUrl) return [bggId, thumbUrl];
    }
  } catch {
    // Wikipedia unreachable
  }
  return null;
}

/* ── Tier 1: BGG API (primary) ── */

async function fetchBggImages(
  bggIds: number[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (bggIds.length === 0) return map;

  const headers: Record<string, string> = {
    Accept: 'application/xml',
    'User-Agent': 'QuobbyQurator/1.0',
  };
  const token = process.env.BGG_API_TOKEN;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const BATCH_SIZE = 20;
  for (let i = 0; i < bggIds.length; i += BATCH_SIZE) {
    const batch = bggIds.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(
        `${BGG_API}/thing?id=${batch.join(',')}`,
        { headers, signal: AbortSignal.timeout(15000) },
      );
      if (!res.ok) continue;

      const xml = await res.text();
      for (const match of xml.matchAll(
        /<item.*?id="(\d+)".*?>([\s\S]*?)<\/item>/g,
      )) {
        const id = Number(match[1]);
        const imgMatch = match[2].match(/<image>(.*?)<\/image>/);
        if (imgMatch?.[1]) map.set(id, imgMatch[1]);
      }
    } catch {
      // BGG unreachable for this batch
    }
    if (i + BATCH_SIZE < bggIds.length) await delay(300);
  }

  return map;
}
