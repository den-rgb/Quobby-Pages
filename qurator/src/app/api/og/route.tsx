import { ImageResponse } from 'next/og';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

async function fetchAsDataUri(url: string, timeoutMs = 3000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'Accept': 'image/*',
        'User-Agent': 'QuobbyQurator/1.0',
      },
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || 'image/png';
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 5 * 1024 * 1024) return null;
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return `data:${ct};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const host = request.headers.get('host') || 'qurator.quobby.com';
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const origin = `${proto}://${host}`;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/tutorials?id=eq.${id}&select=title,description,cover_image_url,estimated_minutes,rating_avg,rating_count,play_count,games(title,bgg_image_url)`,
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
  const rawArtUrl = (tut.cover_image_url || tut.games?.bgg_image_url) as string | null;

  const [iconData, artData] = await Promise.all([
    fetchAsDataUri(`${origin}/app-icon.png`, 2000),
    rawArtUrl ? fetchAsDataUri(rawArtUrl, 3000) : Promise.resolve(null),
  ]);

  const hasArt = !!artData;

  const imageResponse = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#0a0a14',
          fontFamily: 'Inter, -apple-system, sans-serif',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Blurred game art background */}
        {artData && (
          <img
            src={artData}
            width={1200}
            height={630}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(60px) brightness(0.15) saturate(1.4)',
            }}
          />
        )}

        {/* Large watermark app icon as background filler */}
        {iconData && (
          <img
            src={iconData}
            width={480}
            height={480}
            style={{
              position: 'absolute',
              top: '50%',
              left: '38%',
              transform: 'translate(-50%, -50%)',
              opacity: 0.06,
              borderRadius: '80px',
            }}
          />
        )}

        {/* Overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: hasArt
              ? 'rgba(10,10,20,0.6)'
              : 'linear-gradient(145deg, #0a0a14 0%, #12081a 50%, #1a0a14 100%)',
            display: 'flex',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            padding: '36px 44px',
            position: 'relative',
            gap: '32px',
          }}
        >
          {/* Left column */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              flex: 1,
              minWidth: 0,
            }}
          >
            {/* Brand — big and bold */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {iconData ? (
                <img
                  src={iconData}
                  width={72}
                  height={72}
                  style={{ borderRadius: '18px' }}
                />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: '18px', background: 'linear-gradient(135deg, #6b1d3a, #8b2252)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4cd964', fontSize: '36px', fontWeight: 900 }}>
                  Q
                </div>
              )}
              <span style={{ fontSize: '38px', fontWeight: 900, color: '#4cd964', letterSpacing: '-0.02em' }}>Qurator</span>
            </div>

            {/* Title in maroon box — fills middle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {gameTitle && (
                <span style={{ fontSize: '17px', fontWeight: 700, color: '#4cd964', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {gameTitle}
                </span>
              )}
              <div
                style={{
                  display: 'flex',
                  padding: '24px 32px',
                  background: 'rgba(107,29,58,0.55)',
                  border: '2.5px solid #6b1d3a',
                  borderRadius: '16px',
                }}
              >
                <span
                  style={{
                    fontSize: hasArt ? '46px' : '54px',
                    fontWeight: 900,
                    color: '#ffffff',
                    lineHeight: 1.12,
                    letterSpacing: '-0.025em',
                  }}
                >
                  {tut.title}
                </span>
              </div>
            </div>

            {/* Stat pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {tut.estimated_minutes > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '9px 18px',
                  borderRadius: '22px',
                  background: 'rgba(99,102,241,0.18)',
                  border: '1.5px solid rgba(99,102,241,0.4)',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#a5b4fc',
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {tut.estimated_minutes} min
                </div>
              )}
              {tut.rating_count > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '9px 18px',
                  borderRadius: '22px',
                  background: 'rgba(250,204,21,0.14)',
                  border: '1.5px solid rgba(250,204,21,0.4)',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#fde68a',
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="#facc15" stroke="#facc15" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  {tut.rating_avg.toFixed(1)}
                </div>
              )}
              {tut.play_count > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '9px 18px',
                  borderRadius: '22px',
                  background: 'rgba(52,211,153,0.14)',
                  border: '1.5px solid rgba(52,211,153,0.4)',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: '#6ee7b7',
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  {tut.play_count} views
                </div>
              )}
            </div>
          </div>

          {/* Right: artwork with green border */}
          {artData && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '290px',
                flexShrink: 0,
              }}
            >
              <img
                src={artData}
                width={270}
                height={380}
                style={{
                  objectFit: 'cover',
                  borderRadius: '16px',
                  border: '3.5px solid #4cd964',
                }}
              />
            </div>
          )}
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
