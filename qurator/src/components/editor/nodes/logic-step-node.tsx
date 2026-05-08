'use client';

import type { TutorialStep } from '@/lib/types';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitBranch, Trash2 } from 'lucide-react';

interface LogicStepData {
  step: TutorialStep;
  isSelected: boolean;
  onDelete: () => void;
}

export function LogicStepNode({ data }: NodeProps) {
  const { step, isSelected, onDelete } = data as unknown as LogicStepData;
  const logic = step.logic_json;
  const condCount = logic?.conditions?.length ?? 0;

  return (
    <div
      className={`min-w-[180px] max-w-[240px] rounded-xl border-2 transition-all ${isSelected
          ? 'border-green shadow-[0_0_20px_rgba(184,255,107,0.2)]'
          : 'border-border hover:border-green/30'
        } bg-background-secondary`}
      style={{ transform: 'rotate(0deg)' }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-green !border-2 !border-background"
      />

      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-green" />
          <span className="text-xs font-medium text-foreground-muted uppercase tracking-wider">
            Logic
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
        <p className="text-xs text-foreground-muted">
          {condCount === 0
            ? 'No conditions set'
            : `${condCount} condition${condCount !== 1 ? 's' : ''}`}
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-green !border-2 !border-background"
      />
    </div>
  );
}
