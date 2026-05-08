'use client';

import { BoardView } from '@/components/board-view';
import { useEditorStore } from '@/lib/store';
import type {
  InteractiveElement,
  LogicCondition,
  TutorialConnection,
  TutorialStep,
  TutorialVariable,
} from '@/lib/types';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  GitBranch,
  Lightbulb,
  Package,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

type VariableState = Record<string, string | number | boolean>;

interface BranchOption {
  label: string;
  targetStepId: string;
  setsVariable?: { name: string; value: string | number | boolean };
}

interface BranchResult {
  prompt: string;
  branches: BranchOption[];
  autoTarget?: string;
}

function initVariableState(variables: TutorialVariable[]): VariableState {
  const state: VariableState = {};
  for (const v of variables) {
    if (v.variable_type === 'number') {
      state[v.name] = v.default_value ? Number(v.default_value) : 0;
    } else if (v.variable_type === 'boolean') {
      state[v.name] = v.default_value === 'true';
    } else {
      state[v.name] = v.default_value ?? '';
    }
  }
  return state;
}

function evaluateCondition(
  cond: LogicCondition,
  state: VariableState
): boolean {
  const actual = state[cond.variable];
  if (actual === undefined) return false;
  const expected = typeof actual === 'number' ? Number(cond.value) : cond.value;
  switch (cond.operator) {
    case 'eq': return actual == expected;
    case 'neq': return actual != expected;
    case 'gt': return actual > expected;
    case 'lt': return actual < expected;
    case 'gte': return actual >= expected;
    case 'lte': return actual <= expected;
    default: return false;
  }
}

function interpolateVariables(text: string, state: VariableState): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const val = state[name];
    return val !== undefined ? String(val) : `{{${name}}}`;
  });
}

function getOutgoingConnections(
  stepId: string,
  connections: TutorialConnection[]
): TutorialConnection[] {
  return connections.filter((c) => c.from_step_id === stepId);
}

function findFirstContentStep(
  steps: TutorialStep[],
  connections: TutorialConnection[]
): TutorialStep | undefined {
  const targetIds = new Set(connections.map((c) => c.to_step_id));
  const roots = steps.filter(
    (s) => s.step_type === 'content' && !targetIds.has(s.id)
  );
  if (roots.length > 0) return roots[0];
  const contentSteps = steps.filter((s) => s.step_type === 'content');
  return contentSteps.sort((a, b) => a.sort_order - b.sort_order)[0];
}

function resolveBranches(
  currentStep: TutorialStep,
  steps: TutorialStep[],
  connections: TutorialConnection[],
  variableState: VariableState
): BranchResult | null {
  const outgoing = getOutgoingConnections(currentStep.id, connections);
  if (outgoing.length === 0) return null;

  for (const conn of outgoing) {
    const target = steps.find((s) => s.id === conn.to_step_id);
    if (!target || target.step_type !== 'logic') continue;

    const logic = target.logic_json;
    if (!logic || logic.conditions.length === 0) continue;

    const allHaveConditions = logic.conditions.every(
      (e) => e.condition.variable !== ''
    );

    if (allHaveConditions) {
      for (const entry of logic.conditions) {
        if (evaluateCondition(entry.condition, variableState)) {
          return {
            prompt: logic.prompt || 'Choose a path',
            branches: [],
            autoTarget: entry.target_step_id,
          };
        }
      }
      if (logic.default_target_step_id) {
        return {
          prompt: logic.prompt || 'Choose a path',
          branches: [],
          autoTarget: logic.default_target_step_id,
        };
      }
    }

    const branches: BranchOption[] = [];

    for (const entry of logic.conditions) {
      branches.push({
        label: entry.label || `Option ${branches.length + 1}`,
        targetStepId: entry.target_step_id,
        setsVariable: entry.sets_variable,
      });
    }

    if (logic.default_target_step_id && logic.default_label) {
      branches.push({
        label: logic.default_label,
        targetStepId: logic.default_target_step_id,
      });
    }

    if (branches.length > 0) {
      return { prompt: logic.prompt || 'Choose a path', branches };
    }
  }

  return null;
}

