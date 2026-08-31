import { CLIENT_QURATOR_EVENTS, trackQuratorEvent } from '@/lib/qurator-analytics';
import { rateLimit } from '@/lib/rate-limit';
import { getRequestUser } from '@/lib/request-user';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 40, windowMs: 60_000 });
  if (limited) return limited;

  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { eventName?: unknown; eventData?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventName = typeof body.eventName === 'string' ? body.eventName : '';
  if (!CLIENT_QURATOR_EVENTS.has(eventName)) {
    return NextResponse.json({ error: 'Unknown event' }, { status: 400 });
  }

  const eventData =
    body.eventData && typeof body.eventData === 'object' && !Array.isArray(body.eventData)
      ? (body.eventData as Record<string, unknown>)
      : {};

  await trackQuratorEvent(eventName, user.id, eventData);
  return NextResponse.json({ ok: true });
}
