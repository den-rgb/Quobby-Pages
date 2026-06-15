import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const BGG_API = 'https://boardgamegeek.com/xmlapi2';

export async function POST() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: games, error: fetchErr } = await supabase
      .from('games')
      .select('id, bgg_id')
      .not('bgg_id', 'is', null)
      .is('bgg_rating', null);

    if (fetchErr || !games?.length) {
      return NextResponse.json({ updated: 0, message: fetchErr?.message ?? 'No games need backfill' });
    }

    const headers: Record<string, string> = {
      Accept: 'application/xml',
      'User-Agent': 'QuobbyQurator/1.0',
    };
    const token = process.env.BGG_API_TOKEN;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const uniqueIds = [...new Set(games.map((g) => g.bgg_id).filter((id): id is number => id != null))];
    const ratings = new Map<number, number>();
    const BATCH = 20;

    for (let i = 0; i < uniqueIds.length; i += BATCH) {
      const batch = uniqueIds.slice(i, i + BATCH);
      const res = await fetch(`${BGG_API}/thing?id=${batch.join(',')}&stats=1`, { headers });
      if (!res.ok) {
        const body = await res.text();
        return NextResponse.json({ error: `BGG API ${res.status}`, body: body.slice(0, 200) }, { status: 502 });
      }

      const xml = await res.text();
      const items = [...xml.matchAll(/<item[^>]*?id="(\d+)"[^>]*>([\s\S]*?)<\/item>/g)];
      for (const match of items) {
        const bggId = Number(match[1]);
        const ratingMatch = match[2].match(/<average\s+value="([^"]+)"/);
        if (ratingMatch) {
          const rating = Math.round(Number(ratingMatch[1]) * 10) / 10;
          if (rating > 0) ratings.set(bggId, rating);
        }
      }
    }

    let totalUpdated = 0;
    for (const game of games) {
      const rating = ratings.get(game.bgg_id);
      if (rating === undefined) continue;
      await supabase.from('games').update({ bgg_rating: rating }).eq('id', game.id);
      totalUpdated++;
    }

    return NextResponse.json({ updated: totalUpdated, total: games.length, parsed: ratings.size });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
