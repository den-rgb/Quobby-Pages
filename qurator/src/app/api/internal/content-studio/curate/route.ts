import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ContentStudioInputError, MemeGenerationError } from '@/lib/content-studio/errors';
import { curateMemeClips } from '@/lib/content-studio/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Vetting three clips means three downloads and three model calls.
export const maxDuration = 120;

// Vercel Cron (or an operator) tops up the funny clip library. The shared
// machine token authenticates it; nothing is exposed to browsers.
export async function GET(request: NextRequest) {
  // A dedicated cron secret is preferred; the machine token still works while
  // it is configured for any worker-era tooling.
  const secret = process.env.CRON_SECRET?.trim() || process.env.CONTENT_STUDIO_MACHINE_TOKEN?.trim();
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const token = request.headers.get('x-content-studio-machine-token') ?? bearer;
  if (!secret || token !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await curateMemeClips());
  } catch (error) {
    if (error instanceof ContentStudioInputError || error instanceof MemeGenerationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Curation failed' }, { status: 500 });
  }
}
