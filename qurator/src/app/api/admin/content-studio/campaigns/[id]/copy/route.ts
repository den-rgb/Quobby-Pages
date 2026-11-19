import type { NextRequest } from 'next/server';
import { adminResponse } from '@/lib/content-studio/route-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return adminResponse('generateCopy', request, (await context.params).id);
}
