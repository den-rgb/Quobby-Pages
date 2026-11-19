import type { NextRequest } from 'next/server';
import { adminResponse } from '@/lib/content-studio/route-server';

export const runtime = 'nodejs';

// This never creates a new publication. It requeues the same failed row so
// the Mac Keychain checkpoint can resume the provider operation safely.
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return adminResponse('retryPublication', request, (await context.params).id);
}
