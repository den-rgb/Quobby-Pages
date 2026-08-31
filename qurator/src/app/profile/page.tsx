'use client';

import { EarningsPanel } from '@/components/earnings-panel';
import { PremiumUpsell } from '@/components/premium-upsell';
import { ThemePicker } from '@/components/theme-picker';
import { useAuth } from '@/lib/auth';
import { DEMO_CATEGORY_SLUGS, DEMO_CREATOR_ID, DEMO_TUTORIAL_LIST } from '@/lib/demo-tutorials';
import { createClient } from '@/lib/supabase/client';
import { formatEur } from '@/lib/tutorial-pricing';
import type { Tutorial } from '@/lib/types';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bookmark,
  BookOpen,
  Clock,
  CreditCard,
  Crown,
  Edit3,
  Flame,
  Loader2,
  Lock,
  LogOut,
  Play,
  Plus,
  Star,
  Tag,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface QuobbyProfile {
  id: string;
  display_name: string;
  avatar_emoji: string;
  name_color_hex: string;
  avatar_background_color_hex: string;
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  total_cards_studied: number;
  total_cards_created: number;
  decks_published: number;
  study_points: number;
  created_at: string;
}

interface TutorialWithGame extends Tutorial {
  games?: { title: string; bgg_image_url: string | null } | null;
  categories?: { name: string; slug: string; icon: string | null } | null;
}

function xpCostForLevel(level: number): number {
  if (level <= 10) return 100 * level * level;
  return 10_000 + 1_000 * (level - 10);
}

function cumulativeXpToEnterLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += xpCostForLevel(l);
  }
  return total;
}

function levelProgress(level: number, totalXp: number) {
  const xpAtLevelStart = cumulativeXpToEnterLevel(level);
  const xpInSegment = totalXp - xpAtLevelStart;
  const segmentSize = xpCostForLevel(level);
  return Math.min(1, Math.max(0, xpInSegment / segmentSize));
}

function StatCard({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: React.ElementType;
  value: string | number;
  label: string;
  color: string;
}) {
  return (
    <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: color }}
        >
          <Icon className="w-3.5 h-3.5 text-foreground" />
        </div>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-foreground-faint">{label}</p>
    </div>
  );
}

function PaidBadge({
  tutorial,
}: {
  tutorial: { is_paid?: boolean; price_cents?: number | null };
}) {
  if (!tutorial.is_paid) return null;
  return (
    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/15 text-amber-300 shrink-0">
      <Tag className="w-3 h-3" />
      {tutorial.price_cents ? formatEur(tutorial.price_cents) : 'Paid'}
    </span>
  );
}

