import { ImageResponse } from 'next/og';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

async function fetchAsDataUri(url: string, timeoutMs = 4000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Accept': 'image/*' },
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || 'image/png';
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 2 * 1024 * 1024) return null;
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
    fetchAsDataUri(`${origin}/app-icon.png`, 3000),
    rawArtUrl ? fetchAsDataUri(rawArtUrl, 4000) : Promise.resolve(null),
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
        {/* Blurred background art */}
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
              filter: 'blur(50px) brightness(0.25) saturate(1.6)',
            }}
          />
        )}

        {/* Dark scrim */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: hasArt
              ? 'linear-gradient(135deg, rgba(10,10,20,0.82) 0%, rgba(10,10,20,0.65) 50%, rgba(10,10,20,0.82) 100%)'
              : 'linear-gradient(145deg, #0a0a14 0%, #14102a 50%, #1a0a14 100%)',
            display: 'flex',
          }}
        />

        {/* Top accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '5px',
            background: 'linear-gradient(90deg, #a1306b, #c44f8a, #e060a0, #c44f8a, #a1306b)',
          }}
        />

        {/* Decorative glow orbs */}
        <div style={{ position: 'absolute', top: '-80px', left: '-40px', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(161,48,107,0.2) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '-60px', right: '200px', width: '250px', height: '250px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(100,40,160,0.12) 0%, transparent 70%)' }} />

        {/* Main layout */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            padding: '44px 52px',
            position: 'relative',
            gap: '40px',
          }}
        >
          {/* Left column: text */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              flex: 1,
              minWidth: 0,
            }}
          >
            {/* Brand row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {iconData ? (
                <img
                  src={iconData}
                  width={44}
                  height={44}
                  style={{ borderRadius: '12px', border: '2px solid rgba(255,255,255,0.1)' }}
                />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'linear-gradient(135deg, #a1306b, #c44f8a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '22px', fontWeight: 800, border: '2px solid rgba(255,255,255,0.1)' }}>
                  Q
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>Qurator</span>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>by Quobby</span>
              </div>
            </div>

            {/* Title block */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {gameTitle && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '3px', height: '16px', borderRadius: '2px', background: '#c44f8a' }} />
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#c44f8a', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                    {gameTitle}
                  </span>
                </div>
              )}
              <div
                style={{
                  fontSize: hasArt ? '40px' : '48px',
                  fontWeight: 800,
                  color: '#ffffff',
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {tut.title}
              </div>
              {tut.description && (
                <div
                  style={{
                    fontSize: '17px',
                    color: 'rgba(255,255,255,0.5)',
                    lineHeight: 1.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxHeight: '52px',
                  }}
                >
                  {tut.description}
                </div>
              )}
            </div>

            {/* Stat badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {tut.estimated_minutes > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  background: 'rgba(99,102,241,0.15)',
                  border: '1px solid rgba(99,102,241,0.25)',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#a5b4fc',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                  padding: '8px 16px',
                  borderRadius: '20px',
                  background: 'rgba(250,204,21,0.12)',
                  border: '1px solid rgba(250,204,21,0.25)',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#fde68a',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#facc15" stroke="#facc15" strokeWidth="2">
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
                  padding: '8px 16px',
                  borderRadius: '20px',
                  background: 'rgba(52,211,153,0.12)',
                  border: '1px solid rgba(52,211,153,0.25)',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#6ee7b7',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  {tut.play_count} views
                </div>
              )}
            </div>
          </div>

          {/* Right column: artwork */}
          {artData && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '330px',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', position: 'relative' }}>
                {/* Glow behind the card */}
                <div style={{
                  position: 'absolute',
                  top: '20px',
                  left: '20px',
                  right: '-20px',
                  bottom: '-20px',
                  borderRadius: '20px',
                  background: 'rgba(161,48,107,0.2)',
                  filter: 'blur(30px)',
                }} />
                <img
                  src={artData}
                  width={290}
                  height={400}
                  style={{
                    objectFit: 'cover',
                    borderRadius: '20px',
                    border: '3px solid rgba(255,255,255,0.1)',
                    position: 'relative',
                  }}
                />
              </div>
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
