'use client';

import { BoardView } from '@/components/board-view';
import { useAuth } from '@/lib/auth';
import { DEMO_TUTORIALS } from '@/lib/demo-tutorials';
import { containsProfanity } from '@/lib/profanity';
import { createClient } from '@/lib/supabase/client';
import {
  type BranchOption,
  type TextPart,
  type VariableState,
  countForwardSteps,
  findFirstContentStep,
  getNextContentStepId,
  initVariableState,
  interpolateVariables,
  parseMarkdownLite,
  resolveBranches,
} from '@/lib/tutorial-navigation';
import { type InteractiveElement, type TutorialConnection, type TutorialStep, type TutorialVariable, buildEmbedUrl } from '@/lib/types';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Flag,
  GitBranch,
  Lightbulb,
  Link2,
  Loader2,
  MessageCircle,
  Package,
  RotateCcw,
  Send,
  Star,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface Comment {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: { display_name: string; avatar_emoji: string; avatar_background_color_hex: string } | null;
}

function InteractiveQuiz({
  element,
  onComplete,
}: {
  element: InteractiveElement;
  onComplete: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const isCorrect =
    selected !== null && element.options?.[selected]?.correct;
  const isAnswered = selected !== null;

  return (
    <div className="mt-6 p-5 bg-white/[0.02] border border-border rounded-xl">
      <p className="text-foreground font-medium mb-4">
        {element.question}
      </p>
      <div className="space-y-2">
        {element.options?.map((opt, i) => (
          <button
            key={i}
            onClick={() => {
              if (!isAnswered) {
                setSelected(i);
                onComplete();
              }
            }}
            disabled={isAnswered}
            className={`w-full text-left px-4 py-3 rounded-lg border transition-all text-sm ${isAnswered && i === selected
              ? opt.correct
                ? 'border-green bg-green/10 text-green'
                : 'border-red-500 bg-red-500/10 text-red-400'
              : isAnswered && opt.correct
                ? 'border-green/50 bg-green/5 text-green'
                : 'border-border hover:border-foreground-faint hover:bg-white/[0.03] text-foreground-secondary'
              } ${isAnswered ? 'cursor-default' : 'cursor-pointer'}`}
          >
            <span className="flex items-center gap-2">
              {isAnswered && opt.correct && (
                <CheckCircle2 className="w-4 h-4 text-green shrink-0" />
              )}
              {isAnswered && i === selected && !opt.correct && (
                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              {opt.label}
            </span>
          </button>
        ))}
      </div>
      {isAnswered && (
        <div
          className={`mt-4 p-3 rounded-lg text-sm ${isCorrect
            ? 'bg-green/10 text-green border border-green/20'
            : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
            }`}
        >
          {isCorrect ? 'Correct! ' : 'Not quite. '}
          {element.explanation}
        </div>
      )}
    </div>
  );
}

function SafeMarkdown({ parts }: { parts: TextPart[] }) {
  return (
    <>
      {parts.map((p, i) => {
        switch (p.type) {
          case 'bold':
            return <strong key={i} className="text-foreground font-semibold">{p.value}</strong>;
          case 'italic':
            return <em key={i}>{p.value}</em>;
          case 'color':
            return <span key={i} className="[&_strong]:text-inherit" style={{ color: p.color }}><SafeMarkdown parts={p.children} /></span>;
          case 'br':
            return <br key={i} />;
          default:
            return <span key={i}>{p.value}</span>;
        }
      })}
    </>
  );
}

function BranchUI({
  prompt,
  branches,
  onSelect,
}: {
  prompt: string;
  branches: BranchOption[];
  onSelect: (targetStepId: string, setsVariable?: { name: string; value: string | number | boolean }) => void;
}) {
  return (
    <div className="mt-6 p-5 bg-white/[0.02] border border-green/20 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="w-4 h-4 text-green" />
        <p className="text-foreground font-medium text-sm">{prompt}</p>
      </div>
      <div className="space-y-2">
        {branches.map((branch, i) => (
          <button
            key={i}
            onClick={() => onSelect(branch.targetStepId, branch.setsVariable)}
            className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-green/50 hover:bg-green/5 transition-all text-sm text-foreground-secondary"
          >
            <span className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-green/10 border border-green/30 flex items-center justify-center text-[10px] font-bold text-green shrink-0">
                {i + 1}
              </span>
              <span><SafeMarkdown parts={parseMarkdownLite(branch.label)} /></span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

type ReportType = 'rule_error' | 'typo' | 'suggestion';

function ReportDialog({
  tutorialId,
  creatorId,
  stepNumber,
  stepHeading,
  onClose,
}: {
  tutorialId: string;
  creatorId: string;
  stepNumber: number;
  stepHeading: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [reportType, setReportType] = useState<ReportType>('rule_error');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim() || !user) return;
    setSubmitting(true);
    const supabase = createClient();
    const description = `[Tutorial Report - Step ${stepNumber}: ${stepHeading}]\nType: ${reportType}\n\n${message}`;

    await supabase.from('content_reports').insert({
      reporter_id: user.id,
      reported_user_id: creatorId,
      reported_deck_id: tutorialId,
      reason: reportType === 'rule_error' ? 'misinformation' : 'other',
      description,
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      await fetch(`${supabaseUrl}/functions/v1/notify-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
        body: JSON.stringify({
          to: 'helpmequobby@gmail.com',
          subject: `Tutorial Report: ${reportType}`,
          body: description,
          reported_user_id: creatorId,
          reported_deck_id: tutorialId,
          reason: reportType,
          description: message,
          reporter_id: user.id,
        }),
      });
    } catch {
      /* Edge function may not be deployed yet — report is still in DB */
    }

    setSubmitting(false);
    setSubmitted(true);
  };

  const types: { value: ReportType; label: string; icon: React.ReactNode }[] = [
    { value: 'rule_error', label: 'Rule Error', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    { value: 'typo', label: 'Typo', icon: <Flag className="w-3.5 h-3.5" /> },
    { value: 'suggestion', label: 'Suggestion', icon: <Lightbulb className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background-secondary border border-border rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Report an Issue</h3>
          <button onClick={onClose} className="text-foreground-faint hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-green mx-auto mb-3" />
            <p className="text-foreground font-medium mb-1">Report Submitted</p>
            <p className="text-sm text-foreground-muted mb-4">
              The tutorial creator will be notified. Thank you for helping improve this tutorial!
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-accent text-black text-sm font-semibold rounded-lg hover:bg-accent-light transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs text-foreground-faint mb-1">
                Step {stepNumber}: {stepHeading}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground-muted mb-2">
                Issue Type
              </label>
              <div className="flex gap-2">
                {types.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setReportType(t.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${reportType === t.value
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'border-border text-foreground-muted hover:text-foreground hover:border-foreground-faint'
                      }`}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground-muted mb-1.5">
                Description
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30 transition-colors resize-none"
                placeholder={
                  reportType === 'rule_error'
                    ? 'Describe what rule is incorrect and what the correct rule is...'
                    : reportType === 'typo'
                      ? 'Describe the typo or grammatical error...'
                      : 'What would you suggest improving?'
                }
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || !user || submitting}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent text-black text-sm font-semibold rounded-lg hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StarRating({
  rating,
  onRate,
  readonly = false,
}: {
  rating: number;
  onRate?: (stars: number) => void;
  readonly?: boolean;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex gap-2 justify-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          disabled={readonly}
          onClick={() => onRate?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className={`transition-transform ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-125'}`}
        >
          <Star
            className={`w-9 h-9 transition-colors ${star <= (hovered || rating)
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-white/20'
              }`}
          />
        </button>
      ))}
    </div>
  );
}

function CommentsSection({ tutorialId, creatorId }: { tutorialId: string; creatorId: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('tutorial_comments')
      .select('*, profiles!user_id(display_name, avatar_emoji, avatar_background_color_hex)')
      .eq('tutorial_id', tutorialId)
      .order('created_at', { ascending: false });
    setComments((data as Comment[]) ?? []);
    setLoading(false);
  }, [tutorialId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async () => {
    if (!user || !body.trim()) return;
    if (containsProfanity(body)) {
      setError('Your comment contains inappropriate language. Please revise it.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error: insertErr } = await supabase
      .from('tutorial_comments')
      .insert({ tutorial_id: tutorialId, user_id: user.id, body: body.trim() });
    if (insertErr) {
      setError(insertErr.message);
    } else {
      setBody('');
      await fetchComments();
    }
    setSubmitting(false);
  };

  const handleDelete = async (commentId: string) => {
    const supabase = createClient();
    await supabase.from('tutorial_comments').delete().eq('id', commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
        <MessageCircle className="w-4 h-4" />
        Comments ({comments.length})
      </h3>

      {user && (
        <div className="mb-6">
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (error) setError(null);
            }}
            rows={3}
            maxLength={2000}
            placeholder="Leave a comment..."
            className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30 transition-colors resize-none"
          />
          {error && (
            <p className="text-xs text-red-400 mt-1.5">{error}</p>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-foreground-faint">
              {body.length}/2000
            </span>
            <button
              onClick={handleSubmit}
              disabled={!body.trim() || submitting}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent text-black text-xs font-semibold rounded-lg hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Post
            </button>
          </div>
        </div>
      )}

      {!user && (
        <p className="text-xs text-foreground-faint mb-6">
          Sign in to leave a comment.
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 text-foreground-faint animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-foreground-faint text-center py-6">
          No comments yet. Be the first!
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => {
            const canDelete = user && (user.id === c.user_id || user.id === creatorId);
            return (
              <div key={c.id} className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs border border-white/10"
                    style={{ background: `#${c.profiles?.avatar_background_color_hex ?? '4CAF50'}` }}
                  >
                    {c.profiles?.avatar_emoji ?? '🎓'}
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    {c.profiles?.display_name ?? 'Anonymous'}
                  </span>
                  <span className="text-[10px] text-foreground-faint">
                    {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="ml-auto text-foreground-faint hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-foreground-secondary leading-relaxed">
                  {c.body}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface TutorialData {
  id: string;
  title: string;
  description: string;
  estimated_minutes: number;
  rating_avg: number;
  rating_count: number;
  play_count: number;
  creator_id: string;
  game?: { title: string; bgg_id: number | null; min_players: number; max_players: number; complexity: number } | null;
}

export default function TutorialPlayerPage() {
  const params = useParams();
  const { user } = useAuth();
  const tutorialId = params.id as string;

  const [tutorialData, setTutorialData] = useState<TutorialData | null>(null);
  const [allSteps, setAllSteps] = useState<TutorialStep[]>([]);
  const [connections, setConnections] = useState<TutorialConnection[]>([]);
  const [variables, setVariables] = useState<TutorialVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [varState, setVarState] = useState<VariableState>({});
  const [quizCompleted, setQuizCompleted] = useState<Set<string>>(new Set());
  const [showReport, setShowReport] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [creatorProfile, setCreatorProfile] = useState<{ display_name: string; avatar_emoji: string; avatar_background_color_hex: string } | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [bggRating, setBggRating] = useState<number | null>(null);
  const [bggComplexity, setBggComplexity] = useState<number | null>(null);

  const contentSteps = useMemo(
    () => allSteps.filter((s) => s.step_type === 'content'),
    [allSteps]
  );

  const startStep = useMemo(
    () => findFirstContentStep(allSteps, connections),
    [allSteps, connections]
  );

  const currentStepId = history.length > 0 ? history[history.length - 1] : startStep?.id;
  const currentFullStep = allSteps.find((s) => s.id === currentStepId && s.step_type === 'content');
  const step = currentFullStep?.content_json ?? null;

  const branches = useMemo(() => {
    if (!currentFullStep) return null;
    return resolveBranches(currentFullStep, allSteps, connections, varState);
  }, [currentFullStep, allSteps, connections, varState]);

  const autoTarget = branches?.autoTarget ?? null;

  const nextStepId = useMemo(() => {
    if (autoTarget) return autoTarget;
    if (!currentFullStep) return null;
    return getNextContentStepId(currentFullStep, allSteps, connections);
  }, [currentFullStep, allSteps, connections, autoTarget]);

  const hasBranching = branches !== null && branches.branches.length > 0;
  const hasQuiz = !!step?.interactive;
  const quizDone = currentStepId ? quizCompleted.has(currentStepId) : false;
  const canAdvance = !hasQuiz || quizDone;
  const isTerminal = !hasBranching && !nextStepId;
  const isLastStep = isTerminal && canAdvance;

  const forwardSteps = useMemo(
    () => currentFullStep ? countForwardSteps(currentFullStep, allSteps, connections, varState) : 0,
    [currentFullStep, allSteps, connections, varState]
  );

  const uniqueVisited = useMemo(() => {
    const ids = new Set(history);
    if (startStep?.id) ids.add(startStep.id);
    return ids;
  }, [history, startStep]);

  const navigateTo = useCallback((targetId: string, setsVariable?: { name: string; value: string | number | boolean }) => {
    if (setsVariable) {
      setVarState((prev) => ({ ...prev, [setsVariable.name]: setsVariable.value }));
    }
    setHistory((prev) => [...prev, targetId]);
  }, []);

  const goBack = useCallback(() => {
    setHistory((prev) => prev.slice(0, -1));
  }, []);

  const restart = useCallback(() => {
    setHistory([]);
    setQuizCompleted(new Set());
    setVarState(initVariableState(variables));
  }, [variables]);

  const handleNext = useCallback(() => {
    if (nextStepId) navigateTo(nextStepId);
  }, [nextStepId, navigateTo]);

  useEffect(() => {
    const playCountKey = `qurator-played-${tutorialId}`;
    const alreadyCounted = sessionStorage.getItem(playCountKey);

    const demoData = DEMO_TUTORIALS[tutorialId];
    if (demoData) {
      if (!alreadyCounted) {
        sessionStorage.setItem(playCountKey, '1');
        const supabaseForDemo = createClient();
        supabaseForDemo.rpc('increment_play_count', { tid: tutorialId }).then(() => { });
      }

      setTutorialData({
        id: demoData.tutorial.id,
        title: demoData.tutorial.title,
        description: demoData.tutorial.description,
        estimated_minutes: demoData.tutorial.estimated_minutes,
        rating_avg: demoData.tutorial.rating_avg,
        rating_count: demoData.tutorial.rating_count,
        play_count: demoData.tutorial.play_count,
        creator_id: demoData.tutorial.creator_id,
        game: demoData.tutorial.game,
      });

      const demoSteps: TutorialStep[] = demoData.steps.map((s, i) => ({
        id: `demo-step-${i}`,
        tutorial_id: tutorialId,
        step_type: 'content' as const,
        sort_order: i,
        content_json: s,
        logic_json: null,
        position_x: 0,
        position_y: 0,
      }));
      setAllSteps(demoSteps);
      const demoConnections: TutorialConnection[] = demoSteps.slice(0, -1).map((step, i) => ({
        id: `demo-conn-${i}`,
        from_step_id: step.id,
        to_step_id: demoSteps[i + 1].id,
        condition_json: null,
      }));
      setConnections(demoConnections);
      setVariables([]);
      setVarState({});
      setLoading(false);

      const supabaseForProfile = createClient();
      supabaseForProfile
        .from('profiles')
        .select('display_name, avatar_emoji, avatar_background_color_hex')
        .eq('id', demoData.tutorial.creator_id)
        .single()
        .then(({ data }) => {
          if (data) setCreatorProfile(data);
        });
      supabaseForProfile
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', demoData.tutorial.creator_id)
        .then(({ count }) => {
          setFollowerCount(count ?? 0);
        });

      return;
    }

    const supabase = createClient();
    async function fetchTutorial() {
      const { data: tut, error: tutErr } = await supabase
        .from('tutorials')
        .select('*, games(title, bgg_id, min_players, max_players, complexity)')
        .eq('id', tutorialId)
        .single();

      if (tutErr || !tut) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (!alreadyCounted) {
        sessionStorage.setItem(playCountKey, '1');
        supabase.rpc('increment_play_count', { tid: tutorialId }).then(() => { });
      }

      setTutorialData({
        id: tut.id,
        title: tut.title,
        description: tut.description,
        estimated_minutes: tut.estimated_minutes,
        rating_avg: tut.rating_avg,
        rating_count: tut.rating_count,
        play_count: (tut.play_count ?? 0) + (alreadyCounted ? 0 : 1),
        creator_id: tut.creator_id,
        game: tut.games as TutorialData['game'],
      });

      const { data: creatorData } = await supabase
        .from('profiles')
        .select('display_name, avatar_emoji, avatar_background_color_hex')
        .eq('id', tut.creator_id)
        .single();
      if (creatorData) setCreatorProfile(creatorData);

      const { count: fCount } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', tut.creator_id);
      setFollowerCount(fCount ?? 0);

      const { data: stepData } = await supabase
        .from('tutorial_steps')
        .select('*')
        .eq('tutorial_id', tutorialId)
        .order('sort_order');

      const fetchedSteps = (stepData as TutorialStep[]) ?? [];
      setAllSteps(fetchedSteps);

      const stepIds = fetchedSteps.map((s) => s.id);
      let fetchedConnections: TutorialConnection[] = [];
      if (stepIds.length > 0) {
        const { data: connData } = await supabase
          .from('tutorial_connections')
          .select('*')
          .in('from_step_id', stepIds);
        fetchedConnections = (connData ?? []) as TutorialConnection[];
      }
      setConnections(fetchedConnections);

      const { data: varData } = await supabase
        .from('tutorial_variables')
        .select('*')
        .eq('tutorial_id', tutorialId);
      const fetchedVars = (varData ?? []) as TutorialVariable[];
      setVariables(fetchedVars);
      setVarState(initVariableState(fetchedVars));

      setLoading(false);
    }

    fetchTutorial();
  }, [tutorialId]);

  useEffect(() => {
    const game = tutorialData?.game;
    if (!game) return;
    const existing = (game as Record<string, unknown>)['bgg_rating'];
    if (typeof existing === 'number' && existing > 0) {
      setBggRating(existing);
      return;
    }
    const applyResult = (r: { bgg_rating: number; average_weight: number }) => {
      if (r.bgg_rating > 0) setBggRating(r.bgg_rating);
      if (r.average_weight > 0) setBggComplexity(Math.round(r.average_weight));
    };
    if (game.bgg_id) {
      fetch(`/api/bgg/details?ids=${game.bgg_id}`)
        .then((r) => r.json())
        .then((results: { id: number; bgg_rating: number; average_weight: number }[]) => {
          if (Array.isArray(results) && results[0]) applyResult(results[0]);
        })
        .catch(() => { });
    } else if (game.title) {
      fetch(`/api/bgg/search?q=${encodeURIComponent(game.title)}`)
        .then((r) => r.json())
        .then((results: { id: number; bgg_rating: number; average_weight: number }[]) => {
          if (Array.isArray(results) && results[0]) applyResult(results[0]);
        })
        .catch(() => { });
    }
  }, [tutorialData]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from('tutorial_ratings')
      .select('stars')
      .eq('tutorial_id', tutorialId)
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setUserRating(data.stars);
          setRatingSubmitted(true);
        }
      });
  }, [user, tutorialId]);

  useEffect(() => {
    if (!user || !tutorialData) return;
    const supabase = createClient();
    supabase
      .from('friendships')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('following_id', tutorialData.creator_id)
      .single()
      .then(({ data }) => {
        setIsFollowing(!!data);
      });
  }, [user, tutorialData]);

  const toggleFollow = useCallback(async () => {
    if (!user || !tutorialData || user.id === tutorialData.creator_id) return;
    setFollowLoading(true);
    const supabase = createClient();
    if (isFollowing) {
      await supabase
        .from('friendships')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', tutorialData.creator_id);
      setIsFollowing(false);
      setFollowerCount((c) => Math.max(0, c - 1));
    } else {
      await supabase
        .from('friendships')
        .insert({ follower_id: user.id, following_id: tutorialData.creator_id });
      const displayName = user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'Someone';
      await supabase.from('notifications').insert({
        user_id: tutorialData.creator_id,
        type: 'new_follower',
        from_user_id: user.id,
        message: `${displayName} started following you`,
      });
      setIsFollowing(true);
      setFollowerCount((c) => c + 1);
    }
    setFollowLoading(false);
  }, [user, tutorialData, isFollowing]);

  const handleQuizComplete = useCallback(() => {
    if (currentStepId) {
      setQuizCompleted((prev) => new Set(prev).add(currentStepId));
    }
  }, [currentStepId]);

  const handleRate = async (stars: number) => {
    if (!user) return;
    setUserRating(stars);
    setRatingSubmitted(true);
    const supabase = createClient();
    await supabase
      .from('tutorial_ratings')
      .upsert(
        { user_id: user.id, tutorial_id: tutorialId, stars },
        { onConflict: 'user_id,tutorial_id' }
      );

    await supabase.rpc('recalculate_tutorial_rating', { tid: tutorialId });
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-foreground-faint animate-spin" />
      </div>
    );
  }

  if (notFound || !tutorialData || contentSteps.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-foreground mb-2">Tutorial Not Found</h2>
          <p className="text-foreground-muted mb-6">
            This tutorial doesn&apos;t exist or hasn&apos;t been published yet.
          </p>
          <Link
            href="/tutorials"
            className="px-6 py-2.5 bg-accent text-black text-sm font-semibold rounded-lg hover:bg-accent-light transition-colors"
          >
            Browse Tutorials
          </Link>
        </div>
      </div>
    );
  }

  const game = tutorialData.game;
  const visitedCount = history.length + 1;
  const dynamicTotal = visitedCount + forwardSteps;
  const progress = (visitedCount / dynamicTotal) * 100;
  const unvisitedCount = contentSteps.length - uniqueVisited.size;

  const bodyParts = step?.body
    ? parseMarkdownLite(interpolateVariables(step.body, varState))
    : [];

  const tipParts = step?.tip
    ? parseMarkdownLite(interpolateVariables(step.tip, varState))
    : [];

  const stepIndex = currentFullStep
    ? contentSteps.findIndex((s) => s.id === currentFullStep.id)
    : 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col" onClick={() => showShareMenu && setShowShareMenu(false)}>
      {/* Progress bar */}
      <div className="sticky top-16 z-40 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link
            href="/tutorials"
            className="text-foreground-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
          <span className="text-xs text-foreground-faint font-medium tabular-nums">
            {visitedCount}/{dynamicTotal}
          </span>
          {isLastStep && unvisitedCount > 0 && (
            <span className="text-[10px] text-foreground-faint/60 whitespace-nowrap">+{unvisitedCount} more</span>
          )}
          <div className="relative">
            <button
              onClick={() => setShowShareMenu((v) => !v)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-foreground-faint hover:text-accent transition-colors rounded-lg hover:bg-white/[0.03]"
              title="Share tutorial"
            >
              {linkCopied ? <Check className="w-3.5 h-3.5 text-green" /> : <Link2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{linkCopied ? 'Copied!' : 'Share'}</span>
            </button>
            {showShareMenu && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-background-secondary border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    setLinkCopied(true);
                    setShowShareMenu(false);
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                  className="w-full text-left px-3 py-2.5 text-xs text-foreground-secondary hover:bg-white/[0.04] transition-colors flex items-center gap-2"
                >
                  <Link2 className="w-3.5 h-3.5 text-foreground-faint" />
                  Copy link
                </button>
                <button
                  onClick={() => {
                    const embedCode = `<script src="${window.location.origin}/embed.js" data-tutorial="${tutorialId}" data-height="500"></script>`;
                    navigator.clipboard.writeText(embedCode);
                    setLinkCopied(true);
                    setShowShareMenu(false);
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                  className="w-full text-left px-3 py-2.5 text-xs text-foreground-secondary hover:bg-white/[0.04] transition-colors flex items-center gap-2 border-t border-border"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-foreground-faint" />
                  <span>Copy embed code<br /><span className="text-[10px] text-foreground-faint">For websites &amp; blogs</span></span>
                </button>
                <button
                  onClick={() => {
                    const markdown = `[![Open Tutorial](${window.location.origin}/api/og?id=${tutorialId})](${window.location.origin}/tutorials/${tutorialId})`;
                    navigator.clipboard.writeText(markdown);
                    setLinkCopied(true);
                    setShowShareMenu(false);
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                  className="w-full text-left px-3 py-2.5 text-xs text-foreground-secondary hover:bg-white/[0.04] transition-colors flex items-center gap-2 border-t border-border"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-foreground-faint" />
                  <span>Copy Markdown badge<br /><span className="text-[10px] text-foreground-faint">For GitHub &amp; READMEs</span></span>
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowReport(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-foreground-faint hover:text-orange-400 transition-colors rounded-lg hover:bg-white/[0.03]"
            title="Report an error in this step"
          >
            <Flag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Report</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="max-w-2xl w-full">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-1 text-xs text-foreground-faint">
              {tutorialData.rating_count > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-yellow-400" /> {tutorialData.rating_avg.toFixed(1)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> {tutorialData.play_count} views
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {tutorialData.estimated_minutes} min
              </span>
              {game && (
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> {game.min_players}-{game.max_players} players
                </span>
              )}
              {(() => {
                const cLevel = game?.complexity || bggComplexity || 0;
                const cLabels = ['', 'Easy', 'Light', 'Medium', 'Heavy', 'Expert'];
                return cLevel > 0 && cLevel <= 5 ? (
                  <span className="flex items-center gap-1">
                    <Lightbulb className="w-3.5 h-3.5" /> {cLabels[cLevel]}
                  </span>
                ) : null;
              })()}
              {bggRating != null && bggRating > 0 && (
                <span className="flex items-center gap-1 text-orange-300">
                  <Star className="w-3.5 h-3.5 text-orange-400" /> {bggRating.toFixed(1)}/10 BGG
                </span>
              )}
            </div>
            {game && (
              <p className="text-xs text-accent font-medium uppercase tracking-wider">
                {game.title}
              </p>
            )}
            {creatorProfile && (
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.06]">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs border border-white/10"
                  style={{ background: `#${creatorProfile.avatar_background_color_hex}` }}
                >
                  {creatorProfile.avatar_emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {creatorProfile.display_name}
                  </p>
                  <p className="text-[10px] text-foreground-faint">
                    {followerCount} follower{followerCount !== 1 ? 's' : ''}
                  </p>
                </div>
                {user && user.id !== tutorialData.creator_id && (
                  <button
                    onClick={toggleFollow}
                    disabled={followLoading}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${isFollowing
                      ? 'bg-white/[0.06] text-foreground-muted hover:bg-red-500/10 hover:text-red-400'
                      : 'bg-accent/15 text-accent hover:bg-accent/25'
                      } disabled:opacity-50`}
                  >
                    {isFollowing ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            )}
          </div>

          {step?.is_setup_step && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent/10 border border-accent/20 rounded-full text-xs font-medium text-accent mb-4">
              <Package className="w-3.5 h-3.5" />
              Setup Step
            </div>
          )}

          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
            {step?.heading}
          </h2>

          {step?.image_url && (
            <img
              src={step.image_url}
              alt=""
              className="w-full rounded-xl mb-6 object-cover max-h-64"
            />
          )}

          {step?.media && step.media.length > 0 && (
            <div className="space-y-4 mb-6">
              {step.media.map((m) =>
                m.video_url ? (
                  <iframe
                    key={m.id}
                    src={buildEmbedUrl(m.url, m.video_start, m.video_end)}
                    className="w-full rounded-xl aspect-video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : m.type === 'video' ? (
                  <video
                    key={m.id}
                    src={m.url}
                    controls
                    className="w-full rounded-xl"
                  />
                ) : m.crop ? (
                  <div key={m.id} className="w-full rounded-xl overflow-hidden max-h-96">
                    <img
                      src={m.url}
                      alt={m.filename}
                      className="w-full object-cover"
                      style={{
                        clipPath: `inset(${m.crop.y}% ${100 - m.crop.x - m.crop.width}% ${100 - m.crop.y - m.crop.height}% ${m.crop.x}%)`,
                      }}
                    />
                  </div>
                ) : (
                  <img
                    key={m.id}
                    src={m.url}
                    alt={m.filename}
                    className="w-full rounded-xl object-cover max-h-96"
                  />
                )
              )}
            </div>
          )}

          <div className="text-foreground-secondary leading-relaxed text-base">
            <SafeMarkdown parts={bodyParts} />
          </div>

          {step?.code_block && (
            <div className="mt-6 rounded-xl overflow-hidden border border-white/[0.08]">
              {step.code_block.filename && (
                <div className="px-4 py-2 bg-white/[0.04] border-b border-white/[0.08] flex items-center gap-2">
                  <span className="text-[11px] font-mono text-foreground-muted">{step.code_block.filename}</span>
                  <span className="text-[10px] text-foreground-faint bg-white/[0.06] px-1.5 py-0.5 rounded">{step.code_block.language}</span>
                </div>
              )}
              <pre className="p-4 bg-[#0d1117] overflow-x-auto">
                <code className="text-sm font-mono text-[#e6edf3] leading-relaxed whitespace-pre">
                  {step.code_block.code}
                </code>
              </pre>
            </div>
          )}

          {step?.board_view && (
            <div className="mt-6">
              <BoardView config={step.board_view} />
            </div>
          )}

          {step?.tip && (
            <div className="mt-6 flex items-start gap-3 p-4 bg-accent-glow border border-accent/20 rounded-xl text-sm">
              <Lightbulb className="w-5 h-5 text-accent shrink-0 mt-0.5" />
              <p className="text-foreground-secondary">
                <SafeMarkdown parts={tipParts} />
              </p>
            </div>
          )}

          {hasQuiz && (
            <InteractiveQuiz
              element={step!.interactive!}
              onComplete={handleQuizComplete}
            />
          )}

          {hasBranching && canAdvance && (
            <BranchUI
              prompt={branches!.prompt}
              branches={branches!.branches}
              onSelect={navigateTo}
            />
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-12 pt-6 border-t border-border">
            <button
              onClick={goBack}
              disabled={history.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-foreground-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            {isTerminal ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={restart}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-foreground-muted hover:text-foreground transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restart
                </button>
                <Link
                  href="/tutorials"
                  className="flex items-center gap-2 px-6 py-2.5 bg-green text-black text-sm font-semibold rounded-lg hover:bg-green/90 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Done
                </Link>
              </div>
            ) : nextStepId ? (
              <button
                onClick={handleNext}
                disabled={!canAdvance}
                className="flex items-center gap-2 px-6 py-2.5 bg-accent text-black text-sm font-semibold rounded-lg hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          {/* Rating section — shown at end */}
          {isLastStep && (
            <div className="mt-10 p-6 bg-white/[0.02] border border-white/[0.06] rounded-2xl text-center">
              <h3 className="text-sm font-semibold text-foreground mb-2">
                {ratingSubmitted ? 'Thanks for rating!' : 'How was this tutorial?'}
              </h3>
              <StarRating
                rating={userRating}
                onRate={handleRate}
                readonly={!user || ratingSubmitted}
              />
              {!user && (
                <p className="text-xs text-foreground-faint mt-2">
                  Sign in to rate this tutorial.
                </p>
              )}
            </div>
          )}

          {/* Comments — shown at end */}
          {isLastStep && (
            <div className="mt-8 pt-8 border-t border-border">
              <CommentsSection tutorialId={tutorialId} creatorId={tutorialData.creator_id} />
            </div>
          )}
        </div>
      </div>

      {showReport && (
        <ReportDialog
          tutorialId={tutorialId}
          creatorId={tutorialData.creator_id}
          stepNumber={stepIndex + 1}
          stepHeading={step?.heading ?? ''}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
