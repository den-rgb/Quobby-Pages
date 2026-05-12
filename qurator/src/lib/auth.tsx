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
  isPremium: boolean;
  signIn: (provider?: OAuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isAdmin: false,
  isPremium: false,
  signIn: async () => { },
  signOut: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [premium, setPremium] = useState(false);
  const [admin, setAdmin] = useState(false);

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

  useEffect(() => {
    if (!user) {
      setPremium(false);
      setAdmin(false);
      return;
    }
    const supabase = createClient();
    supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setPremium(data?.subscription_tier === 'premium');
      });

    fetch('/api/me')
      .then((r) => r.json())
      .then((data) => setAdmin(!!data?.isAdmin))
      .catch(() => setAdmin(false));
  }, [user]);

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
    setPremium(false);
    setAdmin(false);
  }, []);

  const isAdmin = admin;
  const isPremium = premium || isAdmin;

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, isPremium, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
