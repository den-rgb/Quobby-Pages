import { ImageResponse } from 'next/og';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/tutorials?id=eq.${id}&select=title,description,estimated_minutes,rating_avg,rating_count,play_count,games(title)`,
    {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      next: { revalidate: 3600 },
    },
  );

  const rows = await res.json();
  const tut = Array.isArray(rows) ? rows[0] : null;
  if (!tut) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const gameTitle = tut.games?.title as string | undefined;

  const imageResponse = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(145deg, #0a0a14 0%, #12121e 50%, #1a0a14 100%)',
          fontFamily: 'Inter, -apple-system, sans-serif',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Accent glow bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '5px',
            background: 'linear-gradient(90deg, #a1306b, #c44f8a, #a1306b)',
          }}
        />

        {/* Decorative glow */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-50px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(161,48,107,0.15) 0%, transparent 70%)',
          }}
        />

        {/* Content area */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            height: '100%',
            padding: '48px 56px',
            position: 'relative',
          }}
        >
          {/* Top: logo + game badge */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'linear-gradient(135deg, #a1306b, #c44f8a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '18px', fontWeight: 800 }}>
                Q
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '18px', fontWeight: 700, color: '#c44f8a' }}>Qurator</span>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>by Quobby</span>
              </div>
            </div>
            {gameTitle && (
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#c44f8a',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                {gameTitle}
              </div>
            )}
          </div>

          {/* Middle: title + description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                fontSize: '44px',
                fontWeight: 800,
                color: '#ffffff',
                lineHeight: 1.15,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {tut.title}
            </div>
            {tut.description && (
              <div
                style={{
                  fontSize: '18px',
                  color: 'rgba(255,255,255,0.55)',
                  lineHeight: 1.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {tut.description}
              </div>
            )}
          </div>

          {/* Bottom: stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {tut.estimated_minutes > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', color: 'rgba(255,255,255,0.45)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {tut.estimated_minutes} min
              </div>
            )}
            {tut.rating_count > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', color: 'rgba(255,255,255,0.45)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#facc15" stroke="#facc15" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {tut.rating_avg.toFixed(1)}
              </div>
            )}
            {tut.play_count > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', color: 'rgba(255,255,255,0.45)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {tut.play_count} views
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );

  return new Response(imageResponse.body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      'CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
