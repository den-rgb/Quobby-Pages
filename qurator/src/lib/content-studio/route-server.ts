import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/admin';
import { rateLimit } from '@/lib/rate-limit';
import { requireMachineToken } from './machine-auth';
import { createContentStudioHandlers } from './routes';
import { studioStore } from './route-store';

const handlers = createContentStudioHandlers({ requireAdmin: requireAdminUser, requireMachine: requireMachineToken, store: studioStore });
type Handlers = typeof handlers;
type AdminHandler = 'listCampaigns' | 'createCampaign' | 'generateMeme' | 'adminAsset' | 'reviewCampaign' | 'patchPublication' | 'retryPublication' | 'previewRender' | 'listMemeClips' | 'addMemeClip' | 'setMemeClipActive' | 'renderUpload' | 'completeBrowserRender' | 'publishManual' | 'assetDownload' | 'renderSource' | 'generateCopy';
type MachineHandler = Exclude<keyof Handlers, AdminHandler>;

export async function adminResponse(name: AdminHandler, request: NextRequest, id?: string) {
  const limited = rateLimit(request, { maxRequests: 30, windowMs: 60_000 });
  if (limited) return limited;
  const response = await handlers[name](request, id);
  return NextResponse.json(response.body, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function machineResponse(name: MachineHandler, request: NextRequest, id?: string) {
  const response = await handlers[name](request, id);
  return NextResponse.json(response.body, { status: response.status });
}
