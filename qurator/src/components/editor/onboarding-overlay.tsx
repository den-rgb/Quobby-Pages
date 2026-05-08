'use client';

import {
  ArrowRight,
  Box,
  Eye,
  FileText,
  GitBranch,
  GripVertical,
  MousePointerClick,
  Variable,
  Workflow,
  X,
} from 'lucide-react';
import { useState } from 'react';

interface OnboardingStep {
  title: string;
  body: string;
  icon: React.ElementType;
  iconColor: string;
}

const STEPS: OnboardingStep[] = [
  {
    title: 'Welcome to the Tutorial Creator',
    body: 'Build interactive board game tutorials that guide players step by step. This quick tour will show you how everything works.',
    icon: Workflow,
    iconColor: 'text-accent',
  },
  {
    title: 'The Flow Canvas',
    body: 'The canvas is your workspace. Add content steps (what players see) and logic steps (branching conditions). Drag from the bottom handle of one step to the top handle of another to connect them.',
    icon: GripVertical,
    iconColor: 'text-accent',
  },
  {
    title: 'Content Steps',
    body: 'Each content step has a heading, body text (supports **bold**), optional tips, images, board views, and comprehension quizzes. Mark steps as "Setup" to badge them for game preparation.',
    icon: FileText,
    iconColor: 'text-accent',
  },
  {
    title: 'Logic Steps',
    body: 'Logic steps let you branch the tutorial based on variables. Define conditions like "if playerCount > 2, go to step X". Perfect for player-count-specific rules.',
    icon: GitBranch,
    iconColor: 'text-green',
  },
  {
    title: 'Double-Click to Edit',
    body: 'Double-click any step in the canvas to open the Content sidebar and edit it immediately. You can also click the Content button in the toolbar. Use the arrow buttons in the sidebar to navigate between steps.',
    icon: MousePointerClick,
    iconColor: 'text-accent',
  },
  {
    title: 'Variables & Objects',
    body: 'Use the Variables panel to define dynamic values (player count, round number). The Objects panel lets you catalog game components like cards, tokens, and dice.',
    icon: Variable,
    iconColor: 'text-accent',
  },
  {
    title: 'Game Components',
    body: 'Add board views to steps to show interactive game boards — hex grids for Catan-style games, rectangular grids for Codenames, or row layouts for engine builders like Wingspan.',
    icon: Box,
    iconColor: 'text-accent',
  },
  {
    title: 'Preview Your Tutorial',
    body: 'Open the Preview panel to see exactly what players will experience. Test quizzes, check board views, and make sure your tutorial flows smoothly before publishing.',
    icon: Eye,
    iconColor: 'text-accent',
  },
];

export function OnboardingOverlay({ onClose }: { onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const current = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Progress dots */}
        <div className="px-6 pt-5 flex items-center justify-between">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all ${i === stepIndex
                    ? 'w-6 bg-accent'
                    : i < stepIndex
                      ? 'w-3 bg-accent/40'
                      : 'w-3 bg-white/[0.08]'
                  }`}
              />
            ))}
          </div>
          <button
            onClick={onClose}
            className="text-foreground-faint hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-border flex items-center justify-center mx-auto mb-5">
            <current.icon className={`w-7 h-7 ${current.iconColor}`} />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-3">
            {current.title}
          </h3>
          <p className="text-sm text-foreground-muted leading-relaxed">
            {current.body}
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs text-foreground-faint hover:text-foreground transition-colors"
          >
            Skip tour
          </button>

          {isLast ? (
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-5 py-2 bg-accent text-black text-sm font-semibold rounded-lg hover:bg-accent-light transition-colors"
            >
              Get Started
            </button>
          ) : (
            <button
              onClick={() => setStepIndex((i) => i + 1)}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent text-black text-sm font-semibold rounded-lg hover:bg-accent-light transition-colors"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
