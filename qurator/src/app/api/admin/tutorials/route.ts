import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: steps } = await supabase
    .from('tutorial_steps')
    .select('content_json')
    .eq('tutorial_id', id);

  const storagePaths: string[] = [];
  for (const step of steps ?? []) {
    const media = (step.content_json as Record<string, unknown>)?.media;
    if (!Array.isArray(media)) continue;
    for (const m of media) {
      const url = (m as Record<string, unknown>)?.url;
      if (typeof url !== 'string') continue;
      const match = url.match(/\/tutorial-assets\/(.+)$/);
      if (match) storagePaths.push(match[1]);
    }
  }

  if (storagePaths.length > 0) {
    await supabase.storage.from('tutorial-assets').remove(storagePaths);
  }

  const { error } = await supabase.rpc('admin_delete_tutorial', { p_tutorial_id: id });

  if (error) {
    const status = error.message?.includes('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ ok: true });
}
