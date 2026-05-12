import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SAFE_PREFIXES = ['/create', '/tutorials', '/profile', '/premium'];

function safePath(raw: string): string {
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('..')) {
    return '/create';
  }
  if (SAFE_PREFIXES.some((p) => raw === p || raw.startsWith(`${p}/`))) {
    return raw;
  }
  return '/create';
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  const cookieStore = await cookies();
  const returnCookie = cookieStore.get('qurator-auth-return')?.value;
  const next = safePath(returnCookie ? decodeURIComponent(returnCookie) : '/create');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      response.cookies.delete('qurator-auth-return');
      return response;
    }
  }

  const response = NextResponse.redirect(`${origin}/?error=auth`);
  response.cookies.delete('qurator-auth-return');
  return response;
}
