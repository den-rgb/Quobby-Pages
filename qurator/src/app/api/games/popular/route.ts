import { POPULAR_BGG_IDS } from '@/lib/popular-games';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const BGG_API = 'https://boardgamegeek.com/xmlapi2';
const BGG_CACHE_SECONDS = 60 * 60 * 6; // 6 hours

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [dbResult, bggResult] = await Promise.allSettled([
      fetchDbGames(supabase),
      fetchBggPopular(),
    ]);

    const dbGames = dbResult.status === 'fulfilled' ? dbResult.value : [];
    const bggGames = bggResult.status === 'fulfilled' ? bggResult.value : [];

    const bggLookup = new Map<number, GameRow>();
    for (const bg of bggGames) bggLookup.set(bg.bgg_id!, bg);

    const seenBggIds = new Set<number>();
    const merged: GameRow[] = [];

    for (const g of dbGames) {
      if (g.bgg_id) {
        const bgg = bggLookup.get(g.bgg_id);
        if (bgg) {
          if (!g.bgg_image_url) g.bgg_image_url = bgg.bgg_image_url;
          if (!g.bgg_rating) g.bgg_rating = bgg.bgg_rating;
        }
        seenBggIds.add(g.bgg_id);
      }
      merged.push(g);
    }

    for (const bg of bggGames) {
      if (!seenBggIds.has(bg.bgg_id!)) {
        seenBggIds.add(bg.bgg_id!);
        merged.push(bg);
      }
    }

    // Batch-fetch BGG details for DB games still missing ratings
    const needsEnrich = merged.filter(
      (g) => g.bgg_id && !g.bgg_rating && !bggLookup.has(g.bgg_id),
    );
    if (needsEnrich.length > 0) {
      const extraIds = needsEnrich.map((g) => g.bgg_id!);
      const extra = await fetchBggByIds(extraIds);
      for (const eg of extra) {
        const target = merged.find((g) => g.bgg_id === eg.bgg_id);
        if (target) {
          if (!target.bgg_rating) target.bgg_rating = eg.bgg_rating;
          if (!target.bgg_image_url) target.bgg_image_url = eg.bgg_image_url;
        }
      }
    }

    return NextResponse.json(merged, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

interface GameRow {
  id: string;
  title: string;
  bgg_id: number | null;
  bgg_image_url: string | null;
  bgg_rating: number | null;
  description: string;
  complexity: number;
  min_players: number;
  max_players: number;
  play_time_minutes: number;
  year_published: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchDbGames(supabase: any): Promise<GameRow[]> {
  const { data: games, error } = await supabase
    .from('games')
    .select('id, title, bgg_id, bgg_image_url, bgg_rating, description, complexity, min_players, max_players, play_time_minutes, year_published, tutorials(id)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !games) return [];

  return (games as (GameRow & { tutorials: { id: string }[] })[])
    .filter((g) => g.bgg_id != null || (g.tutorials && g.tutorials.length > 0))
    .map(({ tutorials: _t, ...rest }) => rest);
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

function complexityFromWeight(weight: number): number {
  if (weight < 1.5) return 1;
  if (weight < 2.5) return 2;
  if (weight < 3.5) return 3;
  if (weight < 4.5) return 4;
  return 5;
}

async function fetchBggPopular(): Promise<GameRow[]> {
  if (POPULAR_BGG_IDS.length === 0) return [];
  return fetchBggByIds(POPULAR_BGG_IDS);
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

function parseBggItems(xml: string): GameRow[] {
  const items = [...xml.matchAll(/<item.*?id="(\d+)".*?>([\s\S]*?)<\/item>/g)];

  return items.map((match) => {
    const bggId = Number(match[1]);
    const body = match[2];

    const nameMatch = body.match(/<name\s+type="primary"\s+value="([^"]*?)"/);
    const yearMatch = body.match(/<yearpublished\s+value="(\d+)"/);
    const imageMatch = body.match(/<image>(.*?)<\/image>/);
    const descMatch = body.match(/<description>([\s\S]*?)<\/description>/);
    const minPMatch = body.match(/<minplayers\s+value="(\d+)"/);
    const maxPMatch = body.match(/<maxplayers\s+value="(\d+)"/);
    const timeMatch = body.match(/<playingtime\s+value="(\d+)"/);
    const weightMatch = body.match(/<averageweight\s+value="([^"]+)"/);
    const ratingMatch = body.match(/<average\s+value="([^"]+)"/);

    return {
      id: `bgg-${bggId}`,
      title: nameMatch?.[1] ?? '',
      bgg_id: bggId,
      bgg_image_url: imageMatch?.[1] ?? null,
      bgg_rating: Math.round(Number(ratingMatch?.[1] ?? 0) * 10) / 10 || null,
      description: stripHtml(descMatch?.[1] ?? ''),
      complexity: complexityFromWeight(Number(weightMatch?.[1] ?? 0)),
      min_players: Number(minPMatch?.[1] ?? 1),
      max_players: Number(maxPMatch?.[1] ?? 4),
      play_time_minutes: Number(timeMatch?.[1] ?? 30),
      year_published: yearMatch ? Number(yearMatch[1]) : null,
    };
  });
}

async function fetchBggByIds(ids: number[]): Promise<GameRow[]> {
  if (ids.length === 0) return [];

  try {
    const BATCH = 20;
    const results: GameRow[] = [];

    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const res = await fetch(
        `${BGG_API}/thing?id=${batch.join(',')}&stats=1`,
        { headers: bggHeaders(), next: { revalidate: BGG_CACHE_SECONDS } },
      );
      if (res.ok) {
        results.push(...parseBggItems(await res.text()));
      }
    }

    return results;
  } catch {
    return [];
  }
}
