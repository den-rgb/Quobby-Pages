import { QURATOR_EVENT, trackQuratorEvent, trackQuratorEventOnce } from '@/lib/qurator-analytics';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SAFE_PREFIXES = ['/create', '/tutorials', '/profile', '/premium', '/admin'];
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const refCookie = cookieStore.get('qurator-ref')?.value;
  const next = safePath(returnCookie ? decodeURIComponent(returnCookie) : '/create');

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const userId = data.user?.id;
      if (
        userId &&
        refCookie &&
        UUID_RE.test(refCookie) &&
        refCookie !== userId
      ) {
        try {
          const admin = supabaseAdmin();
          await admin
            .from('profiles')
            .update({ referred_by: refCookie })
            .eq('id', userId)
            .is('referred_by', null);
        } catch {
          /* profile row may not exist yet */
        }
      }
      if (userId && data.user) {
        const provider = data.user.app_metadata?.provider ?? 'oauth';
        const createdAt = data.user.created_at ? new Date(data.user.created_at).getTime() : 0;
        const isNewAccount = createdAt > 0 && Date.now() - createdAt < 10 * 60 * 1000;
        await Promise.all([
          trackQuratorEventOnce(QURATOR_EVENT.PROFILE_SIGNUP, userId, {
            provider,
            kind: isNewAccount ? 'new_account' : 'existing_account',
          }),
          trackQuratorEvent(QURATOR_EVENT.QURATOR_LOGIN, userId, { provider }),
        ]);
      }
      const response = NextResponse.redirect(`${origin}${next}`);
      response.cookies.delete('qurator-auth-return');
      return response;
    }
  }

  const response = NextResponse.redirect(`${origin}/?error=auth`);
  response.cookies.delete('qurator-auth-return');
  return response;
}
