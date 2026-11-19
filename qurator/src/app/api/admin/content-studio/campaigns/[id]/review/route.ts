import type { NextRequest } from 'next/server';
import { adminResponse } from '@/lib/content-studio/route-server';

export const runtime = 'nodejs';
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return adminResponse('reviewCampaign', request, (await context.params).id);
}
