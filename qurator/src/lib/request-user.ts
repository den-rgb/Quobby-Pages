import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

export async function getRequestUser(request?: NextRequest): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user;

  const auth = request?.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    const { data } = await supabase.auth.getUser(token);
    return data.user ?? null;
  }
  return null;
}
