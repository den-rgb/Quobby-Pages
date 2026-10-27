import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to view your flashcard decks.' }, { status: 401 });

  const { data, error } = await supabase
    .from('user_decks')
    .select('id, name, description')
    .order('name');
  if (error) {
    console.error('Mind map deck list failed:', error.message);
    return NextResponse.json({ error: 'Could not load your flashcard decks.' }, { status: 503 });
  }

  return NextResponse.json({ decks: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}
