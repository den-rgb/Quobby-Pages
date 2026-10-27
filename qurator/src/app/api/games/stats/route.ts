import { NextRequest, NextResponse } from 'next/server';
import { getCompletedGamesToday, getLetterLedgerWinDistribution, getProfileGameStats, getSignedInProfileId } from '@/lib/games/server';
import type { GameProfileStatsResponse } from '@/lib/games/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const profileId = await getSignedInProfileId(request);
  if (!profileId) return NextResponse.json({ error: 'Sign in to view Games stats.' }, { status: 401 });

  try {
    const [stats, completedToday, letterLedgerWinDistribution] = await Promise.all([
      getProfileGameStats(profileId),
      getCompletedGamesToday(profileId),
      getLetterLedgerWinDistribution(profileId),
    ]);
    return NextResponse.json({ ...stats, completedToday, letterLedgerWinDistribution } satisfies GameProfileStatsResponse, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Games stats lookup failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Games stats are temporarily unavailable.' }, { status: 503 });
  }
}
