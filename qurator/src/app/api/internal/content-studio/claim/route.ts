import type { NextRequest } from 'next/server';
import { machineResponse } from '@/lib/content-studio/route-server';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) { return machineResponse('claim', request); }
