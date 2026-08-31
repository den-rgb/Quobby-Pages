import { rateLimit } from '@/lib/rate-limit';
import { requireAdminUser } from '@/lib/admin';
import { loadAdminAnalytics, parseAdminAnalyticsDays } from '@/lib/admin-analytics';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 30, windowMs: 60_000 });
  if (limited) return limited;

  const user = await requireAdminUser();
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const days = parseAdminAnalyticsDays(request.nextUrl.searchParams.get('days'));
  const data = await loadAdminAnalytics(days);
  return NextResponse.json(data);
}
