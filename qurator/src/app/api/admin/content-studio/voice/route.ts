import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin';
import { rateLimit } from '@/lib/rate-limit';
import { ContentStudioInputError, MemeGenerationError } from '@/lib/content-studio/errors';
import { synthesizeVoice } from '@/lib/content-studio/voice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

// The admin's browser asks for the voice-over it will mux, so the response is
// the audio file itself rather than JSON.
export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 30, windowMs: 60_000 });
  if (limited) return limited;
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await request.json().catch(() => null) as { text?: unknown } | null;
  if (!body || typeof body.text !== 'string') return NextResponse.json({ error: 'Voice text is required' }, { status: 400 });
  try {
    const audio = await synthesizeVoice(body.text);
    const bytes = new Uint8Array(audio);
    return new Response(bytes.buffer as ArrayBuffer, { status: 200, headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof ContentStudioInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof MemeGenerationError) return NextResponse.json({ error: error.message }, { status: 502 });
    return NextResponse.json({ error: 'Voice generation failed' }, { status: 500 });
  }
}
