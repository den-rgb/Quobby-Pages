import { NextResponse } from 'next/server';
import { getProfileGameStats, getSignedInProfileId } from '@/lib/games/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const profileId = await getSignedInProfileId();
  if (!profileId) return NextResponse.json({ error: 'Sign in to view Games stats.' }, { status: 401 });

  try {
    const stats = await getProfileGameStats(profileId);
    return NextResponse.json(stats, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Games stats lookup failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Games stats are temporarily unavailable.' }, { status: 503 });
  }
}
