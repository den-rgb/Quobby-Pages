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
  if (!user) return NextResponse.json({ error: 'Sign in to view this flashcard deck.' }, { status: 401 });

  const { id } = await params;
  const { data: deck, error: deckError } = await supabase
    .from('user_decks')
    .select('id, name, description')
    .eq('id', id)
    .single();
  if (deckError || !deck) {
    console.error('Mind map deck lookup failed:', deckError?.message ?? 'not found');
    return NextResponse.json({ error: 'The source deck could not be found.' }, { status: 404 });
  }

  const { data: cards, error: cardsError } = await supabase
    .from('user_flashcards')
    .select('front_text, back_text, part_of_speech')
    .eq('deck_id', id);
  if (cardsError) {
    console.error('Mind map card lookup failed:', cardsError.message);
    return NextResponse.json({ error: 'Could not load the flashcards in this deck.' }, { status: 503 });
  }

  return NextResponse.json({ deck, cards: cards ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}
