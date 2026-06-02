import { NextRequest, NextResponse } from 'next/server';

const BGG_API = 'https://boardgamegeek.com/xmlapi2';

const CACHE_DURATION = 60 * 60 * 24;

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get('ids');
  if (!idsParam) {
    return NextResponse.json({ error: 'Missing ids parameter' }, { status: 400 });
  }

  const ids = idsParam.split(',').filter(Boolean).slice(0, 20);
  if (ids.length === 0) {
    return NextResponse.json([]);
  }

  try {
    const headers: Record<string, string> = {
      Accept: 'application/xml',
      'User-Agent': 'QuobbyQurator/1.0',
    };
    const token = process.env.BGG_API_TOKEN;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(
      `${BGG_API}/thing?id=${ids.join(',')}&stats=1`,
      {
        headers,
        next: { revalidate: CACHE_DURATION },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `BGG API returned ${res.status}` },
        { status: 502 }
      );
    }

    const xml = await res.text();
    const items = [...xml.matchAll(/<item.*?id="(\d+)".*?>([\s\S]*?)<\/item>/g)];

    const results = items.map((match) => {
      const id = Number(match[1]);
      const body = match[2];

      const nameMatch = body.match(/<name\s+type="primary"\s+value="([^"]*?)"/);
      const yearMatch = body.match(/<yearpublished\s+value="(\d+)"/);
      const imageMatch = body.match(/<image>(.*?)<\/image>/);
      const thumbMatch = body.match(/<thumbnail>(.*?)<\/thumbnail>/);
      const descMatch = body.match(/<description>([\s\S]*?)<\/description>/);
      const minPMatch = body.match(/<minplayers\s+value="(\d+)"/);
      const maxPMatch = body.match(/<maxplayers\s+value="(\d+)"/);
      const timeMatch = body.match(/<playingtime\s+value="(\d+)"/);
      const weightMatch = body.match(/<averageweight\s+value="([^"]+)"/);
      const ratingMatch = body.match(/<average\s+value="([^"]+)"/);

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
        bgg_rating: Math.round(Number(ratingMatch?.[1] ?? 0) * 10) / 10,
      };
    });

    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      { error: 'Failed to reach BGG API' },
      { status: 502 }
    );
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
