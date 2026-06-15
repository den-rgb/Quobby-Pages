'use client';

import { useAuth } from '@/lib/auth';
import { complexityFromWeight, searchBGG } from '@/lib/bgg';
import { loadTutorial, saveTutorial } from '@/lib/persistence';
import { useEditorStore } from '@/lib/store';
import { validateTutorialGraph, type GraphIssue } from '@/lib/tutorial-navigation';
import type { BGGSearchResult, Category, Game } from '@/lib/types';
import {
  AlertTriangle,
  ArrowLeft,
  Book,
  BookOpen,
  Box,
  Check,
  Eye,
  FileText,
  Gamepad2,
  Globe,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Variable,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ContentPanel } from './content-panel';
import { FlowEditor } from './flow-editor';
import { ObjectsPanel } from './objects-panel';
import { OnboardingOverlay } from './onboarding-overlay';
import { TutorialPreview } from './tutorial-preview';
import { VariablesPanel } from './variables-panel';

export type SidebarId = 'content' | 'variables' | 'objects' | 'preview' | null;

const sidebarButtons: {
  id: Exclude<SidebarId, null>;
  label: string;
  icon: React.ElementType;
}[] = [
    { id: 'content', label: 'Content', icon: FileText },
    { id: 'variables', label: 'Variables', icon: Variable },
    { id: 'objects', label: 'Objects', icon: Box },
    { id: 'preview', label: 'Preview', icon: Eye },
  ];

