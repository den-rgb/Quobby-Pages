import type { NextRequest } from 'next/server';
import { machineResponse } from '@/lib/content-studio/route-server';

export const runtime = 'nodejs';
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return machineResponse('updateRender', request, (await context.params).id);
}
