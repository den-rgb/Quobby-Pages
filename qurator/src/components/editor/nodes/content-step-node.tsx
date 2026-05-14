'use client';

import { stripMarkdown } from '@/lib/tutorial-navigation';
import type { TutorialStep } from '@/lib/types';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FileText, HelpCircle, Trash2 } from 'lucide-react';

interface ContentStepData {
  step: TutorialStep;
  isSelected: boolean;
  onDelete: () => void;
}

export function ContentStepNode({ data }: NodeProps) {
  const { step, isSelected, onDelete } = data as unknown as ContentStepData;
  const content = step.content_json;

  return (
    <div
      className={`min-w-[220px] max-w-[280px] rounded-xl border-2 transition-all ${isSelected
        ? 'border-accent shadow-[0_0_20px_rgba(161,48,107,0.3)]'
        : 'border-border hover:border-accent/30'
        } bg-background-secondary`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-accent !border-2 !border-background"
      />

      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent" />
          <span className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
            Content
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-foreground-faint hover:text-red-400 transition-colors p-0.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-4 py-3">
        <h4 className="text-sm font-semibold text-foreground mb-1 truncate">
          {content?.heading || 'Untitled Step'}
        </h4>
        {content?.body && (
          <p className="text-xs text-foreground-muted line-clamp-2">
            {stripMarkdown(content.body)}
          </p>
        )}
        {content?.interactive && (
          <div className="flex items-center gap-1 mt-2 text-xs text-accent">
            <HelpCircle className="w-3 h-3" />
            Quiz attached
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-accent !border-2 !border-background"
      />
    </div>
  );
}
