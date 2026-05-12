'use client';

import { BoardView } from '@/components/board-view';
import { DEMO_TUTORIALS } from '@/lib/demo-tutorials';
import { createClient } from '@/lib/supabase/client';
import {
  type BranchOption,
  type TextPart,
  type VariableState,
  findFirstContentStep,
  getNextContentStepId,
  initVariableState,
  interpolateVariables,
  parseMarkdownLite,
  resolveBranches,
} from '@/lib/tutorial-navigation';
import type { InteractiveElement, TutorialConnection, TutorialStep, TutorialVariable } from '@/lib/types';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Lightbulb,
  Loader2,
  Package,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

function SafeMarkdown({ parts }: { parts: TextPart[] }) {
  return (
    <>
      {parts.map((p, i) => {
        switch (p.type) {
          case 'bold':
            return <strong key={i} className="text-foreground font-semibold">{p.value}</strong>;
          case 'italic':
            return <em key={i}>{p.value}</em>;
          case 'br':
            return <br key={i} />;
          default:
            return <span key={i}>{p.value}</span>;
        }
      })}
    </>
  );
}

function EmbedQuiz({
  element,
  onComplete,
}: {
  element: InteractiveElement;
  onComplete: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const isCorrect = selected !== null && element.options?.[selected]?.correct;
  const isAnswered = selected !== null;

  return (
    <div className="mt-3 p-3 bg-white/[0.02] border border-border rounded-xl">
      <p className="text-foreground font-medium text-xs mb-2">
        {element.question}
      </p>
      <div className="space-y-1">
        {element.options?.map((opt, i) => (
          <button
            key={i}
            onClick={() => !isAnswered && setSelected(i)}
            disabled={isAnswered}
            className={`w-full text-left px-2.5 py-1.5 rounded-lg border transition-all text-[11px] ${isAnswered && i === selected
              ? opt.correct
                ? 'border-green bg-green/10 text-green'
                : 'border-red-500 bg-red-500/10 text-red-400'
              : isAnswered && opt.correct
                ? 'border-green/50 bg-green/5 text-green'
                : 'border-border hover:border-foreground-faint text-foreground-secondary'
              }`}
          >
            <span className="flex items-center gap-1">
              {isAnswered && opt.correct && <CheckCircle2 className="w-3 h-3" />}
              {isAnswered && i === selected && !opt.correct && <XCircle className="w-3 h-3" />}
              {opt.label}
            </span>
          </button>
        ))}
      </div>
      {isAnswered && element.explanation && (
        <p className={`mt-2 text-[10px] p-2 rounded-lg ${isCorrect ? 'bg-green/10 text-green' : 'bg-orange-500/10 text-orange-400'}`}>
          {isCorrect ? 'Correct! ' : 'Not quite. '}{element.explanation}
        </p>
      )}
      {isAnswered && (
        <button
          onClick={onComplete}
          className="mt-2 px-3 py-1 bg-accent text-black text-[10px] font-semibold rounded-lg"
        >
          Continue
        </button>
      )}
    </div>
  );
}

function EmbedBranch({
  prompt,
  branches,
  onSelect,
}: {
  prompt: string;
  branches: BranchOption[];
  onSelect: (targetStepId: string, setsVariable?: { name: string; value: string | number | boolean }) => void;
}) {
  return (
    <div className="mt-3 p-3 bg-white/[0.02] border border-green/20 rounded-xl">
      <div className="flex items-center gap-1.5 mb-2">
        <GitBranch className="w-3.5 h-3.5 text-green" />
        <p className="text-foreground font-medium text-xs">{prompt}</p>
      </div>
      <div className="space-y-1.5">
        {branches.map((branch, i) => (
          <button
            key={i}
            onClick={() => onSelect(branch.targetStepId, branch.setsVariable)}
            className="w-full text-left px-3 py-2 rounded-lg border border-border hover:border-green/50 hover:bg-green/5 transition-all text-[11px] text-foreground-secondary"
          >
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-green/10 border border-green/30 flex items-center justify-center text-[9px] font-bold text-green shrink-0">
                {i + 1}
              </span>
              {branch.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function EmbedTutorialPage() {
  const params = useParams();
  const tutorialId = params.id as string;

  const [title, setTitle] = useState('');
  const [allSteps, setAllSteps] = useState<TutorialStep[]>([]);
  const [connections, setConnections] = useState<TutorialConnection[]>([]);
  const [variables, setVariables] = useState<TutorialVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [varState, setVarState] = useState<VariableState>({});
  const [quizCompleted, setQuizCompleted] = useState<Set<string>>(new Set());

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
    const demoData = DEMO_TUTORIALS[tutorialId];
    if (demoData) {
      setTitle(demoData.tutorial.title);
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
      setConnections([]);
      setVariables([]);
      setVarState({});
      setLoading(false);
      return;
    }

    const supabase = createClient();
    async function fetchTutorial() {
      const { data: tut, error: tutErr } = await supabase
        .from('tutorials')
        .select('id, title, status')
        .eq('id', tutorialId)
        .single();

      if (tutErr || !tut || tut.status !== 'published') {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setTitle(tut.title);

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

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-foreground-faint animate-spin" />
      </div>
    );
  }

  if (notFound || contentSteps.length === 0) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-sm font-medium text-foreground mb-1">Tutorial Not Found</p>
          <p className="text-xs text-foreground-muted">
            This tutorial doesn&apos;t exist or hasn&apos;t been published yet.
          </p>
        </div>
      </div>
    );
  }

  const visitedCount = history.length + 1;
  const progress = (visitedCount / contentSteps.length) * 100;

  const handleQuizComplete = () => {
    if (currentStepId) {
      setQuizCompleted((prev) => new Set(prev).add(currentStepId));
    }
  };

  const bodyParts = step?.body
    ? parseMarkdownLite(interpolateVariables(step.body, varState))
    : [];

  const tipParts = step?.tip
    ? parseMarkdownLite(interpolateVariables(step.tip, varState))
    : [];

  const fullUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/tutorials/${tutorialId}`
    : '';

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2 shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-foreground-faint font-medium truncate">
            {title}
          </p>
        </div>
        <div className="flex-1 max-w-[120px]">
          <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
        <span className="text-[9px] text-foreground-faint font-medium tabular-nums shrink-0">
          {visitedCount}/{contentSteps.length}
        </span>
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground-faint hover:text-accent transition-colors shrink-0"
          title="Open full tutorial"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {step?.is_setup_step && (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 border border-accent/20 rounded-full text-[10px] font-medium text-accent mb-2">
            <Package className="w-3 h-3" />
            Setup
          </div>
        )}

        <h2 className="text-sm font-bold text-foreground mb-2">
          {step?.heading || 'Untitled Step'}
        </h2>

        {step?.image_url && (
          <img
            src={step.image_url}
            alt=""
            className="w-full rounded-lg mb-2 object-cover max-h-32"
          />
        )}

        {step?.media && step.media.length > 0 && (
          <div className="space-y-2 mb-2">
            {step.media.map((m) =>
              m.type === 'video' ? (
                <video key={m.id} src={m.url} controls className="w-full rounded-lg max-h-32" />
              ) : (
                <img key={m.id} src={m.url} alt={m.filename} className="w-full rounded-lg object-cover max-h-32" />
              )
            )}
          </div>
        )}

        <div className="text-foreground-secondary leading-relaxed text-xs">
          <SafeMarkdown parts={bodyParts} />
        </div>

        {step?.code_block && (
          <div className="mt-2 rounded-lg overflow-hidden border border-white/[0.08]">
            {step.code_block.filename && (
              <div className="px-2.5 py-1 bg-white/[0.04] border-b border-white/[0.08]">
                <span className="text-[9px] font-mono text-foreground-muted">{step.code_block.filename}</span>
              </div>
            )}
            <pre className="p-2.5 bg-[#0d1117] overflow-x-auto">
              <code className="text-[10px] font-mono text-[#e6edf3] leading-relaxed whitespace-pre">
                {step.code_block.code}
              </code>
            </pre>
          </div>
        )}

        {step?.board_view && (
          <div className="mt-2">
            <BoardView config={step.board_view} />
          </div>
        )}

        {step?.tip && (
          <div className="mt-2 flex items-start gap-1.5 p-2 bg-accent-glow border border-accent/20 rounded-lg text-[10px]">
            <Lightbulb className="w-3 h-3 text-accent shrink-0 mt-0.5" />
            <p className="text-foreground-secondary">
              <SafeMarkdown parts={tipParts} />
            </p>
          </div>
        )}

        {hasQuiz && !quizDone && (
          <EmbedQuiz element={step!.interactive!} onComplete={handleQuizComplete} />
        )}

        {hasBranching && canAdvance && (
          <EmbedBranch
            prompt={branches!.prompt}
            branches={branches!.branches}
            onSelect={navigateTo}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="px-3 py-2 border-t border-border flex items-center justify-between shrink-0">
        <button
          onClick={goBack}
          disabled={history.length === 0}
          className="flex items-center gap-1 text-[11px] text-foreground-muted hover:text-foreground disabled:opacity-30 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Back
        </button>

        {isTerminal ? (
          <button
            onClick={restart}
            className="flex items-center gap-1 px-3 py-1 bg-green text-black text-[10px] font-semibold rounded-lg"
          >
            <RotateCcw className="w-3 h-3" />
            Restart
          </button>
        ) : nextStepId ? (
          <button
            onClick={handleNext}
            disabled={!canAdvance}
            className="flex items-center gap-1 px-3 py-1 bg-accent text-black text-[10px] font-semibold rounded-lg hover:bg-accent-light disabled:opacity-40 transition-colors"
          >
            Next
            <ArrowRight className="w-3 h-3" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
