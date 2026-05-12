import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const BGG_API = 'https://boardgamegeek.com/xmlapi2';
const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const CACHE_DURATION = 60 * 60 * 24;
const BING_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PREFERRED_IMG_DOMAINS = [
  'cf.geekdo-images.com',
  'boardgamegeek.com',
  'm.media-amazon.com',
  'amazon.com',
];

const BLOCKED_DOMAINS = [
  'i.ytimg.com', 'yt3.ggpht.com', 'youtube.com',
  'redd.it', 'preview.redd.it', 'i.redd.it', 'external-preview.redd.it',
  'pbs.twimg.com', 'fbcdn.net',
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

function bggHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/xml',
    'User-Agent': 'QuobbyQurator/1.0',
  };
  const token = process.env.BGG_API_TOKEN;
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;

  const query = request.nextUrl.searchParams.get('q');
  if (!query) {
    return NextResponse.json(
      { error: 'Missing query parameter' },
      { status: 400 },
    );
  }

  const bggResult = await tryBggSearch(query);
  if (bggResult) return enrichMissingImages(bggResult);

  const bingFallback = await tryBingFallbackSearch(query);
  if (bingFallback) return NextResponse.json(bingFallback);

  const wikiResult = await tryWikidataSearch(query);
  if (wikiResult) return enrichMissingImages(wikiResult);

  return NextResponse.json([]);
}

async function tryBggSearch(
  query: string,
): Promise<NextResponse | null> {
  try {
    const searchRes = await fetch(
      `${BGG_API}/search?query=${encodeURIComponent(query)}&type=boardgame`,
      { headers: bggHeaders(), next: { revalidate: CACHE_DURATION } },
    );

    if (!searchRes.ok) return null;

    const searchXml = await searchRes.text();
    const idMatches = [...searchXml.matchAll(/item.*?id="(\d+)"/g)]
      .slice(0, 10)
      .map((m) => m[1]);

    if (idMatches.length === 0) return NextResponse.json([]);

    const detailRes = await fetch(
      `${BGG_API}/thing?id=${idMatches.join(',')}&stats=1`,
      { headers: bggHeaders(), next: { revalidate: CACHE_DURATION } },
    );

    if (!detailRes.ok) return null;

    const xml = await detailRes.text();
    const items = [
      ...xml.matchAll(/<item.*?id="(\d+)".*?>([\s\S]*?)<\/item>/g),
    ];

    const results = items.map((match) => {
      const id = Number(match[1]);
      const body = match[2];

      const nameMatch = body.match(
        /<name\s+type="primary"\s+value="([^"]*?)"/,
      );
      const yearMatch = body.match(/<yearpublished\s+value="(\d+)"/);
      const imageMatch = body.match(/<image>(.*?)<\/image>/);
      const thumbMatch = body.match(/<thumbnail>(.*?)<\/thumbnail>/);
      const descMatch = body.match(
        /<description>([\s\S]*?)<\/description>/,
      );
      const minPMatch = body.match(/<minplayers\s+value="(\d+)"/);
      const maxPMatch = body.match(/<maxplayers\s+value="(\d+)"/);
      const timeMatch = body.match(/<playingtime\s+value="(\d+)"/);
      const weightMatch = body.match(
        /<averageweight\s+value="([^"]+)"/,
      );

      return {
        id,
        name: nameMatch?.[1] ?? '',
        year_published: yearMatch ? Number(yearMatch[1]) : null,
        image: imageMatch?.[1] ?? null,
        thumbnail: thumbMatch?.[1] ?? null,
        description: stripHtml(descMatch?.[1] ?? ''),
        min_players: Number(minPMatch?.[1] ?? 1),
        max_players: Number(maxPMatch?.[1] ?? 4),
        playing_time: Number(timeMatch?.[1] ?? 30),
        average_weight: Number(weightMatch?.[1] ?? 0),
      };
    });

    return NextResponse.json(results);
  } catch {
    return null;
  }
}

