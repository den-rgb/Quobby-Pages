import { DEMO_TUTORIALS } from '@/lib/demo-tutorials';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const PROVIDER_NAME = 'Qurator';
const PROVIDER_URL = 'https://qurator.quobby.com';
const TUTORIAL_URL_RE = /^https?:\/\/qurator\.quobby\.com\/tutorials\/([a-f0-9-]+)/;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const format = request.nextUrl.searchParams.get('format') || 'json';
  const maxWidth = parseInt(request.nextUrl.searchParams.get('maxwidth') || '800', 10);
  const maxHeight = parseInt(request.nextUrl.searchParams.get('maxheight') || '600', 10);

  if (format !== 'json') {
    return NextResponse.json(
      { error: 'Only JSON format is supported' },
      { status: 501 }
    );
  }

  if (!url) {
    return NextResponse.json(
      { error: 'Missing required "url" parameter' },
      { status: 400 }
    );
  }

  const match = url.match(TUTORIAL_URL_RE);
  if (!match) {
    return NextResponse.json(
      { error: 'URL does not match a Qurator tutorial' },
      { status: 404 }
    );
  }

  const tutorialId = match[1];
  let title = 'Qurator Tutorial';
  let description = '';
  let authorName = '';
  let thumbnailUrl: string | null = null;

  const demo = DEMO_TUTORIALS[tutorialId];
  if (demo) {
    title = demo.tutorial.title;
    description = demo.tutorial.description;
  } else {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Server misconfigured' },
        { status: 500 }
      );
    }

    const res = await fetch(
      `${supabaseUrl}/rest/v1/tutorials?id=eq.${tutorialId}&status=eq.published&select=title,description,cover_image_url,creator_id,profiles!creator_id(display_name)`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    const rows = await res.json();
    const tut = Array.isArray(rows) ? rows[0] : null;
    if (!tut) {
      return NextResponse.json(
        { error: 'Tutorial not found or not published' },
        { status: 404 }
      );
    }

    title = tut.title;
    description = tut.description || '';
    thumbnailUrl = tut.cover_image_url || null;
    const profile = tut.profiles as { display_name?: string } | null;
    authorName = profile?.display_name || '';
  }

  const width = Math.min(maxWidth, 800);
  const height = Math.min(maxHeight, 600);

  const host = request.headers.get('host') || 'qurator.quobby.com';
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const origin = `${proto}://${host}`;

  const embedHtml = `<iframe src="${origin}/embed/${tutorialId}" width="${width}" height="${height}" style="border:none;border-radius:12px;" allow="clipboard-write" loading="lazy" title="${title.replace(/"/g, '&quot;')}"></iframe>`;

  if (!thumbnailUrl) {
    thumbnailUrl = `${origin}/api/og?id=${tutorialId}`;
  }

  const response = {
    type: 'rich',
    version: '1.0',
    title,
    ...(description && { description }),
    ...(authorName && { author_name: authorName }),
    provider_name: PROVIDER_NAME,
    provider_url: PROVIDER_URL,
    html: embedHtml,
    width,
    height,
    thumbnail_url: thumbnailUrl,
    thumbnail_width: 1200,
    thumbnail_height: 630,
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
