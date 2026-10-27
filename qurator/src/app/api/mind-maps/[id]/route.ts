import { mindMapStoragePaths, parsePortableDrawing } from '@/lib/mind-maps';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to view this mind map.' }, { status: 401 });

  const { id } = await params;
  const { data: map, error } = await supabase
    .from('user_mind_maps')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !map) {
    console.error('Mind map lookup failed:', error?.message ?? 'not found');
    return NextResponse.json({ error: 'Mind map not found.' }, { status: 404 });
  }

  const paths = mindMapStoragePaths(user.id, id);
  const [drawingResult, imageResult] = await Promise.all([
    supabase.storage.from('user-mind-maps').download(paths.drawing),
    supabase.storage.from('user-mind-maps').download(paths.images),
  ]);
  const strokes = drawingResult.data ? parsePortableDrawing(await drawingResult.data.text()) : [];
  let images: string[] = [];
  if (imageResult.data) {
    try {
      const parsed = JSON.parse(await imageResult.data.text());
      images = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
    } catch {
      images = [];
    }
  }

  return NextResponse.json({ map, strokes, images }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to delete this mind map.' }, { status: 401 });

  const { id } = await params;
  const { error } = await supabase.from('user_mind_maps').delete().eq('id', id);
  if (error) {
    console.error('Mind map delete failed:', error.message);
    return NextResponse.json({ error: 'Could not delete this mind map.' }, { status: 503 });
  }

  const paths = mindMapStoragePaths(user.id, id);
  await supabase.storage.from('user-mind-maps').remove([paths.drawing, paths.images, `${user.id}/mind-maps/${id}/thumbnail.jpg`]);
  return NextResponse.json({ ok: true });
}