function sanitizeSparqlLiteral(input: string): string {
  return input
    .replace(/[\\"\n\r\t{}()]/g, '')
    .slice(0, 100)
    .trim();
}

async function tryWikidataSearch(
  query: string,
): Promise<NextResponse | null> {
  try {
    const safe = sanitizeSparqlLiteral(query.toLowerCase());
    if (!safe) return null;

    const sparql = `SELECT ?item ?bggId ?itemLabel ?image ?year WHERE {
      ?item wdt:P2339 ?bggId .
      ?item rdfs:label ?label .
      FILTER(LANG(?label) = "en")
      FILTER(CONTAINS(LCASE(?label), "${safe}"))
      OPTIONAL { ?item wdt:P18 ?image }
      OPTIONAL { ?item wdt:P577 ?date }
      BIND(YEAR(?date) AS ?year)
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 10`;

    const res = await fetch(
      `${WIKIDATA_SPARQL}?query=${encodeURIComponent(sparql)}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Qurator/1.0 (board game tutorial platform)',
        },
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!res.ok) return null;

    const data = await res.json();
    const bindings = data?.results?.bindings ?? [];

    if (bindings.length === 0) return null;

    const results = bindings.map(
      (b: Record<string, { value: string }>) => {
        const imageUri = b.image?.value ?? '';
        const filename = imageUri.includes('/Special:FilePath/')
          ? imageUri.split('/Special:FilePath/').pop()
          : null;
        const imageUrl = filename
          ? `https://commons.wikimedia.org/wiki/Special:FilePath/${filename}?width=400`
          : null;

        return {
          id: Number(b.bggId?.value ?? 0),
          name: b.itemLabel?.value ?? '',
          year_published: b.year?.value ? Number(b.year.value) : null,
          image: imageUrl,
          thumbnail: imageUrl,
          description: '',
          min_players: 1,
          max_players: 4,
          playing_time: 30,
          average_weight: 0,
        };
      },
    );

    return NextResponse.json(results);
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/&#10;/g, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
    .slice(0, 500);
}

async function enrichMissingImages(
  response: NextResponse,
): Promise<NextResponse> {
  try {
    const results = await response.json();
    if (!Array.isArray(results)) return NextResponse.json(results);

    const missing = results.filter(
      (r: { image?: string | null }) => !r.image,
    );
    if (missing.length === 0) return NextResponse.json(results);

    const enriched = await Promise.allSettled(
      missing
        .slice(0, 5)
        .map((r: { name: string }) => searchBingImage(r.name)),
    );

    const updates: { bggId: number; url: string }[] = [];
    let idx = 0;
    for (const r of enriched) {
      if (r.status === 'fulfilled' && r.value) {
        missing[idx].image = r.value;
        missing[idx].thumbnail = r.value;
        if (missing[idx].id) updates.push({ bggId: missing[idx].id, url: r.value });
      }
      idx++;
    }

    if (updates.length > 0) {
      persistEnrichedImages(updates).catch(() => { });
    }

    return NextResponse.json(results);
  } catch {
    return response;
  }
}

async function persistEnrichedImages(updates: { bggId: number; url: string }[]) {
  const supabase = await createClient();
  for (const { bggId, url } of updates) {
    const { data } = await supabase
      .from('games')
      .select('id')
      .eq('bgg_id', bggId)
      .maybeSingle();
    if (data?.id) {
      await supabase.rpc('update_game_image', { p_game_id: data.id, p_image_url: url });
    }
  }
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

async function searchBingForQuery(query: string): Promise<string[]> {
  const res = await fetch(
    `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&count=20&qft=+filterui:imagesize-medium`,
    {
      headers: { 'User-Agent': BING_UA },
      signal: AbortSignal.timeout(6000),
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

async function searchBingImage(title: string): Promise<string | null> {
  try {
    const bggUrls = await searchBingForQuery(
      `boardgamegeek.com "${title}" board game`,
    );
    const geekdoOnly = bggUrls.filter((u) => u.includes('cf.geekdo-images.com'));
    for (const url of geekdoOnly.slice(0, 6)) {
      if (await validateImageUrl(url)) return url;
    }

    const genericUrls = await searchBingForQuery(
      `"${title}" board game box cover -expansion -unboxing -review`,
    );
    const preferred = genericUrls.filter((u) =>
      PREFERRED_IMG_DOMAINS.some((d) => u.includes(d)),
    );
    const ordered = [...preferred, ...genericUrls.filter((u) => !preferred.includes(u))];
    for (const url of ordered.slice(0, 8)) {
      if (await validateImageUrl(url)) return url;
    }

    return null;
  } catch {
    return null;
  }
}

async function tryBingFallbackSearch(
  query: string,
): Promise<{ id: number; name: string; image: string | null; thumbnail: string | null; description: string; year_published: null; min_players: number; max_players: number; playing_time: number; average_weight: number }[] | null> {
  try {
    const image = await searchBingImage(query);
    if (!image) return null;
    return [{
      id: 0,
      name: query,
      image,
      thumbnail: image,
      description: '',
      year_published: null,
      min_players: 1,
      max_players: 4,
      playing_time: 30,
      average_weight: 0,
    }];
  } catch {
    return null;
  }
}