function getNextContentStepId(
  currentStep: TutorialStep,
  steps: TutorialStep[],
  connections: TutorialConnection[]
): string | null {
  const outgoing = getOutgoingConnections(currentStep.id, connections);
  for (const conn of outgoing) {
    const target = steps.find((s) => s.id === conn.to_step_id);
    if (target?.step_type === 'content') return target.id;
    if (target?.step_type === 'logic') {
      const logic = target.logic_json;
      if (logic?.default_target_step_id && !logic.default_label) {
        return logic.default_target_step_id;
      }
      if (!logic?.default_target_step_id) {
        const logicOutgoing = getOutgoingConnections(target.id, connections);
        for (const lConn of logicOutgoing) {
          const lTarget = steps.find((s) => s.id === lConn.to_step_id);
          if (lTarget?.step_type === 'content') return lTarget.id;
        }
      }
    }
  }
  return null;
}

function QuizPreview({
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
              {isAnswered && opt.correct && (
                <CheckCircle2 className="w-3 h-3" />
              )}
              {isAnswered && i === selected && !opt.correct && (
                <XCircle className="w-3 h-3" />
              )}
              {opt.label || '(empty option)'}
            </span>
          </button>
        ))}
      </div>
      {isAnswered && element.explanation && (
        <p
          className={`mt-2 text-[10px] p-2 rounded-lg ${isCorrect
            ? 'bg-green/10 text-green'
            : 'bg-orange-500/10 text-orange-400'
            }`}
        >
          {isCorrect ? 'Correct! ' : 'Not quite. '}
          {element.explanation}
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

function BranchPreview({
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

export function TutorialPreview() {
  const { steps, connections, variables, game } = useEditorStore();
  const [history, setHistory] = useState<string[]>([]);
  const [quizDone, setQuizDone] = useState<Set<string>>(new Set());
  const [varState, setVarState] = useState<VariableState>(() =>
    initVariableState(variables)
  );

  const contentSteps = useMemo(
    () => steps.filter((s) => s.step_type === 'content'),
    [steps]
  );

  const startStep = useMemo(
    () => findFirstContentStep(steps, connections),
    [steps, connections]
  );

  const currentStepId = history.length > 0 ? history[history.length - 1] : startStep?.id;
  const step = steps.find((s) => s.id === currentStepId && s.step_type === 'content');
  const content = step?.content_json;
  const hasQuiz = !!content?.interactive;
  const quizCompleted = currentStepId ? quizDone.has(currentStepId) : false;

  const branches = useMemo(() => {
    if (!step) return null;
    return resolveBranches(step, steps, connections, varState);
  }, [step, steps, connections, varState]);

  const autoTarget = branches?.autoTarget ?? null;

  const nextStepId = useMemo(() => {
    if (autoTarget) return autoTarget;
    if (!step) return null;
    return getNextContentStepId(step, steps, connections);
  }, [step, steps, connections, autoTarget]);

  const hasBranching = branches !== null && branches.branches.length > 0;
  const canAdvance = !hasQuiz || quizCompleted;
  const isTerminal = !hasBranching && !nextStepId;

  const bodyHtml = useMemo(() => {
    if (!content?.body) return '';
    const interpolated = interpolateVariables(content.body, varState);
    return interpolated
      .replace(
        /\*\*(.*?)\*\*/g,
        '<strong class="text-foreground font-semibold">$1</strong>'
      )
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  }, [content?.body, varState]);

  const tipHtml = useMemo(() => {
    if (!content?.tip) return '';
    const interpolated = interpolateVariables(content.tip, varState);
    return interpolated
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  }, [content?.tip, varState]);

  const handleQuizComplete = useCallback(() => {
    if (currentStepId) {
      setQuizDone((prev) => new Set(prev).add(currentStepId));
    }
  }, [currentStepId]);

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
    setQuizDone(new Set());
    setVarState(initVariableState(variables));
  }, [variables]);

  const handleNext = useCallback(() => {
    if (nextStepId) navigateTo(nextStepId);
  }, [nextStepId, navigateTo]);

  if (contentSteps.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <Eye className="w-8 h-8 text-foreground-faint mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground mb-1">
            Nothing to preview
          </p>
          <p className="text-xs text-foreground-muted">
            Add content steps in the flow canvas to see a preview.
          </p>
        </div>
      </div>
    );
  }

  const visitedCount = history.length + 1;
  const progress = (visitedCount / contentSteps.length) * 100;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-background border border-border rounded-2xl overflow-hidden shadow-xl max-w-[420px] mx-auto">
          {/* Progress bar */}
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <div className="flex-1">
              <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] text-foreground-faint font-medium tabular-nums">
              {visitedCount}/{contentSteps.length}
            </span>
          </div>

          {/* Content */}
          <div className="p-5">
            {game && (
              <p className="text-[10px] text-accent font-medium uppercase tracking-wider mb-0.5">
                {game.title}
              </p>
            )}

            {content?.is_setup_step && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 border border-accent/20 rounded-full text-[10px] font-medium text-accent mb-2">
                <Package className="w-3 h-3" />
                Setup
              </div>
            )}

            <h2 className="text-base font-bold text-foreground mb-3">
              {content?.heading || 'Untitled Step'}
            </h2>

            {content?.image_url && (
              <img
                src={content.image_url}
                alt=""
                className="w-full rounded-xl mb-3 object-cover max-h-40"
              />
            )}

            {content?.media && content.media.length > 0 && (
              <div className="space-y-2 mb-3">
                {content.media.map((m) =>
                  m.type === 'video' ? (
                    <video
                      key={m.id}
                      src={m.url}
                      controls
                      className="w-full rounded-xl max-h-40"
                    />
                  ) : (
                    <img
                      key={m.id}
                      src={m.url}
                      alt={m.filename}
                      className="w-full rounded-xl object-cover max-h-40"
                    />
                  )
                )}
              </div>
            )}

            <div
              className="text-foreground-secondary leading-relaxed text-xs"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />

            {content?.code_block && (
              <div className="mt-3 rounded-xl overflow-hidden border border-white/[0.08]">
                {content.code_block.filename && (
                  <div className="px-3 py-1.5 bg-white/[0.04] border-b border-white/[0.08] flex items-center gap-2">
                    <span className="text-[9px] font-mono text-foreground-muted">{content.code_block.filename}</span>
                    <span className="text-[8px] text-foreground-faint bg-white/[0.06] px-1 py-0.5 rounded">{content.code_block.language}</span>
                  </div>
                )}
                <pre className="p-3 bg-[#0d1117] overflow-x-auto">
                  <code className="text-[10px] font-mono text-[#e6edf3] leading-relaxed whitespace-pre">
                    {content.code_block.code}
                  </code>
                </pre>
              </div>
            )}

            {content?.board_view && (
              <div className="mt-3">
                <BoardView config={content.board_view} />
              </div>
            )}

            {content?.tip && (
              <div className="mt-3 flex items-start gap-2 p-2.5 bg-accent-glow border border-accent/20 rounded-xl text-[11px]">
                <Lightbulb className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                <p
                  className="text-foreground-secondary"
                  dangerouslySetInnerHTML={{ __html: tipHtml }}
                />
              </div>
            )}

            {hasQuiz && !quizCompleted && (
              <QuizPreview
                element={content!.interactive!}
                onComplete={handleQuizComplete}
              />
            )}

            {hasBranching && canAdvance && (
              <BranchPreview
                prompt={branches!.prompt}
                branches={branches!.branches}
                onSelect={navigateTo}
              />
            )}
          </div>

          {/* Navigation */}
          <div className="px-4 py-2.5 border-t border-border flex items-center justify-between">
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
                className="flex items-center gap-1 px-3 py-1 bg-green text-black text-[11px] font-semibold rounded-lg"
              >
                <RotateCcw className="w-3 h-3" />
                Restart
              </button>
            ) : nextStepId ? (
              <button
                onClick={handleNext}
                disabled={!canAdvance}
                className="flex items-center gap-1 px-3 py-1 bg-accent text-black text-[11px] font-semibold rounded-lg hover:bg-accent-light disabled:opacity-40 transition-colors"
              >
                Next
                <ArrowRight className="w-3 h-3" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
