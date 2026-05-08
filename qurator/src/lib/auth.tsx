'use client';

import type { User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from './supabase/client';

type OAuthProvider = 'google' | 'apple';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (provider?: OAuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
}

const ADMIN_IDS = (process.env.NEXT_PUBLIC_ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isAdmin: false,
  signIn: async () => { },
  signOut: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (provider: OAuthProvider = 'google') => {
    const supabase = createClient();
    const returnTo = window.location.pathname + window.location.search;
    document.cookie = `qurator-auth-return=${encodeURIComponent(returnTo)}; path=/; max-age=600; SameSite=Lax`;
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const isAdmin = !!user && ADMIN_IDS.includes(user.id);

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
