import type { NextRequest } from 'next/server';
import { adminResponse } from '@/lib/content-studio/route-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Stock search, clip download, and Gemini video analysis can take tens of seconds.
export const maxDuration = 120;
export async function POST(request: NextRequest) { return adminResponse('generateMeme', request); }
