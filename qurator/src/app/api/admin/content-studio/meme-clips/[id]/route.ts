import type { NextRequest } from 'next/server';
import { adminResponse } from '@/lib/content-studio/route-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return adminResponse('setMemeClipActive', request, (await context.params).id);
}
