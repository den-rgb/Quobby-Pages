import { mindMapStoragePaths, mindMapUpsert, portableDrawingJson, type MindMap, type MindMapStroke } from '@/lib/mind-maps';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to view your mind maps.' }, { status: 401 });

  const { data: maps, error } = await supabase
    .from('user_mind_maps')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('Mind map list failed:', error.message);
    return NextResponse.json({ error: 'Could not load your mind maps.' }, { status: 503 });
  }

  return NextResponse.json({ maps: maps ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to save a mind map.' }, { status: 401 });

  const body = await request.json().catch(() => null) as { map?: MindMap; strokes?: MindMapStroke[]; images?: string[] } | null;
  if (!body?.map?.id || !Array.isArray(body.strokes) || !Array.isArray(body.images)) {
    return NextResponse.json({ error: 'Invalid mind map payload.' }, { status: 400 });
  }

  const updated = { ...body.map, updatedAt: new Date().toISOString() };
  const { error: mapError } = await supabase.from('user_mind_maps').upsert(mindMapUpsert(updated, user.id));
  if (mapError) {
    console.error('Mind map save failed:', mapError.message);
    return NextResponse.json({ error: 'Could not save this mind map.' }, { status: 503 });
  }

  const paths = mindMapStoragePaths(user.id, updated.id);
  const writes = await Promise.all([
    supabase.storage.from('user-mind-maps').upload(paths.drawing, new Blob([portableDrawingJson(body.strokes)], { type: 'application/json' }), { upsert: true }),
    supabase.storage.from('user-mind-maps').upload(paths.images, new Blob([JSON.stringify(body.images)], { type: 'application/json' }), { upsert: true }),
  ]);
  const storageError = writes.find((result) => result.error)?.error;
  if (storageError) {
    console.error('Mind map asset save failed:', storageError.message);
    return NextResponse.json({ error: 'Could not save this mind map’s drawing or images.' }, { status: 503 });
  }

  return NextResponse.json({ map: updated });
}
