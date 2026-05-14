import { rateLimit } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

const CACHE_SECONDS = 60 * 60 * 24 * 7;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10 MB cap

const ALLOWED_HOSTS = [
  'cf.geekdo-images.com',
  'boardgamegeek.com',
  'upload.wikimedia.org',
  'commons.wikimedia.org',
  'm.media-amazon.com',
  'images.unsplash.com',
];

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTS.some(
    (h) => hostname === h || hostname.endsWith(`.${h}`),
  );
}

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 60, windowMs: 60_000 });
  if (limited) return limited;

  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  if (parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only HTTPS allowed' }, { status: 400 });
  }

  if (!isAllowedHost(parsed.hostname)) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 403 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'image/*',
        'User-Agent': 'QuobbyQurator/1.0',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: CACHE_SECONDS },
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return new NextResponse(null, { status: 415 });
    }

    const contentLength = Number(res.headers.get('content-length') || 0);
    if (contentLength > MAX_RESPONSE_BYTES) {
      return new NextResponse(null, { status: 413 });
    }

    const body = await res.arrayBuffer();
    if (body.byteLength > MAX_RESPONSE_BYTES) {
      return new NextResponse(null, { status: 413 });
    }

    return new NextResponse(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${CACHE_SECONDS}, immutable`,
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