export function EditorShell() {
  const searchParams = useSearchParams();
  const [activeSidebar, setActiveSidebar] = useState<SidebarId>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const { user, signIn } = useAuth();
  const { tutorial, game, category, steps, connections, setTutorial, setGame, setCategory, isDirty } =
    useEditorStore();
  const [publishIssues, setPublishIssues] = useState<GraphIssue[]>([]);
  const [showPublishIssues, setShowPublishIssues] = useState(false);
  const [showGameSwitch, setShowGameSwitch] = useState(false);
  const [gameQuery, setGameQuery] = useState('');
  const [gameResults, setGameResults] = useState<BGGSearchResult[]>([]);
  const [gameSearching, setGameSearching] = useState(false);

  const handleGameSearch = useCallback(async () => {
    if (!gameQuery.trim()) return;
    setGameSearching(true);
    try {
      const results = await searchBGG(gameQuery.trim());
      setGameResults(results);
    } catch {
      setGameResults([]);
    } finally {
      setGameSearching(false);
    }
  }, [gameQuery]);

  const handleGameSwitch = useCallback((result: BGGSearchResult) => {
    const newGame: Game = {
      id: crypto.randomUUID(),
      title: result.name,
      bgg_id: result.id || null,
      bgg_image_url: result.image,
      bgg_rating: result.bgg_rating || null,
      description: result.description?.slice(0, 500) ?? '',
      complexity: complexityFromWeight(result.average_weight),
      min_players: result.min_players,
      max_players: result.max_players,
      play_time_minutes: result.playing_time,
      year_published: result.year_published,
      created_at: new Date().toISOString(),
    };
    setGame(newGame);
    if (tutorial) {
      setTutorial({ ...tutorial, game_id: null });
    }
    setShowGameSwitch(false);
    setGameQuery('');
    setGameResults([]);

    fetch('/api/games/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newGame.title,
        bgg_id: newGame.bgg_id,
        bgg_image_url: newGame.bgg_image_url,
        bgg_rating: newGame.bgg_rating,
        description: newGame.description,
        complexity: newGame.complexity,
        min_players: newGame.min_players,
        max_players: newGame.max_players,
        play_time_minutes: newGame.play_time_minutes,
        year_published: newGame.year_published,
      }),
    }).catch(() => { });
  }, [tutorial, setGame, setTutorial]);

  useEffect(() => {
    const loadParam = searchParams.get('load');

    if (loadParam) {
      loadTutorial(loadParam).then((result) => {
        if (result.error) console.error('Failed to load tutorial:', result.error);
      });
      return;
    }

    const gameParam = searchParams.get('game');
    const titleParam = searchParams.get('title');
    const categoryParam = searchParams.get('category');

    if (categoryParam) {
      try {
        const cat = JSON.parse(categoryParam) as Category;
        setCategory(cat);
      } catch { /* ignore malformed */ }
    }

    if (gameParam) {
      try {
        const g = JSON.parse(gameParam) as Partial<Game>;
        setGame({
          id: crypto.randomUUID(),
          title: g.title ?? 'Unknown Game',
          bgg_id: g.bgg_id ?? null,
          bgg_image_url: g.bgg_image_url ?? null,
          bgg_rating: g.bgg_rating ?? null,
          description: g.description ?? '',
          complexity: (g.complexity as Game['complexity']) ?? 2,
          min_players: g.min_players ?? 1,
          max_players: g.max_players ?? 4,
          play_time_minutes: g.play_time_minutes ?? 30,
          year_published: g.year_published ?? null,
          created_at: new Date().toISOString(),
        });
      } catch {
        /* ignore malformed */
      }
    }

    if (titleParam || gameParam || categoryParam) {
      let categoryId: string | null = null;
      try { categoryId = categoryParam ? (JSON.parse(categoryParam) as Category).id : null; } catch { /* ignore */ }
      setTutorial({
        id: crypto.randomUUID(),
        game_id: null,
        category_id: categoryId,
        creator_id: '',
        title: titleParam ?? 'Untitled Tutorial',
        description: '',
        estimated_minutes: 10,
        status: 'draft',
        version: 1,
        forked_from: null,
        rating_avg: 0,
        rating_count: 0,
        play_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }, [searchParams, setGame, setCategory, setTutorial]);

  useEffect(() => {
    if (steps.length === 0) {
      const dismissed = sessionStorage.getItem('qurator-onboarding-dismissed');
      if (!dismissed) setShowOnboarding(true);
    }
  }, [steps.length]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      const { isDirty: dirty, tutorial: t } = useEditorStore.getState();
      if (!dirty || !t) return;
      setSaveStatus('saving');
      const result = await saveTutorial(user.id);
      if (result.error) {
        setSaveStatus('error');
        setSaveError(result.error);
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const toggleSidebar = useCallback(
    (id: Exclude<SidebarId, null>) => {
      setActiveSidebar((prev) => (prev === id ? null : id));
    },
    []
  );

  const openContentSidebar = useCallback(() => {
    setActiveSidebar('content');
  }, []);

  const closeSidebar = useCallback(() => {
    setActiveSidebar(null);
  }, []);

  const sidebarWidth =
    activeSidebar === 'preview' ? 'w-full sm:w-[520px]' : 'w-full sm:w-[420px]';

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Editor toolbar */}
      <header className="h-14 border-b border-border bg-background/90 backdrop-blur-md flex items-center px-2 sm:px-4 gap-1 sm:gap-3 shrink-0 z-30 overflow-x-auto">
        <Link
          href="/create"
          className="text-foreground-muted hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div className="flex items-center gap-1.5 min-w-0">
          <BookOpen className="w-4 h-4 text-accent shrink-0" />
          <input
            type="text"
            value={tutorial?.title ?? ''}
            onChange={(e) => {
              if (!tutorial) return;
              setTutorial({ ...tutorial, title: e.target.value });
              useEditorStore.setState({ isDirty: true });
            }}
            placeholder="Untitled Tutorial"
            className="text-sm font-medium text-foreground bg-transparent outline-none truncate max-w-[120px] sm:max-w-[240px] border-b border-transparent hover:border-foreground-faint focus:border-accent transition-colors placeholder:text-foreground-faint"
          />
          {game && category?.slug === 'board-games' && (
            <button
              onClick={() => setShowGameSwitch(true)}
              className="hidden sm:flex items-center gap-1 text-xs text-foreground-faint hover:text-accent transition-colors truncate cursor-pointer"
              title="Change game"
            >
              &middot; {game.title}
              <RefreshCw className="w-3 h-3 shrink-0" />
            </button>
          )}
          {category && category.slug !== 'board-games' && (
            <span className="hidden sm:inline text-xs text-foreground-faint truncate">
              &middot; {category.name}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-1" />

        <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-lg p-0.5 shrink-0">
          {sidebarButtons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => toggleSidebar(btn.id)}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${activeSidebar === btn.id
                ? 'bg-accent text-black'
                : 'text-foreground-muted hover:text-foreground hover:bg-white/[0.05]'
                }`}
            >
              <btn.icon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{btn.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowOnboarding(true)}
          className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-foreground-muted hover:text-foreground hover:bg-white/[0.05] rounded-md transition-all shrink-0 cursor-pointer"
          title="Show tutorial guide"
        >
          <Book className="w-3.5 h-3.5" />
        </button>

        <div className="flex-1 min-w-1" />

        <button
          className="flex items-center gap-2 px-3 sm:px-4 py-1.5 bg-white/[0.06] border border-border text-foreground text-sm font-medium rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
          disabled={saveStatus === 'saving'}
          onClick={async () => {
            if (!user) {
              signIn();
              return;
            }
            setSaveStatus('saving');
            setSaveError(null);
            const result = await saveTutorial(user.id);
            if (result.error) {
              setSaveStatus('error');
              setSaveError(result.error);
              setTimeout(() => setSaveStatus('idle'), 3000);
            } else {
              setSaveStatus('saved');
              setTimeout(() => setSaveStatus('idle'), 2000);
            }
          }}
        >
          {saveStatus === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
          {saveStatus === 'saved' && <Check className="w-4 h-4" />}
          {(saveStatus === 'idle' || saveStatus === 'error') && <Save className="w-4 h-4" />}
          <span className="hidden sm:inline">{saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Error' : `Save${isDirty ? ' *' : ''}`}</span>
        </button>
        <button
          className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 shrink-0 cursor-pointer ${tutorial?.status === 'published'
            ? 'bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25'
            : 'bg-green-500/15 text-green-400 hover:bg-green-500/25'
            }`}
          disabled={saveStatus === 'saving'}
          onClick={async () => {
            if (!user) {
              signIn();
              return;
            }
            if (!tutorial) return;
            const newStatus = tutorial.status === 'published' ? 'draft' : 'published';
            if (newStatus === 'published') {
              const issues = validateTutorialGraph(steps, connections);
              if (issues.length > 0) {
                setPublishIssues(issues);
                setShowPublishIssues(true);
                return;
              }
            }
            const confirmed = tutorial.status === 'published'
              ? confirm('Unpublish this tutorial? It will no longer be visible to others.')
              : confirm('Publish this tutorial? It will be visible to all users.');
            if (!confirmed) return;
            setTutorial({ ...tutorial, status: newStatus });
            setSaveStatus('saving');
            setSaveError(null);
            const result = await saveTutorial(user.id);
            if (result.error) {
              setTutorial({ ...tutorial, status: tutorial.status });
              setSaveStatus('error');
              setSaveError(result.error);
              setTimeout(() => setSaveStatus('idle'), 3000);
            } else {
              setSaveStatus('saved');
              setTimeout(() => setSaveStatus('idle'), 2000);
            }
          }}
        >
          <Globe className="w-4 h-4" />
          <span className="hidden sm:inline">{tutorial?.status === 'published' ? 'Unpublish' : 'Publish'}</span>
        </button>
        {saveStatus === 'error' && saveError && (
          <span className="text-[10px] text-red-400 max-w-[200px] truncate" title={saveError}>
            {saveError}
          </span>
        )}
      </header>

      {/* Main area: flow canvas + sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Flow canvas - always visible */}
        <div className="flex-1 overflow-hidden">
          <FlowEditor onNodeDoubleClick={openContentSidebar} />
        </div>

        {/* Sidebar panel */}
        {activeSidebar && (
          <div
            className={`${sidebarWidth} shrink-0 border-l border-border bg-background flex flex-col h-full overflow-hidden transition-all absolute sm:relative right-0 top-0 z-20`}
          >
            {/* Sidebar header */}
            <div className="h-11 px-4 flex items-center justify-between border-b border-border shrink-0">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                {activeSidebar}
              </span>
              <button
                onClick={closeSidebar}
                className="text-foreground-faint hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sidebar body */}
            <div className="flex-1 overflow-y-auto">
              {activeSidebar === 'content' && <ContentPanel />}
              {activeSidebar === 'variables' && <VariablesPanel />}
              {activeSidebar === 'objects' && <ObjectsPanel />}
              {activeSidebar === 'preview' && <TutorialPreview />}
            </div>
          </div>
        )}
      </div>

      {showOnboarding && (
        <OnboardingOverlay
          onClose={() => {
            setShowOnboarding(false);
            sessionStorage.setItem('qurator-onboarding-dismissed', '1');
          }}
        />
      )}

      {showPublishIssues && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Disconnected Steps</h2>
              <button
                onClick={() => setShowPublishIssues(false)}
                className="text-foreground-faint hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-foreground-muted">
                Some steps are not connected. Users may not be able to reach them.
              </p>
              <div className="max-h-[200px] overflow-y-auto space-y-2">
                {publishIssues.map((issue) => (
                  <div key={`${issue.stepId}-${issue.issue}`} className="flex items-start gap-2 p-2 bg-orange-500/5 border border-orange-500/20 rounded-lg">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-foreground">{issue.stepTitle}</p>
                      <p className="text-[10px] text-foreground-muted">
                        {issue.issue === 'no_incoming' && 'No incoming connection - unreachable'}
                        {issue.issue === 'no_outgoing' && 'No outgoing connection - dead end'}
                        {issue.issue === 'logic_no_incoming' && 'Logic block has no incoming connection'}
                        {issue.issue === 'logic_no_outgoing' && 'Logic block has no outgoing connection'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowPublishIssues(false)}
                  className="flex-1 px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-black hover:bg-accent-light transition-colors"
                >
                  Fix Issues
                </button>
                <button
                  onClick={async () => {
                    setShowPublishIssues(false);
                    if (!tutorial || !user) return;
                    setTutorial({ ...tutorial, status: 'published' });
                    setSaveStatus('saving');
                    setSaveError(null);
                    const result = await saveTutorial(user.id);
                    if (result.error) {
                      setTutorial({ ...tutorial, status: tutorial.status });
                      setSaveStatus('error');
                      setSaveError(result.error);
                      setTimeout(() => setSaveStatus('idle'), 3000);
                    } else {
                      setSaveStatus('saved');
                      setTimeout(() => setSaveStatus('idle'), 2000);
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground-muted hover:text-foreground hover:border-foreground-faint transition-colors"
                >
                  Publish Anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showGameSwitch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Switch Game</h2>
              <button
                onClick={() => { setShowGameSwitch(false); setGameQuery(''); setGameResults([]); }}
                className="text-foreground-faint hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                  <input
                    type="text"
                    value={gameQuery}
                    onChange={(e) => setGameQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGameSearch()}
                    placeholder="Search for a game..."
                    className="w-full pl-9 pr-3 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30 transition-colors"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleGameSearch}
                  disabled={gameSearching || !gameQuery.trim()}
                  className="px-4 py-2.5 bg-accent text-black text-sm font-semibold rounded-xl hover:bg-accent-light disabled:opacity-40 transition-all"
                >
                  {gameSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                </button>
              </div>
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {gameResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleGameSwitch(r)}
                    className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-accent/20 hover:bg-card-hover transition-all text-left"
                  >
                    {r.image ? (
                      <img
                        src={`/api/img?url=${encodeURIComponent(r.image)}`}
                        alt={r.name}
                        className="w-10 h-10 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-white/[0.03] flex items-center justify-center shrink-0">
                        <Gamepad2 className="w-4 h-4 text-foreground-faint" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                      <p className="text-xs text-foreground-faint">
                        {r.year_published && `${r.year_published} · `}
                        {r.min_players}-{r.max_players} players · {r.playing_time}m
                      </p>
                    </div>
                  </button>
                ))}
                {gameResults.length === 0 && !gameSearching && gameQuery && (
                  <p className="text-center text-sm text-foreground-muted py-6">
                    No results. Try a different search term.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
