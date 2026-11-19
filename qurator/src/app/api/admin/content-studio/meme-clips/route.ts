import type { NextRequest } from 'next/server';
import { adminResponse } from '@/lib/content-studio/route-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) { return adminResponse('listMemeClips', request); }
export async function POST(request: NextRequest) { return adminResponse('addMemeClip', request); }
