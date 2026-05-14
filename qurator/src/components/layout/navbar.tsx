'use client';

import { PremiumUpsell } from '@/components/premium-upsell';
import { useAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';
import { Crown, Download, Gamepad2, HelpCircle, LogOut, Menu, User, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const links = [
  { href: '/tutorials', label: 'Browse Tutorials' },
];

interface NavProfile {
  display_name: string | null;
  avatar_emoji: string;
  avatar_background_color_hex: string;
  subscription_tier: string | null;
}

function UserMenu() {
  const { user, loading, isAdmin, isPremium: authPremium, signIn, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profile, setProfile] = useState<NavProfile | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    const supabase = createClient();
    supabase
      .from('profiles')
      .select('display_name, avatar_emoji, avatar_background_color_hex, subscription_tier')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as NavProfile);
      });
  }, [user]);

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
    );
  }

  if (!user) {
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setMenuOpen((p) => !p)}
          className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] border border-border rounded-lg text-sm font-medium text-foreground hover:bg-white/10 transition-all"
        >
          <User className="w-4 h-4" />
          Sign In
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-12 w-56 bg-background-secondary border border-border rounded-xl shadow-xl overflow-hidden z-50">
            <p className="px-4 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-faint">
              Continue with
            </p>
            <button
              onClick={() => {
                signIn('google');
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground-muted hover:text-foreground hover:bg-white/5 transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
            </button>
            <button
              onClick={() => {
                signIn('apple');
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground-muted hover:text-foreground hover:bg-white/5 transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              Apple
            </button>
          </div>
        )}
      </div>
    );
  }

  const displayName = profile?.display_name ?? user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'User';
  const isPremium = profile?.subscription_tier === 'premium';
  const avatarEmoji = profile?.avatar_emoji ?? '🎓';
  const avatarBg = profile?.avatar_background_color_hex ?? '4CAF50';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setMenuOpen((p) => !p)}
        className="flex items-center gap-2 rounded-full hover:ring-2 hover:ring-accent/30 transition-all"
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm border border-white/10"
          style={{ background: `linear-gradient(135deg, #${avatarBg}, #${avatarBg}88)` }}
        >
          {avatarEmoji}
        </div>
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-12 w-56 bg-background-secondary border border-border rounded-xl shadow-xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <p
                className="text-xs font-medium truncate"
                style={{ color: (isPremium || isAdmin) ? '#FFD700' : undefined }}
              >
                {displayName}
              </p>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${isAdmin
                ? 'bg-red-500/15 text-red-400'
                : isPremium
                  ? 'bg-yellow-500/15 text-yellow-400'
                  : 'bg-white/10 text-foreground-faint'
                }`}>
                {isAdmin ? 'Admin' : isPremium ? 'Premium' : 'Member'}
              </span>
            </div>
            <p className="text-[10px] text-foreground-faint truncate">
              {user.email}
            </p>
          </div>
          <Link
            href="/profile"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground-muted hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <User className="w-3.5 h-3.5" />
            Profile
          </Link>
          {!authPremium && !isAdmin && (
            <button
              onClick={() => {
                setMenuOpen(false);
                setShowUpsell(true);
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-yellow-400 hover:bg-yellow-400/10 transition-colors"
            >
              <Crown className="w-3.5 h-3.5" />
              Get Premium
            </button>
          )}
          <button
            onClick={() => {
              signOut();
              setMenuOpen(false);
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      )}

      {showUpsell && (
        <PremiumUpsell onClose={() => setShowUpsell(false)} />
      )}
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { isPremium, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);

  const isEditor = pathname.startsWith('/create/');

  if (isEditor) return null;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-[1100px] mx-auto flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3 no-underline">
            <Gamepad2 className="w-8 h-8 text-accent" />
            <span className="text-lg font-bold text-foreground tracking-tight">
              Qurator
            </span>
          </Link>

          <button
            className="lg:hidden p-2"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? (
              <X className="w-5 h-5 text-foreground" />
            ) : (
              <Menu className="w-5 h-5 text-foreground" />
            )}
          </button>

          <ul
            className={`${open ? 'flex' : 'hidden'
              } lg:flex items-center gap-2 list-none absolute lg:static top-16 left-0 right-0 lg:top-auto flex-col lg:flex-row bg-background/98 lg:bg-transparent backdrop-blur-xl lg:backdrop-blur-none border-b lg:border-0 border-border p-4 lg:p-0`}
          >
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`block px-4 py-2 rounded-lg text-sm font-medium transition-all ${pathname === link.href
                    ? 'text-foreground bg-white/5'
                    : 'text-foreground-muted hover:text-foreground hover:bg-white/5'
                    }`}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {!isPremium && !isAdmin && (
              <li>
                <button
                  onClick={() => {
                    setOpen(false);
                    setShowUpsell(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-sm font-semibold bg-yellow-400/15 text-yellow-400 border border-yellow-400/20 hover:bg-yellow-400/25 hover:-translate-y-0.5 transition-all"
                >
                  <Crown className="w-3.5 h-3.5" />
                  Get Premium
                </button>
              </li>
            )}
            <li className="relative group">
              <a
                href="https://www.quobby.com"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-sm font-semibold bg-green/15 text-green border border-green/20 hover:bg-green/25 hover:-translate-y-0.5 transition-all"
                onClick={() => setOpen(false)}
              >
                <Download className="w-3.5 h-3.5" />
                Get Quobby
              </a>
              <span className="hidden lg:block absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-green/10 border border-green/15 rounded-lg text-[0.7rem] font-medium text-green whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Follow Qurator tutorials in the app!
              </span>
            </li>
            <li>
              <a
                href="https://www.quobby.com/support"
                target="_blank"
                rel="noopener"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-white/5 transition-all"
                onClick={() => setOpen(false)}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Help
              </a>
            </li>
            <li>
              <Link
                href="/create"
                className="inline-flex items-center gap-2 px-5 py-2 bg-accent text-black font-semibold rounded-[10px] text-sm transition-all hover:bg-accent-light hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(139,0,81,0.3)]"
                onClick={() => setOpen(false)}
              >
                Start Creating
              </Link>
            </li>
            <li className="lg:ml-2">
              <UserMenu />
            </li>
          </ul>
        </div>
      </nav>

      {showUpsell && (
        <PremiumUpsell onClose={() => setShowUpsell(false)} />
      )}
    </>
  );
}
