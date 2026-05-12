import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      bgg_id,
      bgg_image_url,
      description,
      complexity,
      min_players,
      max_players,
      play_time_minutes,
      year_published,
    } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('upsert_game', {
      p_title: title.trim(),
      p_bgg_id: bgg_id || null,
      p_bgg_image_url: bgg_image_url || null,
      p_description: (description || '').slice(0, 500),
      p_complexity: Math.max(1, Math.min(5, Number(complexity) || 2)),
      p_min_players: Number(min_players) || 1,
      p_max_players: Number(max_players) || 4,
      p_play_time_minutes: Number(play_time_minutes) || 30,
      p_year_published: year_published ? Number(year_published) : null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ id: data });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
