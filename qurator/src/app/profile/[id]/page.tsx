'use client';

import { useAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';
import type { Tutorial } from '@/lib/types';
import {
  ArrowLeft,
  Clock,
  Loader2,
  Play,
  Star,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface PublicProfile {
  id: string;
  display_name: string;
  avatar_emoji: string;
  avatar_background_color_hex: string;
  name_color_hex: string;
}

interface PublicTutorial extends Tutorial {
  games?: { title: string; bgg_image_url: string | null } | null;
  categories?: { name: string } | null;
}

export default function PublicProfilePage() {
  const params = useParams();
  const profileId = params.id as string;
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [tutorials, setTutorials] = useState<PublicTutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  const fetchProfile = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_emoji, avatar_background_color_hex, name_color_hex')
      .eq('id', profileId)
      .single();
    setProfile(prof as PublicProfile | null);

    const { data: tuts } = await supabase
      .from('tutorials')
      .select('*, games(title, bgg_image_url), categories(name)')
      .eq('creator_id', profileId)
      .eq('status', 'published')
      .order('updated_at', { ascending: false });
    setTutorials((tuts as PublicTutorial[]) ?? []);

    const { count } = await supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', profileId);
    setFollowerCount(count ?? 0);

    if (user) {
      const { data: follow } = await supabase
        .from('friendships')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', profileId)
        .maybeSingle();
      setIsFollowing(!!follow);
    }

    setLoading(false);
  }, [profileId, user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleFollow = async () => {
    if (!user) return;
    const supabase = createClient();
    setFollowLoading(true);
    if (isFollowing) {
      await supabase
        .from('friendships')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', profileId);
      setIsFollowing(false);
      setFollowerCount((c) => Math.max(0, c - 1));
    } else {
      await supabase
        .from('friendships')
        .insert({ follower_id: user.id, following_id: profileId });
      const displayName = user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'Someone';
      await supabase.from('notifications').insert({
        user_id: profileId,
        type: 'new_follower',
        from_user_id: user.id,
        message: `${displayName} started following you`,
      });
      setIsFollowing(true);
      setFollowerCount((c) => c + 1);
    }
    setFollowLoading(false);
  };

  const isOwnProfile = user?.id === profileId;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-foreground-faint animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-foreground-muted">User not found.</p>
        <Link href="/tutorials" className="text-accent text-sm mt-2 inline-block">
          Back to tutorials
        </Link>
      </div>
    );
  }

  return (
    <div className="px-6 py-12 max-w-2xl mx-auto">
      <Link
        href="/tutorials"
        className="inline-flex items-center gap-1.5 text-xs text-foreground-faint hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to tutorials
      </Link>

      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl"
          style={{ background: `#${profile.avatar_background_color_hex || '2a2a3e'}` }}
        >
          {profile.avatar_emoji}
        </div>
        <div className="flex-1 min-w-0">
          <h1
            className="text-lg font-bold"
            style={{ color: `#${profile.name_color_hex || 'FFFFFF'}` }}
          >
            {profile.display_name}
          </h1>
          <p className="text-xs text-foreground-faint">
            {followerCount} follower{followerCount !== 1 ? 's' : ''} · {tutorials.length} tutorial{tutorials.length !== 1 ? 's' : ''}
          </p>
        </div>
        {user && !isOwnProfile && (
          <button
            onClick={handleFollow}
            disabled={followLoading}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${isFollowing
              ? 'bg-white/[0.05] text-foreground-muted hover:bg-red-500/10 hover:text-red-400'
              : 'bg-accent/15 text-accent hover:bg-accent/25'
              }`}
          >
            {isFollowing ? (
              <>
                <UserMinus className="w-3.5 h-3.5" />
                Unfollow
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5" />
                Follow
              </>
            )}
          </button>
        )}
      </div>

      {tutorials.length === 0 ? (
        <div className="p-8 bg-white/[0.03] border border-white/[0.06] rounded-2xl text-center">
          <p className="text-sm text-foreground-muted">No published tutorials yet.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {tutorials.map((t) => (
            <Link
              key={t.id}
              href={`/tutorials/${t.id}`}
              className="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl hover:bg-white/[0.05] transition-all block"
            >
              {t.games?.title && (
                <p className="text-[10px] text-foreground-faint font-medium uppercase tracking-wider mb-0.5">
                  {t.games.title}
                </p>
              )}
              <h3 className="text-sm font-semibold text-foreground mb-1">
                {t.title}
              </h3>
              {t.description && (
                <p className="text-xs text-foreground-muted line-clamp-2 mb-2">
                  {t.description}
                </p>
              )}
              <div className="flex items-center gap-3 text-[11px] text-foreground-faint">
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
                {t.categories?.name && (
                  <span className="px-1.5 py-0.5 bg-white/[0.05] rounded text-[10px]">
                    {t.categories.name}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
