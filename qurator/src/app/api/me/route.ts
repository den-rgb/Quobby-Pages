import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ isAdmin: false });
  }

  return NextResponse.json({ isAdmin: ADMIN_IDS.includes(user.id) });
}
