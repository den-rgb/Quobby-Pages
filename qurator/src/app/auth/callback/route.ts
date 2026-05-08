import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  const cookieStore = await cookies();
  const returnCookie = cookieStore.get('qurator-auth-return')?.value;
  const next = returnCookie ? decodeURIComponent(returnCookie) : '/create';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(
        `${origin}${next.startsWith('/') ? next : '/create'}`
      );
      response.cookies.delete('qurator-auth-return');
      return response;
    }
  }

  const response = NextResponse.redirect(`${origin}/?error=auth`);
  response.cookies.delete('qurator-auth-return');
  return response;
}