function TutorialCard({
  tutorial,
  onDelete,
}: {
  tutorial: TutorialWithGame;
  onDelete: (id: string) => void;
}) {
  const statusColors: Record<string, string> = {
    draft: 'bg-yellow-500/15 text-yellow-400',
    published: 'bg-green/15 text-green',
    archived: 'bg-white/10 text-foreground-faint',
  };

  return (
    <div className="p-5 bg-white/[0.03] border border-white/[0.06] rounded-2xl transition-all hover:bg-white/[0.05]">
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          {tutorial.games?.title && (
            <p className="text-[10px] text-foreground-faint font-medium uppercase tracking-wider mb-0.5">
              {tutorial.games.title}
            </p>
          )}
          <h3 className="text-sm font-semibold text-foreground truncate">
            {tutorial.title}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-3">
          <PaidBadge tutorial={tutorial} />
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[tutorial.status] ?? statusColors.draft}`}
          >
            {tutorial.status}
          </span>
        </div>
      </div>

      {tutorial.description && (
        <p className="text-xs text-foreground-muted line-clamp-2 mb-3">
          {tutorial.description}
        </p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-foreground-faint mb-4">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {tutorial.estimated_minutes}m
        </span>
        {tutorial.rating_count > 0 && (
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-400" />
            {tutorial.rating_avg.toFixed(1)}
          </span>
        )}
        {tutorial.play_count > 0 && (
          <span className="flex items-center gap-1">
            <Play className="w-3 h-3" />
            {tutorial.play_count}
          </span>
        )}
        <span className="text-foreground-faint/50">
          v{tutorial.version}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`/create/new?load=${tutorial.id}`}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/15 text-accent text-xs font-medium rounded-lg hover:bg-accent/25 transition-colors"
        >
          <Edit3 className="w-3 h-3" />
          Edit
        </Link>
        {tutorial.status === 'published' && (
          <Link
            href={`/tutorials/${tutorial.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] text-foreground-muted text-xs font-medium rounded-lg hover:bg-white/10 transition-colors"
          >
            <Play className="w-3 h-3" />
            View
          </Link>
        )}
        <button
          onClick={() => onDelete(tutorial.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-red-400/70 text-xs font-medium rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors ml-auto"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, loading: authLoading, isAdmin, isPremium, signIn, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<QuobbyProfile | null>(null);
  const [tutorials, setTutorials] = useState<TutorialWithGame[]>([]);
  const [savedTutorials, setSavedTutorials] = useState<TutorialWithGame[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingTutorials, setLoadingTutorials] = useState(true);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [paidOnly, setPaidOnly] = useState(false);
  const [tutorialSort, setTutorialSort] = useState<'recent' | 'name' | 'plays' | 'rating'>('recent');
  const [showUpsell, setShowUpsell] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [removalNotice, setRemovalNotice] = useState<{ id: string; tutorial_title: string; reason: string; created_at: string } | null>(null);
  const [notifications, setNotifications] = useState<{ id: string; type: string; message: string; is_read: boolean; created_at: string; from_user: { display_name: string; avatar_emoji: string; avatar_background_color_hex: string } | null }[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleManageSubscription = useCallback(async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
    } catch { /* ignore */ }
    setPortalLoading(false);
  }, []);

  const fetchAll = useCallback(async (userId: string) => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, display_name, avatar_emoji, name_color_hex, avatar_background_color_hex, total_xp, level, current_streak, longest_streak, total_cards_studied, total_cards_created, decks_published, study_points, created_at'
      )
      .eq('id', userId)
      .single();
    if (error) console.error('Profile fetch failed:', error.message);
    setProfile(data as QuobbyProfile | null);
    setLoadingProfile(false);

    const { data: tutData, error: tutErr } = await supabase
      .from('tutorials')
      .select('*, games(title, bgg_image_url), categories(name, slug, icon)')
      .eq('creator_id', userId)
      .order('updated_at', { ascending: false });
    if (tutErr) console.error('Tutorials fetch failed:', tutErr.message);
    let allTuts = (tutData as TutorialWithGame[]) ?? [];
    if (userId === DEMO_CREATOR_ID) {
      const dbIds = new Set(allTuts.map((t) => t.id));
      const demos = DEMO_TUTORIAL_LIST.filter((d) => !dbIds.has(d.id)).map((d) => {
        const slug = d.category_id ? DEMO_CATEGORY_SLUGS[d.category_id] : undefined;
        return {
          ...d,
          games: d.game ? { title: d.game.title, bgg_image_url: d.game.bgg_image_url ?? null } : null,
          categories: slug ? { name: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), slug, icon: null } : null,
        };
      });
      allTuts = [...allTuts, ...demos];
    }
    setTutorials(allTuts);
    setLoadingTutorials(false);

    const { data: notices } = await supabase
      .from('tutorial_removal_notices')
      .select('id, tutorial_title, reason, created_at')
      .eq('user_id', userId)
      .eq('acknowledged', false)
      .order('created_at', { ascending: false })
      .limit(1);
    if (notices && notices.length > 0) {
      setRemovalNotice(notices[0]);
    }

    const { data: notifData } = await supabase
      .from('notifications')
      .select('id, type, message, is_read, created_at, from_user:profiles!notifications_from_user_id_fkey(display_name, avatar_emoji, avatar_background_color_hex)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (notifData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setNotifications(notifData.map((n: any) => ({
        ...n,
        from_user: Array.isArray(n.from_user) ? n.from_user[0] ?? null : n.from_user ?? null,
      })));
    }

    const { data: savedRows, error: savedErr } = await supabase
      .from('saved_tutorials')
      .select('tutorial_id')
      .eq('user_id', userId);
    if (savedErr || !savedRows || savedRows.length === 0) {
      setSavedTutorials([]);
      setLoadingSaved(false);
      return;
    }
    const ids = savedRows.map((r) => r.tutorial_id);
    const { data: tuts } = await supabase
      .from('tutorials')
      .select('*, games(title, bgg_image_url)')
      .in('id', ids)
      .eq('status', 'published');
    setSavedTutorials((tuts as TutorialWithGame[]) ?? []);
    setLoadingSaved(false);
  }, []);

  useEffect(() => {
    if (authLoading || !user) {
      setLoadingProfile(false);
      setLoadingTutorials(false);
      setLoadingSaved(false);
      return;
    }

    fetchAll(user.id);

    const onFocus = () => fetchAll(user.id);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, authLoading, fetchAll]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this tutorial? This cannot be undone.')) return;
      setDeleting(id);
      const supabase = createClient();

      const { data: steps } = await supabase
        .from('tutorial_steps')
        .select('content_json')
        .eq('tutorial_id', id);

      const storagePaths: string[] = [];
      for (const step of steps ?? []) {
        const media = (step.content_json as Record<string, unknown>)?.media;
        if (!Array.isArray(media)) continue;
        for (const m of media) {
          const url = (m as Record<string, unknown>)?.url;
          if (typeof url !== 'string') continue;
          const match = url.match(/\/tutorial-assets\/(.+)$/);
          if (match) storagePaths.push(match[1]);
        }
      }

      if (storagePaths.length > 0) {
        await supabase.storage.from('tutorial-assets').remove(storagePaths);
      }

      await supabase.from('tutorials').delete().eq('id', id);
      setTutorials((prev) => prev.filter((t) => t.id !== id));
      setDeleting(null);
    },
    []
  );

  const handleUnsave = useCallback(
    async (tutorialId: string) => {
      if (!user) return;
      const supabase = createClient();
      await supabase.from('saved_tutorials').delete().eq('user_id', user.id).eq('tutorial_id', tutorialId);
      setSavedTutorials((prev) => prev.filter((t) => t.id !== tutorialId));
    },
    [user]
  );

  const acknowledgeRemoval = useCallback(async () => {
    if (!removalNotice) return;
    const supabase = createClient();
    await supabase
      .from('tutorial_removal_notices')
      .update({ acknowledged: true })
      .eq('id', removalNotice.id);
    setRemovalNotice(null);
  }, [removalNotice]);

  const markAllNotificationsRead = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-foreground-faint animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="px-6 py-24 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Sign in to view your profile
          </h1>
          <p className="text-foreground-muted mb-8">
            Your Quobby profile syncs across the iOS app, Android app, and
            Qurator web editor.
          </p>
          <button
            onClick={() => signIn('google')}
            className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-accent text-black font-semibold rounded-[14px] transition-all hover:bg-accent-light hover:-translate-y-0.5"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const displayName = profile?.display_name ?? user.user_metadata?.display_name ?? 'Learner';
  const avatarEmoji = profile?.avatar_emoji ?? '🎓';
  const avatarBg = profile?.avatar_background_color_hex ?? '4CAF50';
  const nameColor = (isPremium || isAdmin) ? 'FFD700' : (profile?.name_color_hex ?? 'FFFFFF');
  const level = profile?.level ?? 1;
  const totalXp = profile?.total_xp ?? 0;
  const progress = levelProgress(level, totalXp);
  const xpAtLevelStart = cumulativeXpToEnterLevel(level);
  const xpNeeded = xpCostForLevel(level) - (totalXp - xpAtLevelStart);

  const uniqueCategories = tutorials.reduce<{ name: string; slug: string }[]>((acc, t) => {
    if (t.categories?.name && !acc.some((c) => c.slug === t.categories!.slug)) {
      acc.push({ name: t.categories.name, slug: t.categories.slug });
    }
    return acc;
  }, []);
  const paidCount = tutorials.filter((t) => t.is_paid).length;

  const filtered = tutorials.filter((t) => {
    if (paidOnly && !t.is_paid) return false;
    if (categoryFilter && t.categories?.slug !== categoryFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (tutorialSort === 'name') return a.title.localeCompare(b.title);
    if (tutorialSort === 'plays') return b.play_count - a.play_count;
    if (tutorialSort === 'rating') return b.rating_avg - a.rating_avg;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const published = sorted.filter((t) => t.status === 'published');
  const drafts = sorted.filter((t) => t.status === 'draft');

  return (
    <div className="px-6 py-12">
      {removalNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a2e] border border-red-500/30 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-foreground">
                  Tutorial Removed
                </h3>
                <p className="text-xs text-foreground-faint mt-0.5">
                  {new Date(removalNotice.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={acknowledgeRemoval}
                className="p-1 text-foreground-faint hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-foreground-muted mb-2">
              Your tutorial <strong className="text-foreground">&ldquo;{removalNotice.tutorial_title}&rdquo;</strong> was removed by a moderator.
            </p>
            <div className="p-3 bg-red-500/[0.08] border border-red-500/20 rounded-xl mb-5">
              <p className="text-xs font-medium text-red-400 mb-1">Reason</p>
              <p className="text-sm text-foreground-muted">{removalNotice.reason}</p>
            </div>
            <p className="text-xs text-foreground-faint mb-5">
              Please review our Community Guidelines. If you believe this was a mistake, contact support.
            </p>
            <button
              onClick={acknowledgeRemoval}
              className="w-full py-2.5 bg-accent text-black font-semibold text-sm rounded-xl hover:bg-accent-light transition-colors"
            >
              I Understand
            </button>
          </div>
        </div>
      )}
      <div className="max-w-[800px] mx-auto space-y-6">
        {/* Profile Header */}
        <div className="p-6 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl shrink-0 border-2 border-white/10"
              style={{
                background: `linear-gradient(135deg, #${avatarBg}, #${avatarBg}88)`,
              }}
            >
              {avatarEmoji}
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h1
                  className="text-xl font-bold truncate"
                  style={{ color: `#${nameColor}` }}
                >
                  {displayName}
                </h1>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${isAdmin
                  ? 'bg-red-500/15 text-red-400'
                  : isPremium
                    ? 'bg-yellow-500/15 text-yellow-400'
                    : 'bg-white/10 text-foreground-faint'
                  }`}>
                  {isAdmin ? 'Admin' : isPremium ? 'Premium' : 'Member'}
                </span>
              </div>
              <p className="text-xs text-foreground-faint truncate">
                {user.email}
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-3 mt-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-yellow-500/15 text-yellow-400 text-xs font-semibold rounded-full">
                  <Trophy className="w-3 h-3" />
                  Level {level}
                </span>
                {profile && (
                  <span className="text-xs text-foreground-faint">
                    Member since{' '}
                    {new Date(profile.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                signOut();
                router.push('/');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-foreground-faint hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="p-5 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
          <button
            onClick={() => {
              setShowNotifications((v) => !v);
              if (!showNotifications && unreadCount > 0) markAllNotificationsRead();
            }}
            className="w-full flex items-center gap-3"
          >
            <div className="relative">
              <Bell className="w-5 h-5 text-foreground-muted" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-accent text-black text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <span className="text-sm font-medium text-foreground flex-1 text-left">
              Notifications
            </span>
            <span className="text-xs text-foreground-faint">
              {notifications.length === 0 ? 'None' : `${notifications.length}`}
            </span>
          </button>

          {showNotifications && (
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-xs text-foreground-faint text-center py-4">
                  No notifications yet. You&apos;ll see them when someone follows you.
                </p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${n.is_read ? 'bg-transparent' : 'bg-accent/[0.04]'}`}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs border border-white/10 shrink-0"
                      style={{ background: `#${n.from_user?.avatar_background_color_hex ?? '4CAF50'}` }}
                    >
                      {n.from_user?.avatar_emoji ?? '🎓'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground-secondary truncate">
                        {n.type === 'new_follower' ? (
                          <><strong className="text-foreground">{n.from_user?.display_name ?? 'Someone'}</strong> started following you</>
                        ) : (
                          n.message
                        )}
                      </p>
                      <p className="text-[10px] text-foreground-faint mt-0.5">
                        {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    {n.type === 'new_follower' && (
                      <UserPlus className="w-3.5 h-3.5 text-accent shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Premium CTA / Manage Subscription */}
        {!isPremium && !isAdmin ? (
          <button
            onClick={() => setShowUpsell(true)}
            className="w-full p-4 bg-yellow-400/[0.06] border border-yellow-400/20 rounded-2xl flex items-center gap-4 hover:bg-yellow-400/10 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-yellow-400/15 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-yellow-400">
                Upgrade to Premium
              </p>
              <p className="text-[11px] text-foreground-faint">
                Larger video uploads, video splitting, and tutorial analytics.
              </p>
            </div>
            <span className="text-xs font-semibold text-yellow-400 shrink-0">
              Learn More
            </span>
          </button>
        ) : isPremium && !isAdmin ? (
          <button
            onClick={handleManageSubscription}
            disabled={portalLoading}
            className="w-full p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center gap-4 hover:bg-white/[0.05] transition-colors text-left disabled:opacity-60"
          >
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Manage Subscription
              </p>
              <p className="text-[11px] text-foreground-faint">
                Update payment method, change plan, or cancel.
              </p>
            </div>
            <span className="text-xs font-semibold text-accent shrink-0">
              {portalLoading ? 'Opening…' : 'Manage'}
            </span>
          </button>
        ) : null}

        <EarningsPanel />

        {/* Appearance */}
        <div className="p-5 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
          <ThemePicker />
          <p className="text-[11px] text-foreground-faint mt-3 px-1">
            Saved on this device. Named palettes match the Quobby app themes.
          </p>
        </div>

        {/* Level Progress */}
        {profile && (
          <div className="p-5 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-green" />
                <span className="text-sm font-semibold text-foreground">
                  Level {level}
                </span>
              </div>
              <span className="text-xs text-foreground-faint">
                {totalXp.toLocaleString()} XP total
              </span>
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round(progress * 100)}%`,
                  background: 'linear-gradient(90deg, #4CAF50, #b8ff6b)',
                }}
              />
            </div>
            <p className="text-[11px] text-foreground-faint mt-1.5">
              {xpNeeded > 0
                ? `${xpNeeded.toLocaleString()} XP to Level ${level + 1}`
                : 'Max level reached'}
            </p>
          </div>
        )}

        {/* App Stats */}
        {profile && (
          <div>
            <h2 className="text-xs font-semibold text-foreground-faint uppercase tracking-wider mb-3 px-1">
              Quobby App Stats
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                icon={Flame}
                value={profile.current_streak}
                label="Day Streak"
                color="rgba(255, 149, 0, 0.15)"
              />
              <StatCard
                icon={Flame}
                value={profile.longest_streak}
                label="Best Streak"
                color="rgba(255, 69, 58, 0.15)"
              />
              <StatCard
                icon={BookOpen}
                value={profile.total_cards_studied.toLocaleString()}
                label="Cards Studied"
                color="rgba(90, 200, 250, 0.15)"
              />
              <StatCard
                icon={Zap}
                value={profile.study_points.toLocaleString()}
                label="Study Points"
                color="rgba(184, 255, 107, 0.15)"
              />
            </div>
          </div>
        )}

        {/* My Tutorials */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xs font-semibold text-foreground-faint uppercase tracking-wider">
              My Tutorials
              {!loadingTutorials && (
                <span className="ml-2 text-foreground-faint/50">
                  {tutorials.length}
                  {paidCount > 0 ? ` · ${paidCount} paid` : ''}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              <select
                value={tutorialSort}
                onChange={(e) => setTutorialSort(e.target.value as typeof tutorialSort)}
                className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1 text-[10px] text-foreground-muted focus:outline-none focus:border-accent/30"
              >
                <option value="recent">Recent</option>
                <option value="name">Name</option>
                <option value="plays">Plays</option>
                <option value="rating">Rating</option>
              </select>
              <Link
                href="/create"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/15 text-accent text-xs font-medium rounded-lg hover:bg-accent/25 transition-colors"
              >
                <Plus className="w-3 h-3" />
                New Tutorial
              </Link>
            </div>
          </div>

          {(uniqueCategories.length > 0 || paidCount > 0) && (
            <div className="flex flex-wrap gap-1.5 mb-3 px-1">
              <button
                type="button"
                onClick={() => { setCategoryFilter(null); setPaidOnly(false); }}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-colors ${!categoryFilter && !paidOnly ? 'bg-accent/15 text-accent border-accent/30' : 'bg-white/[0.03] text-foreground-faint border-white/[0.08] hover:border-white/[0.15]'}`}
              >
                All
              </button>
              {paidCount > 0 && (
                <button
                  type="button"
                  onClick={() => setPaidOnly((v) => !v)}
                  className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-colors ${paidOnly ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-white/[0.03] text-foreground-faint border-white/[0.08] hover:border-white/[0.15]'}`}
                >
                  Paid
                </button>
              )}
              {uniqueCategories.map((cat) => (
                <button
                  type="button"
                  key={cat.slug}
                  onClick={() => setCategoryFilter(categoryFilter === cat.slug ? null : cat.slug)}
                  className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-colors ${categoryFilter === cat.slug ? 'bg-accent/15 text-accent border-accent/30' : 'bg-white/[0.03] text-foreground-faint border-white/[0.08] hover:border-white/[0.15]'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {loadingTutorials ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-foreground-faint animate-spin" />
            </div>
          ) : tutorials.length === 0 ? (
            <div className="p-8 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-center">
              <BookOpen className="w-10 h-10 text-foreground-faint mx-auto mb-3" />
              <p className="text-sm text-foreground-muted mb-1">
                No tutorials yet
              </p>
              <p className="text-xs text-foreground-faint mb-4">
                Create your first interactive board game tutorial.
              </p>
              <Link
                href="/create"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-black text-sm font-semibold rounded-xl hover:bg-accent-light transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Tutorial
              </Link>
            </div>
          ) : drafts.length === 0 && published.length === 0 ? (
            <div className="p-8 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-center">
              <Tag className="w-10 h-10 text-foreground-faint mx-auto mb-3" />
              <p className="text-sm text-foreground-muted mb-1">
                {paidOnly ? 'No paid tutorials' : 'No tutorials match this filter'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {drafts.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-yellow-400/70 uppercase tracking-wider px-1 pt-1">
                    Drafts ({drafts.length})
                  </p>
                  {drafts.map((t) => (
                    <TutorialCard
                      key={t.id}
                      tutorial={t}
                      onDelete={handleDelete}
                    />
                  ))}
                </>
              )}
              {published.length > 0 && (
                <>
                  <p className="text-[10px] font-semibold text-green/70 uppercase tracking-wider px-1 pt-1">
                    Published ({published.length})
                  </p>
                  {published.map((t) => (
                    <TutorialCard
                      key={t.id}
                      tutorial={t}
                      onDelete={handleDelete}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Tutorial Analytics */}
        {!loadingTutorials && published.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <BarChart3 className="w-3.5 h-3.5 text-accent" />
              <h2 className="text-xs font-semibold text-foreground-faint uppercase tracking-wider">
                Tutorial Analytics
              </h2>
              {!isPremium && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-yellow-500/15 text-yellow-400 rounded-full font-semibold">
                  <Crown className="w-2.5 h-2.5" />
                  PRO
                </span>
              )}
            </div>

            <div className="relative">
              {!isPremium && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0d0d1a]/70 backdrop-blur-sm rounded-2xl">
                  <Lock className="w-6 h-6 text-yellow-400 mb-2" />
                  <p className="text-xs text-foreground-muted mb-3">
                    Upgrade to see your tutorial analytics
                  </p>
                  <button
                    onClick={() => setShowUpsell(true)}
                    className="px-4 py-2 text-xs font-semibold text-black bg-yellow-400 rounded-xl hover:bg-yellow-300 transition-colors"
                  >
                    Unlock Analytics
                  </button>
                </div>
              )}

              <div className={!isPremium ? 'select-none' : undefined}>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-center">
                    <Play className="w-4 h-4 text-accent mx-auto mb-1.5" />
                    <p className="text-lg font-bold text-foreground">
                      {isPremium
                        ? published.reduce((s, t) => s + (t.play_count ?? 0), 0).toLocaleString()
                        : '---'}
                    </p>
                    <p className="text-[10px] text-foreground-faint">Total Plays</p>
                  </div>
                  <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-center">
                    <Star className="w-4 h-4 text-yellow-400 mx-auto mb-1.5" />
                    <p className="text-lg font-bold text-foreground">
                      {isPremium
                        ? (() => {
                          const rated = published.filter((t) => t.rating_count > 0);
                          if (rated.length === 0) return '-';
                          return (rated.reduce((s, t) => s + t.rating_avg, 0) / rated.length).toFixed(1);
                        })()
                        : '---'}
                    </p>
                    <p className="text-[10px] text-foreground-faint">Avg Rating</p>
                  </div>
                  <div className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-center">
                    <Users className="w-4 h-4 text-green mx-auto mb-1.5" />
                    <p className="text-lg font-bold text-foreground">
                      {isPremium
                        ? published.reduce((s, t) => s + (t.rating_count ?? 0), 0).toLocaleString()
                        : '---'}
                    </p>
                    <p className="text-[10px] text-foreground-faint">Total Ratings</p>
                  </div>
                </div>

                {isPremium && (
                  <div className="space-y-1.5">
                    {published.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl"
                      >
                        <span className="text-xs text-foreground font-medium truncate flex-1 min-w-0">
                          {t.title}
                        </span>
                        <PaidBadge tutorial={t} />
                        <span className="flex items-center gap-1 text-[11px] text-foreground-faint shrink-0">
                          <Play className="w-3 h-3" />
                          {t.play_count ?? 0}
                        </span>
                        {t.rating_count > 0 && (
                          <span className="flex items-center gap-1 text-[11px] text-foreground-faint shrink-0">
                            <Star className="w-3 h-3 text-yellow-400" />
                            {t.rating_avg.toFixed(1)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Saved Tutorials */}
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Bookmark className="w-3.5 h-3.5 text-accent" />
            <h2 className="text-xs font-semibold text-foreground-faint uppercase tracking-wider">
              Saved Tutorials
              {!loadingSaved && (
                <span className="ml-2 text-foreground-faint/50">
                  {savedTutorials.length}
                </span>
              )}
            </h2>
          </div>

          {loadingSaved ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-foreground-faint animate-spin" />
            </div>
          ) : savedTutorials.length === 0 ? (
            <div className="p-8 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-center">
              <Bookmark className="w-10 h-10 text-foreground-faint mx-auto mb-3" />
              <p className="text-sm text-foreground-muted mb-1">
                No saved tutorials yet
              </p>
              <p className="text-xs text-foreground-faint">
                Bookmark tutorials from the{' '}
                <Link href="/tutorials" className="text-accent hover:text-accent-light">
                  browse page
                </Link>{' '}
                to find them here later.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedTutorials.map((t) => (
                <div
                  key={t.id}
                  className="p-5 bg-white/[0.03] border border-white/[0.06] rounded-2xl transition-all hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0">
                      {t.games?.title && (
                        <p className="text-[10px] text-foreground-faint font-medium uppercase tracking-wider mb-0.5">
                          {t.games.title}
                        </p>
                      )}
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {t.title}
                      </h3>
                    </div>
                    <PaidBadge tutorial={t} />
                  </div>
                  {t.description && (
                    <p className="text-xs text-foreground-muted line-clamp-2 mb-3">
                      {t.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-foreground-faint mb-4">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {t.estimated_minutes}m
                    </span>
                    {t.rating_count > 0 && (
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-400" />
                        {t.rating_avg.toFixed(1)}
                      </span>
                    )}
                    {t.play_count > 0 && (
                      <span className="flex items-center gap-1">
                        <Play className="w-3 h-3" />
                        {t.play_count}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/tutorials/${t.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/15 text-accent text-xs font-medium rounded-lg hover:bg-accent/25 transition-colors"
                    >
                      <Play className="w-3 h-3" />
                      Play
                    </Link>
                    <button
                      onClick={() => handleUnsave(t.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-foreground-faint text-xs font-medium rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors ml-auto"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showUpsell && (
        <PremiumUpsell
          feature="Tutorial analytics"
          onClose={() => setShowUpsell(false)}
        />
      )}
    </div>
  );
}