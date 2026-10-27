import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { isGameKey } from '@/lib/games/challenges';
import { getDailyChallenge, toPublicChallenge } from '@/lib/games/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 30, windowMs: 60_000 });
  if (limited) return limited;

  const game = request.nextUrl.searchParams.get('game') ?? '';
  if (!isGameKey(game)) return NextResponse.json({ error: 'Unknown game mode.' }, { status: 400 });

  try {
    const challenge = await getDailyChallenge(game);
    return NextResponse.json(toPublicChallenge(challenge), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Daily game challenge failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { error: 'Today’s challenge is temporarily unavailable. Please retry shortly.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
