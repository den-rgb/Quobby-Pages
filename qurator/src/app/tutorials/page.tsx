'use client';

import { useAuth } from '@/lib/auth';
import { DEMO_CATEGORY_SLUGS, DEMO_CREATOR_ID, DEMO_TUTORIAL_LIST, DEMO_TUTORIALS } from '@/lib/demo-tutorials';
import { createClient } from '@/lib/supabase/client';
import type { Category, Tutorial } from '@/lib/types';
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Clock,
  Code2,
  Eye,
  Gamepad2,
  GitFork,
  Link2,
  Loader2,
  MessageCircle,
  Search,
  Share2,
  Star,
  Trash2,
  Users
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

function proxyImg(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('/')) return url;
  if (url.includes('.supabase.co/')) return url;
  return `/api/img?url=${encodeURIComponent(url)}`;
}

function GameCover({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-full h-full bg-white/[0.02] flex items-center justify-center">
        <Gamepad2 className="w-8 h-8 text-foreground-faint" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="w-full h-full object-cover object-top"
    />
  );
}

function ComplexityBadge({ level }: { level: number }) {
  const labels = ['', 'Easy', 'Light', 'Medium', 'Heavy', 'Expert'];
  const colors = [
    '',
    'bg-green/20 text-green',
    'bg-green/15 text-green',
    'bg-yellow-500/15 text-yellow-400',
    'bg-orange-500/15 text-orange-400',
    'bg-red-500/15 text-red-400',
  ];
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[level]}`}
    >
      {labels[level]}
    </span>
  );
}

interface TutorialWithGame extends Tutorial {
  games?: { title: string; bgg_image_url: string | null; complexity: number; min_players: number; max_players: number } | null;
  categories?: { name: string; slug: string } | null;
  profiles?: { display_name: string; avatar_emoji: string } | null;
}

export default function TutorialsPage() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [tutorials, setTutorials] = useState<TutorialWithGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [forkingId, setForkingId] = useState<string | null>(null);
  const [shareMenuId, setShareMenuId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'highest_rated' | 'following'>('popular');
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [demoCreatorProfile, setDemoCreatorProfile] = useState<{ display_name: string; avatar_emoji: string } | null>(null);

  useEffect(() => {
    fetch('/api/categories', { cache: 'no-store' }).then((r) => r.json()).then(setCategories).catch(() => { });
    const supabase = createClient();
    supabase
      .from('profiles')
      .select('display_name, avatar_emoji')
      .eq('id', DEMO_CREATOR_ID)
      .single()
      .then(({ data }) => {
        if (data) setDemoCreatorProfile(data);
      });
  }, []);

  useEffect(() => {
    if (!user) { setFollowedIds(new Set()); return; }
    const supabase = createClient();
    supabase
      .from('friendships')
      .select('following_id')
      .eq('follower_id', user.id)
      .then(({ data }) => {
        setFollowedIds(new Set((data ?? []).map((d: { following_id: string }) => d.following_id)));
      });
  }, [user]);

  useEffect(() => {
    setLoading(true);
    const supabase = createClient();
    let q = supabase
      .from('tutorials')
      .select('*, games(title, bgg_image_url, complexity, min_players, max_players), categories(name, slug), profiles!creator_id(display_name, avatar_emoji)')
      .eq('status', 'published');

    if (sortBy === 'popular') q = q.order('play_count', { ascending: false });
    else if (sortBy === 'newest') q = q.order('created_at', { ascending: false });
    else if (sortBy === 'highest_rated') q = q.order('rating_avg', { ascending: false });

    if (selectedCategoryId) {
      q = q.eq('category_id', selectedCategoryId);
    }

    q.then(({ data, error }) => {
      if (error) console.error('Failed to fetch tutorials:', error.message);
      const tuts = (data as TutorialWithGame[]) ?? [];
      setTutorials(tuts);
      setLoading(false);

      if (tuts.length > 0) {
        const ids = tuts.map((t) => t.id);
        supabase
          .from('tutorial_comments')
          .select('tutorial_id')
          .in('tutorial_id', ids)
          .then(({ data: comments }) => {
            if (comments) {
              const counts: Record<string, number> = {};
              comments.forEach((c) => {
                counts[c.tutorial_id] = (counts[c.tutorial_id] || 0) + 1;
              });
              setCommentCounts(counts);
            }
          });
      }
    });
  }, [selectedCategoryId, sortBy]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from('saved_tutorials')
      .select('tutorial_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setSavedIds(new Set(data.map((d) => d.tutorial_id)));
      });
  }, [user]);

  const toggleSave = useCallback(async (e: React.MouseEvent, tutorialId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    const supabase = createClient();
    if (savedIds.has(tutorialId)) {
      await supabase.from('saved_tutorials').delete().eq('user_id', user.id).eq('tutorial_id', tutorialId);
      setSavedIds((prev) => { const next = new Set(prev); next.delete(tutorialId); return next; });
    } else {
      await supabase.from('saved_tutorials').insert({ user_id: user.id, tutorial_id: tutorialId });
      setSavedIds((prev) => new Set(prev).add(tutorialId));
    }
  }, [user, savedIds]);

  const handleFork = useCallback(async (e: React.MouseEvent, tutorial: TutorialWithGame) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    setForkingId(tutorial.id);
    const supabase = createClient();

    const demoData = DEMO_TUTORIALS[tutorial.id];
    const isDemo = !!demoData;

    let steps: Record<string, unknown>[] | null = null;
    let objects: Record<string, unknown>[] | null = null;
    let variables: Record<string, unknown>[] | null = null;

    if (isDemo) {
      steps = demoData.steps.map((s, i) => ({
        id: crypto.randomUUID(),
        tutorial_id: tutorial.id,
        step_type: 'content' as const,
        sort_order: i,
        content_json: s,
        logic_json: null,
        position_x: 100,
        position_y: 100 + i * 150,
      }));
    } else {
      const [stepsRes, objectsRes, variablesRes] = await Promise.all([
        supabase.from('tutorial_steps').select('*').eq('tutorial_id', tutorial.id).order('sort_order'),
        supabase.from('tutorial_objects').select('*').eq('tutorial_id', tutorial.id),
        supabase.from('tutorial_variables').select('*').eq('tutorial_id', tutorial.id),
      ]);
      steps = stepsRes.data;
      objects = objectsRes.data;
      variables = variablesRes.data;
    }

    const newTutorialId = crypto.randomUUID();

    const { error: tutErr } = await supabase.from('tutorials').insert({
      id: newTutorialId,
      game_id: tutorial.game_id || null,
      category_id: tutorial.category_id || null,
      creator_id: user.id,
      title: `${tutorial.title} (Fork)`,
      description: tutorial.description,
      estimated_minutes: tutorial.estimated_minutes,
      cover_image_url: tutorial.cover_image_url || null,
      status: 'draft',
      version: 1,
      forked_from: tutorial.id,
    });

    if (!tutErr && steps && steps.length > 0) {
      const stepIdMap = new Map<string, string>();
      const newSteps = steps.map((s: Record<string, unknown>) => {
        const newId = crypto.randomUUID();
        stepIdMap.set(s.id as string, newId);
        return {
          id: newId,
          tutorial_id: newTutorialId,
          step_type: s.step_type,
          sort_order: s.sort_order,
          content_json: s.content_json,
          logic_json: s.logic_json,
          position_x: s.position_x,
          position_y: s.position_y,
        };
      });
      await supabase.from('tutorial_steps').insert(newSteps);

      if (!isDemo) {
        const oldStepIds = steps.map((s: Record<string, unknown>) => s.id as string);
        const { data: connections } = await supabase
          .from('tutorial_connections')
          .select('*')
          .in('from_step_id', oldStepIds);

        if (connections && connections.length > 0) {
          const newConns = connections
            .filter((c) => stepIdMap.has(c.from_step_id) && stepIdMap.has(c.to_step_id))
            .map((c) => ({
              id: crypto.randomUUID(),
              from_step_id: stepIdMap.get(c.from_step_id)!,
              to_step_id: stepIdMap.get(c.to_step_id)!,
              condition_json: c.condition_json,
            }));
          if (newConns.length > 0) {
            await supabase.from('tutorial_connections').insert(newConns);
          }
        }
      }
    }

    if (!tutErr && objects && objects.length > 0) {
      const newObjs = objects.map((o: Record<string, unknown>) => ({
        id: crypto.randomUUID(),
        tutorial_id: newTutorialId,
        name: o.name,
        component_type: o.component_type,
        image_url: o.image_url,
        properties_json: o.properties_json,
      }));
      await supabase.from('tutorial_objects').insert(newObjs);
    }

    if (!tutErr && variables && variables.length > 0) {
      const newVars = variables.map((v: Record<string, unknown>) => ({
        id: crypto.randomUUID(),
        tutorial_id: newTutorialId,
        name: v.name,
        variable_type: v.variable_type,
        default_value: v.default_value,
      }));
      await supabase.from('tutorial_variables').insert(newVars);
    }

    setForkingId(null);
    if (!tutErr) {
      router.push(`/create/new?load=${newTutorialId}`);
    }
  }, [user, router]);

  const handleDeleteTutorial = useCallback(async (e: React.MouseEvent, tutorialId: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    const reason = prompt(`Delete tutorial "${title}"?\n\nProvide a reason for removal (shown to the creator):`);
    if (reason === null) return;
    try {
      const params = new URLSearchParams({ id: tutorialId });
      if (reason.trim()) params.set('reason', reason.trim());
      const res = await fetch(`/api/admin/tutorials?${params}`, { method: 'DELETE' });
      if (res.ok) {
        setTutorials((prev) => prev.filter((t) => t.id !== tutorialId));
      }
    } catch { /* silent */ }
  }, []);

  const handleShare = useCallback((e: React.MouseEvent, tutorialId: string, type: 'link' | 'embed') => {
    e.preventDefault();
    e.stopPropagation();
    const origin = window.location.origin;
    const text = type === 'link'
      ? `${origin}/tutorials/${tutorialId}`
      : `<iframe src="${origin}/embed/${tutorialId}" width="100%" height="500" style="border:none;border-radius:12px;" allow="clipboard-write"></iframe>`;
    navigator.clipboard.writeText(text);
    setCopiedId(tutorialId);
    setShareMenuId(null);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const selectedCategorySlug = categories.find((c) => c.id === selectedCategoryId)?.slug;

  const allTutorials = [
    ...tutorials,
    ...DEMO_TUTORIAL_LIST.filter((demo) => {
      if (tutorials.some((t) => t.id === demo.id)) return false;
      if (selectedCategorySlug && demo.category_id) {
        const demoSlug = DEMO_CATEGORY_SLUGS[demo.category_id];
        if (demoSlug !== selectedCategorySlug) return false;
      }
      return true;
    }),
  ].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortBy === 'highest_rated') return (b.rating_avg ?? 0) - (a.rating_avg ?? 0);
    return (b.play_count ?? 0) - (a.play_count ?? 0);
  });

  const filtered = allTutorials.filter(
    (t) => {
      if (sortBy === 'following' && !followedIds.has(t.creator_id)) return false;
      if (!query) return true;
      const gameTitle = (t as TutorialWithGame).games?.title ?? t.game?.title ?? '';
      return (
        gameTitle.toLowerCase().includes(query.toLowerCase()) ||
        t.title.toLowerCase().includes(query.toLowerCase())
      );
    }
  );

  return (
    <div className="px-6 py-12" onClick={() => shareMenuId && setShareMenuId(null)}>
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-[clamp(2rem,5vw,3rem)] font-extrabold text-foreground tracking-tight mb-3">
            Browse Tutorials
          </h1>
          <p className="text-lg text-foreground-muted max-w-[500px] mx-auto">
            Find interactive tutorials for anything.
          </p>
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <button
              onClick={() => setSelectedCategoryId(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${!selectedCategoryId ? 'bg-accent text-black' : 'bg-white/[0.05] text-foreground-muted hover:text-foreground hover:bg-white/10 border border-border'}`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCategoryId === cat.id ? 'bg-accent text-black' : 'bg-white/[0.05] text-foreground-muted hover:text-foreground hover:bg-white/10 border border-border'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between max-w-xl mx-auto mb-6">
          <div className="relative flex-1 mr-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
            <input
              type="text"
              placeholder="Search by name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-2xl text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
            {([['popular', 'Popular'], ['newest', 'Newest'], ['highest_rated', 'Top Rated'], ...(user ? [['following', 'Following'] as const] : [])] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sortBy === key ? 'bg-accent text-black' : 'text-foreground-muted hover:text-foreground'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-foreground-faint animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Gamepad2 className="w-12 h-12 text-foreground-faint mx-auto mb-4" />
            <p className="text-foreground-muted">
              No tutorials found. Try a different search or{' '}
              <Link href="/create" className="text-accent hover:text-accent-light">
                create one
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((t) => {
              const tw = t as TutorialWithGame;
              const hasGame = !!(tw.games?.title || t.game?.title);
              const gameTitle = tw.games?.title ?? t.game?.title;
              const categoryName = tw.categories?.name ?? t.category?.name;
              const subtitle = gameTitle ?? categoryName ?? 'Tutorial';
              const complexity = tw.games?.complexity ?? t.game?.complexity;
              const minPlayers = tw.games?.min_players ?? t.game?.min_players;
              const maxPlayers = tw.games?.max_players ?? t.game?.max_players;
              const isDemo = !tw.profiles && t.creator_id === DEMO_CREATOR_ID;
              const creatorName = tw.profiles?.display_name ?? (isDemo ? demoCreatorProfile?.display_name : null) ?? t.creator?.display_name ?? 'Anonymous';
              const creatorEmoji = tw.profiles?.avatar_emoji ?? (isDemo ? demoCreatorProfile?.avatar_emoji : null) ?? t.creator?.avatar_emoji ?? '🎓';
              const commentCount = commentCounts[t.id] ?? 0;
              const isSaved = savedIds.has(t.id);

              const imgUrl = proxyImg(tw.games?.bgg_image_url ?? t.game?.bgg_image_url ?? t.cover_image_url ?? null);

              return (
                <Link
                  key={t.id}
                  href={`/tutorials/${t.id}`}
                  className="block bg-card border border-border rounded-2xl overflow-hidden transition-all hover:bg-card-hover hover:border-accent/10 hover:-translate-y-1 group relative"
                >
                  <div className="relative w-full aspect-[4/3] overflow-hidden bg-white/[0.02]">
                    <GameCover src={imgUrl} alt={subtitle} />
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-xs text-foreground-muted font-medium uppercase tracking-wider mb-1">
                          {subtitle}
                        </p>
                        <h3 className="text-base font-semibold text-foreground group-hover:text-accent-light transition-colors">
                          {t.title}
                        </h3>
                      </div>
                      {hasGame && complexity && <ComplexityBadge level={complexity} />}
                    </div>
                    {t.description && (
                      <p className="text-sm text-foreground-muted leading-relaxed mb-4 line-clamp-2">
                        {t.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-foreground-faint">
                      {t.rating_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-yellow-400" />
                          {t.rating_avg.toFixed(1)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {t.estimated_minutes}m
                      </span>
                      {hasGame && minPlayers && maxPlayers && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {minPlayers}-{maxPlayers}p
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        {t.play_count ?? 0}
                      </span>
                      {commentCount > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3.5 h-3.5" />
                          {commentCount}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-xs text-foreground-faint">
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/profile/${t.creator_id}`); }}
                        className="flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-lg hover:bg-white/[0.06] hover:text-accent transition-all group"
                      >
                        <span>{creatorEmoji}</span>
                        <span className="group-hover:underline">{creatorName}</span>
                      </button>
                      <span className="flex-1" />
                      <div className="flex items-center gap-1">
                        <div className="relative">
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShareMenuId(shareMenuId === t.id ? null : t.id); }}
                            className={`p-1.5 rounded-md transition-colors ${copiedId === t.id ? 'text-green' : 'text-foreground-faint hover:text-foreground'}`}
                            title="Share tutorial"
                          >
                            {copiedId === t.id ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                          </button>
                          {shareMenuId === t.id && (
                            <div className="absolute right-0 bottom-full mb-1 w-48 bg-background-secondary border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                              <button
                                onClick={(e) => handleShare(e, t.id, 'link')}
                                className="w-full text-left px-3 py-2.5 text-xs text-foreground-secondary hover:bg-white/[0.04] transition-colors flex items-center gap-2"
                              >
                                <Link2 className="w-3.5 h-3.5" /> Copy link
                              </button>
                              <button
                                onClick={(e) => handleShare(e, t.id, 'embed')}
                                className="w-full text-left px-3 py-2.5 text-xs text-foreground-secondary hover:bg-white/[0.04] transition-colors flex items-center gap-2 border-t border-border"
                              >
                                <Code2 className="w-3.5 h-3.5" />
                                <span>Copy embed code<br /><span className="text-[10px] text-foreground-faint">For websites &amp; blogs</span></span>
                              </button>
                            </div>
                          )}
                        </div>
                        {user && (
                          <>
                            <button
                              onClick={(e) => toggleSave(e, t.id)}
                              className={`p-1.5 rounded-md transition-colors ${isSaved ? 'text-accent' : 'text-foreground-faint hover:text-foreground'}`}
                              title={isSaved ? 'Remove from saved' : 'Save for later'}
                            >
                              {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                            </button>
                            {t.creator_id !== user.id && (
                              <button
                                onClick={(e) => handleFork(e, tw)}
                                disabled={forkingId === t.id}
                                className="p-1.5 rounded-md text-foreground-faint hover:text-foreground transition-colors disabled:opacity-50"
                                title="Fork this tutorial"
                              >
                                {forkingId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitFork className="w-4 h-4" />}
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={(e) => handleDeleteTutorial(e, t.id, t.title)}
                                className="p-1.5 rounded-md text-foreground-faint hover:text-red-400 transition-colors"
                                title="Delete tutorial (admin)"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
