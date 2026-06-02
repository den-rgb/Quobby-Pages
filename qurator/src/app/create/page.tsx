'use client';

import { useAuth } from '@/lib/auth';
import { complexityFromWeight, searchBGG } from '@/lib/bgg';
import { createClient } from '@/lib/supabase/client';
import type { BGGSearchResult, Category } from '@/lib/types';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Atom,
  ChefHat,
  Clock,
  Code,
  Gamepad2,
  Hammer,
  Loader2,
  LogIn,
  Music,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Gamepad2, ChefHat, Hammer, Code, Music, Trophy, Sparkles, Atom,
};

function ComplexityTag({ level }: { level: number }) {
  const dotColors = [
    '',
    'bg-green-400',
    'bg-lime-400',
    'bg-yellow-400',
    'bg-orange-400',
    'bg-red-400',
  ];
  const color = dotColors[Math.min(Math.max(level, 1), 5)];
  return (
    <div className="flex items-center gap-0.5" title={['', 'Easy', 'Light', 'Medium', 'Heavy', 'Expert'][Math.min(Math.max(level, 1), 5)]}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i <= level ? color : 'bg-white/10'}`}
        />
      ))}
    </div>
  );
}

function gameFromRow(g: Record<string, unknown>): BGGSearchResult {
  return {
    id: (g.bgg_id as number) ?? 0,
    name: g.title as string,
    year_published: (g.year_published as number) ?? null,
    image: (g.bgg_image_url as string) ?? null,
    thumbnail: (g.bgg_image_url as string) ?? null,
    description: (g.description as string) ?? '',
    min_players: (g.min_players as number) ?? 1,
    max_players: (g.max_players as number) ?? 4,
    playing_time: (g.play_time_minutes as number) ?? 30,
    average_weight: (g.complexity as number) ?? 2,
    bgg_rating: (g.bgg_rating as number) ?? 0,
    dbId: (g.id as string) ?? undefined,
  };
}

export default function CreatePage() {
  const { user, signIn, isAdmin } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BGGSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedGame, setSelectedGame] = useState<BGGSearchResult | null>(null);
  const [tutorialTitle, setTutorialTitle] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMinPlayers, setCustomMinPlayers] = useState(2);
  const [customMaxPlayers, setCustomMaxPlayers] = useState(4);
  const [customPlayTime, setCustomPlayTime] = useState(30);
  const [customComplexity, setCustomComplexity] = useState(2);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [popularGames, setPopularGames] = useState<BGGSearchResult[]>([]);
  const [popularLoading, setPopularLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/categories', { cache: 'no-store' });
        if (res.ok) setCategories(await res.json());
      } catch { /* silent */ }
      finally { setCategoriesLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (selectedCategory?.slug !== 'board-games') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/games/popular');
        if (!res.ok) throw new Error();
        const rows = await res.json();
        if (!cancelled) setPopularGames(rows.map(gameFromRow));
      } catch { /* silent */ }
      finally { if (!cancelled) setPopularLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [selectedCategory]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/game-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('tutorial-assets').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('tutorial-assets').getPublicUrl(path);
      setCustomImage(urlData.publicUrl);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  }, [user]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    setSearchError(null);
    try {
      const supabase = createClient();
      const [{ data: cachedGames }, bggResults] = await Promise.all([
        supabase
          .from('games')
          .select('id, title, bgg_id, bgg_image_url, bgg_rating, description, complexity, min_players, max_players, play_time_minutes, year_published')
          .ilike('title', `%${query.trim()}%`)
          .limit(10),
        searchBGG(query.trim()).catch(() => [] as BGGSearchResult[]),
      ]);

      const localResults: BGGSearchResult[] = (cachedGames ?? []).map(gameFromRow);

      const bggImageMap = new Map<number, string>();
      for (const bg of bggResults) {
        if (bg.id && bg.image) bggImageMap.set(bg.id, bg.image);
      }
      for (const lr of localResults) {
        if (!lr.image && lr.id && bggImageMap.has(lr.id)) {
          lr.image = bggImageMap.get(lr.id)!;
          lr.thumbnail = lr.image;
        }
      }

      const seenIds = new Set(localResults.map((r) => r.id));
      const extra = bggResults.filter((bg) => bg.id && !seenIds.has(bg.id));
      const merged = [...localResults, ...extra];

      setResults(merged);

      if (merged.length === 0) {
        setSearchError('No games found. Pick from popular games below or add your game manually.');
      }
    } catch {
      setResults([]);
      setSearchError('Search failed. Pick from popular games below or add your game manually.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleSelectGame = useCallback((game: BGGSearchResult) => {
    setSelectedGame(game);
    setTutorialTitle(`Learn ${game.name}`.slice(0, 40));

    fetch('/api/games/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: game.name,
        bgg_id: game.id || null,
        bgg_image_url: game.image,
        bgg_rating: game.bgg_rating || null,
        description: game.description?.slice(0, 500) ?? '',
        complexity: complexityFromWeight(game.average_weight),
        min_players: game.min_players,
        max_players: game.max_players,
        play_time_minutes: game.playing_time,
        year_published: game.year_published,
      }),
    }).catch(() => { });
  }, []);

  const handleDeleteGame = useCallback(async (game: BGGSearchResult) => {
    if (!game.dbId || !confirm(`Delete "${game.name}" from the database?`)) return;
    try {
      const res = await fetch(`/api/admin/games?id=${game.dbId}`, { method: 'DELETE' });
      if (res.ok) {
        setPopularGames((prev) => prev.filter((g) => g.dbId !== game.dbId));
        setResults((prev) => prev.filter((g) => g.dbId !== game.dbId));
      }
    } catch { /* silent */ }
  }, []);

  const handleCreate = useCallback(() => {
    if (!tutorialTitle.trim() || !selectedCategory) return;
    const params = new URLSearchParams({ title: tutorialTitle, category: JSON.stringify(selectedCategory) });

    if (selectedGame) {
      params.set('game', JSON.stringify({
        bgg_id: selectedGame.id || null,
        title: selectedGame.name,
        complexity: complexityFromWeight(selectedGame.average_weight),
        min_players: selectedGame.min_players,
        max_players: selectedGame.max_players,
        play_time_minutes: selectedGame.playing_time,
        year_published: selectedGame.year_published ?? null,
        description: selectedGame.description.slice(0, 500),
        bgg_image_url: selectedGame.image,
        bgg_rating: selectedGame.bgg_rating || null,
      }));
    }

    router.push(`/create/new?${params.toString()}`);
  }, [selectedGame, selectedCategory, tutorialTitle, router]);

  const isBoardGames = selectedCategory?.slug === 'board-games';

  const titlePlaceholder: Record<string, string> = {
    'cooking': 'e.g. How to bake sourdough bread',
    'software': 'e.g. Build a REST API with Express',
    'music': 'e.g. Learn your first 4 guitar chords',
    'science': 'e.g. How batteries work',
    'sports': 'e.g. Understanding the offside rule',
    'diy-crafts': 'e.g. Build a floating shelf',
    'other': 'e.g. How to solve a Rubik\'s cube',
  };

  return (
    <div className="px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-[clamp(2rem,5vw,3rem)] font-extrabold text-foreground tracking-tight mb-3">
            Create a Tutorial
          </h1>
          <p className="text-lg text-foreground-muted max-w-[500px] mx-auto">
            Teach anything — pick a category and start building.
          </p>
        </div>

        {/* Step 1: Pick a category */}
        {!selectedCategory && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-4">
              1. Choose a category
            </label>
            {categoriesLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-28 bg-card border border-border rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {categories.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat.icon ?? ''] ?? Sparkles;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat)}
                      className="flex flex-col items-center justify-center gap-2 p-6 bg-card border border-border rounded-xl hover:bg-card-hover hover:border-accent/20 hover:-translate-y-0.5 transition-all text-center cursor-pointer"
                    >
                      <Icon className="w-7 h-7 text-accent" />
                      <span className="text-sm font-semibold text-foreground">{cat.name}</span>
                      {cat.description && (
                        <span className="text-[10px] text-foreground-faint leading-tight">{cat.description}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Board Games → game search */}
        {selectedCategory && isBoardGames && !selectedGame && !showCustomForm && (
          <div>
            <button onClick={() => { setSelectedCategory(null); setResults([]); setSearched(false); }} className="flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors mb-6">
              <ArrowLeft className="w-4 h-4" /> Change category
            </button>
            <label className="block text-sm font-medium text-foreground mb-2">
              2. Find your game
            </label>
            <div className="flex gap-3 mb-8">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
                <input
                  type="text"
                  placeholder="Search for a board game..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    if (!e.target.value.trim()) { setSearched(false); setResults([]); }
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-12 pr-4 py-3.5 bg-card border border-border rounded-2xl text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30 transition-colors"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={loading || query.trim().length === 0}
                className="px-6 py-3.5 bg-accent text-black font-semibold rounded-2xl hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                Search
              </button>
            </div>

            {loading && (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-3" />
                <p className="text-foreground-muted text-sm">Searching games...</p>
              </div>
            )}

            {searchError && !loading && (
              <div className="flex items-start gap-3 py-4 px-5 bg-red-500/5 border border-red-500/10 rounded-2xl mb-8">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 text-sm">{searchError}</p>
                  <button onClick={() => setShowCustomForm(true)} className="text-accent text-xs mt-1 hover:text-accent-light transition-colors">
                    Add your game manually instead
                  </button>
                </div>
              </div>
            )}

            {!loading && searched && results.length === 0 && !searchError && (
              <div className="text-center py-12">
                <Gamepad2 className="w-10 h-10 text-foreground-faint mx-auto mb-3" />
                <p className="text-foreground-muted">No games found for &ldquo;{query}&rdquo;. Try a different search term.</p>
              </div>
            )}

            {!loading && results.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-foreground-muted mb-3">Search Results</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {results.map((game) => (
                    <GameCard key={game.id} game={game} onSelect={handleSelectGame} onDelete={isAdmin && game.dbId ? handleDeleteGame : undefined} />
                  ))}
                </div>
              </div>
            )}

            {!loading && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-accent" />
                    <h3 className="text-sm font-medium text-foreground">Popular Games</h3>
                    <span className="text-xs text-foreground-faint">&mdash; or pick one to get started</span>
                  </div>
                  <button onClick={() => setShowCustomForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground border border-border hover:border-accent/20 rounded-lg transition-all">
                    <PenLine className="w-3.5 h-3.5" /> Add manually
                  </button>
                </div>

                {popularLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex flex-col bg-card border border-border rounded-xl overflow-hidden animate-pulse">
                        <div className="w-full aspect-[4/3] bg-white/[0.03]" />
                        <div className="p-3 space-y-2"><div className="h-4 bg-white/[0.05] rounded w-3/4" /><div className="h-3 bg-white/[0.03] rounded w-1/2" /></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {popularGames.map((game, idx) => (
                      <GameCard key={game.id || `custom-${idx}`} game={game} onSelect={handleSelectGame} onDelete={isAdmin ? handleDeleteGame : undefined} compact />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Custom game form (Board Games) */}
        {selectedCategory && isBoardGames && !selectedGame && showCustomForm && (
          <div className="max-w-xl mx-auto">
            <button onClick={() => setShowCustomForm(false)} className="text-sm text-foreground-muted hover:text-foreground transition-colors mb-6">
              &larr; Back to search
            </button>

            <h2 className="text-lg font-semibold text-foreground mb-6">Add your game</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Game name *</label>
                <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Catan, Wingspan, Ticket to Ride"
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30 transition-colors" autoFocus />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Game image</label>
                <div className="flex items-center gap-4">
                  {customImage ? (
                    <img src={customImage} alt="Game" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-white/[0.03] flex items-center justify-center shrink-0">
                      <Gamepad2 className="w-6 h-6 text-foreground-faint" />
                    </div>
                  )}
                  <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm cursor-pointer hover:border-accent/20 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : 'text-foreground-muted hover:text-foreground'}`}>
                    {uploading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>) : (<>{customImage ? 'Change image' : 'Upload image'}</>)}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageUpload(file); }} />
                  </label>
                </div>
                {!user && <p className="text-xs text-foreground-faint mt-1.5">Sign in to upload an image.</p>}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1.5">Min players</label>
                  <input type="number" min={1} max={20} value={customMinPlayers} onChange={(e) => setCustomMinPlayers(Number(e.target.value) || 1)}
                    className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-foreground text-sm focus:outline-none focus:border-accent/30 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1.5">Max players</label>
                  <input type="number" min={1} max={20} value={customMaxPlayers} onChange={(e) => setCustomMaxPlayers(Number(e.target.value) || 4)}
                    className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-foreground text-sm focus:outline-none focus:border-accent/30 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1.5">Play time (min)</label>
                  <input type="number" min={5} max={600} value={customPlayTime} onChange={(e) => setCustomPlayTime(Number(e.target.value) || 30)}
                    className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-foreground text-sm focus:outline-none focus:border-accent/30 transition-colors" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground-muted mb-2">Complexity</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((level) => {
                    const labels = ['Easy', 'Light', 'Medium', 'Heavy', 'Expert'];
                    return (
                      <button key={level} onClick={() => setCustomComplexity(level)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${customComplexity === level ? 'bg-accent/15 border-accent/30 text-accent' : 'border-border text-foreground-muted hover:text-foreground hover:border-foreground-faint'}`}>
                        {labels[level - 1]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (!customName.trim()) return;
                handleSelectGame({ id: 0, name: customName.trim(), year_published: null, image: customImage, thumbnail: customImage, description: '', min_players: customMinPlayers, max_players: customMaxPlayers, playing_time: customPlayTime, average_weight: customComplexity, bgg_rating: 0 });
                setShowCustomForm(false);
              }}
              disabled={customName.trim().length === 0}
              className="w-full mt-8 flex items-center justify-center gap-2 px-6 py-3.5 bg-accent text-black font-semibold rounded-2xl hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Plus className="w-5 h-5" /> Use This Game
            </button>
          </div>
        )}

        {/* Step 2 (non-board-games): enter title */}
        {selectedCategory && !isBoardGames && !selectedGame && (
          <div className="max-w-xl mx-auto">
            <button onClick={() => setSelectedCategory(null)} className="flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground transition-colors mb-6">
              <ArrowLeft className="w-4 h-4" /> Change category
            </button>

            {!user && (
              <div className="flex items-center gap-3 p-4 bg-accent/5 border border-accent/15 rounded-xl mb-6">
                <LogIn className="w-5 h-5 text-accent shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-foreground">Sign in to save your tutorial</p>
                  <p className="text-xs text-foreground-muted">You can explore the editor, but you&apos;ll need an account to save and publish.</p>
                </div>
                <button onClick={() => signIn()} className="px-4 py-1.5 bg-accent text-black text-xs font-semibold rounded-lg hover:bg-accent-light transition-colors shrink-0">
                  Sign In
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl mb-8">
              {(() => { const Icon = CATEGORY_ICONS[selectedCategory.icon ?? ''] ?? Sparkles; return <Icon className="w-6 h-6 text-accent shrink-0" />; })()}
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{selectedCategory.name}</h3>
                <p className="text-xs text-foreground-muted">{selectedCategory.description}</p>
              </div>
            </div>

            <label className="block text-sm font-medium text-foreground mb-2">
              2. Name your tutorial
            </label>
            <div className="relative mb-8">
              <input
                type="text"
                value={tutorialTitle}
                onChange={(e) => setTutorialTitle(e.target.value.slice(0, 40))}
                maxLength={40}
                placeholder={titlePlaceholder[selectedCategory.slug] ?? 'e.g. Name your tutorial'}
                className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30 transition-colors"
                autoFocus
              />
              <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-xs ${tutorialTitle.length >= 35 ? 'text-orange-400' : 'text-foreground-faint'}`}>
                {tutorialTitle.length}/40
              </span>
            </div>

            <button
              onClick={handleCreate}
              disabled={tutorialTitle.trim().length === 0}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-accent text-black font-semibold rounded-2xl hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed transition-all text-lg"
            >
              <Plus className="w-5 h-5" /> Open Editor
            </button>
          </div>
        )}

        {/* Step 3 (Board Games): configure tutorial after selecting game */}
        {selectedCategory && isBoardGames && selectedGame && (
          <div className="max-w-xl mx-auto">
            {!user && (
              <div className="flex items-center gap-3 p-4 bg-accent/5 border border-accent/15 rounded-xl mb-6">
                <LogIn className="w-5 h-5 text-accent shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-foreground">Sign in to save your tutorial</p>
                  <p className="text-xs text-foreground-muted">You can explore the editor, but you&apos;ll need an account to save and publish.</p>
                </div>
                <button onClick={() => signIn()} className="px-4 py-1.5 bg-accent text-black text-xs font-semibold rounded-lg hover:bg-accent-light transition-colors shrink-0">
                  Sign In
                </button>
              </div>
            )}
            <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl mb-8">
              {proxyImg(selectedGame.image ?? selectedGame.thumbnail) ? (
                <img src={proxyImg(selectedGame.image ?? selectedGame.thumbnail)!} alt={selectedGame.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-white/[0.03] flex items-center justify-center shrink-0">
                  <Gamepad2 className="w-6 h-6 text-foreground-faint" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{selectedGame.name}</h3>
                <div className="flex items-center gap-3 text-xs text-foreground-muted mt-1">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{selectedGame.min_players}-{selectedGame.max_players}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{selectedGame.playing_time}m</span>
                  <ComplexityTag level={complexityFromWeight(selectedGame.average_weight)} />
                </div>
              </div>
              <button onClick={() => { setSelectedGame(null); setTutorialTitle(''); }} className="text-sm text-foreground-muted hover:text-foreground transition-colors">
                Change
              </button>
            </div>

            <label className="block text-sm font-medium text-foreground mb-2">
              3. Name your tutorial
            </label>
            <div className="relative mb-8">
              <input
                type="text"
                value={tutorialTitle}
                onChange={(e) => setTutorialTitle(e.target.value.slice(0, 40))}
                maxLength={40}
                placeholder="e.g. Learn Catan in 10 Minutes"
                className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30 transition-colors"
              />
              <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-xs ${tutorialTitle.length >= 35 ? 'text-orange-400' : 'text-foreground-faint'}`}>
                {tutorialTitle.length}/40
              </span>
            </div>

            <button
              onClick={handleCreate}
              disabled={tutorialTitle.trim().length === 0}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-accent text-black font-semibold rounded-2xl hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed transition-all text-lg"
            >
              <Plus className="w-5 h-5" /> Open Editor
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function proxyImg(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('/')) return url;
  if (url.includes('.supabase.co/')) return url;
  return `/api/img?url=${encodeURIComponent(url)}`;
}

function GameImg({ src, alt, className, iconSize = 'w-8 h-8' }: { src: string | null; alt: string; className: string; iconSize?: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`${className} bg-white/[0.02] flex items-center justify-center`}>
        <Gamepad2 className={`${iconSize} text-foreground-faint`} />
      </div>
    );
  }

  return <img src={src} alt={alt} onError={() => setFailed(true)} className={`${className} object-cover`} />;
}

function GameCard({ game, onSelect, onDelete, compact = false }: { game: BGGSearchResult; onSelect: (game: BGGSearchResult) => void; onDelete?: (game: BGGSearchResult) => void; compact?: boolean }) {
  const complexity = complexityFromWeight(game.average_weight);
  const imgSrc = proxyImg(game.image ?? game.thumbnail);

  if (compact) {
    return (
      <div className="relative flex flex-col bg-card border border-border rounded-xl overflow-hidden hover:bg-card-hover hover:border-accent/10 hover:-translate-y-0.5 transition-all text-left group">
        {onDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(game); }} className="absolute top-2 right-2 z-10 p-1.5 bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80" title="Delete game">
            <Trash2 className="w-3.5 h-3.5 text-white" />
          </button>
        )}
        <button onClick={() => onSelect(game)} className="flex flex-col flex-1 text-left">
          <div className="w-full aspect-[4/3] overflow-hidden bg-white/[0.02]">
            <GameImg src={imgSrc} alt={game.name} className="w-full h-full group-hover:scale-105 transition-transform duration-300" />
          </div>
          <div className="p-3 flex-1 flex flex-col">
            <h4 className="text-sm font-semibold text-foreground mb-1 line-clamp-1 group-hover:text-accent-light transition-colors">{game.name}</h4>
            <div className="flex items-center gap-2 text-[10px] text-foreground-faint mt-auto flex-wrap">
              <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{game.min_players}-{game.max_players}</span>
              <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{game.playing_time}m</span>
              <ComplexityTag level={complexity} />
              {game.bgg_rating > 0 && (
                <span className="text-orange-300 font-medium">{game.bgg_rating.toFixed(1)}/10 BGG</span>
              )}
            </div>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:bg-card-hover hover:border-accent/10 transition-all text-left group">
      <button onClick={() => onSelect(game)} className="flex items-center gap-4 flex-1 min-w-0 text-left">
        <GameImg src={imgSrc} alt={game.name} className="w-16 h-16 rounded-lg shrink-0" iconSize="w-6 h-6" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate group-hover:text-accent-light transition-colors">
            {game.name}
            {game.year_published && <span className="text-foreground-faint font-normal ml-2">({game.year_published})</span>}
          </h3>
          <div className="flex items-center gap-3 text-xs text-foreground-muted mt-1">
            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{game.min_players}-{game.max_players}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{game.playing_time}m</span>
            <ComplexityTag level={complexity} />
            {game.bgg_rating > 0 && (
              <span className="text-orange-300 font-medium">{game.bgg_rating.toFixed(1)}/10 BGG</span>
            )}
          </div>
        </div>
      </button>
      {onDelete ? (
        <button onClick={() => onDelete(game)} className="p-2 text-foreground-faint hover:text-red-400 transition-colors shrink-0" title="Delete game">
          <Trash2 className="w-4 h-4" />
        </button>
      ) : (
        <ArrowRight className="w-5 h-5 text-foreground-faint group-hover:text-accent transition-colors shrink-0" />
      )}
    </div>
  );
}
