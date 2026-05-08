'use client';

import { useEditorStore } from '@/lib/store';
import type { VariableType } from '@/lib/types';
import { Plus, Trash2, Variable } from 'lucide-react';
import { useState } from 'react';

export function VariablesPanel() {
  const { variables, addVariable, removeVariable } = useEditorStore();
  const [name, setName] = useState('');
  const [type, setType] = useState<VariableType>('number');
  const [defaultValue, setDefaultValue] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;
    addVariable(name.trim(), type, defaultValue);
    setName('');
    setDefaultValue('');
  };

  return (
    <div className="p-5">
      <div className="flex items-center gap-2.5 mb-5">
        <Variable className="w-5 h-5 text-accent" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Variables
          </h2>
          <p className="text-[10px] text-foreground-muted">
            Dynamic values that power your tutorial. Use{' '}
            <code className="text-accent bg-accent/10 px-0.5 rounded">
              {'{{name}}'}
            </code>{' '}
            in content to display values. Logic steps can set variables when a
            branch is picked, and auto-evaluate conditions against them.
          </p>
        </div>
      </div>

      {/* Add form */}
      <div className="space-y-2 mb-5 p-3 bg-white/[0.02] border border-border rounded-xl">
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Variable name"
            className="flex-1 px-2.5 py-2 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as VariableType)}
            className="px-2.5 py-2 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-accent/30"
          >
            <option value="number">Number</option>
            <option value="string">String</option>
            <option value="boolean">Boolean</option>
          </select>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.target.value)}
            placeholder="Default value"
            className="flex-1 px-2.5 py-2 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={handleAdd}
            disabled={!name.trim()}
            className="px-4 py-2 bg-accent text-black text-xs font-semibold rounded-lg hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Variable list */}
      {variables.length === 0 ? (
        <div className="text-center py-8">
          <Variable className="w-8 h-8 text-foreground-faint mx-auto mb-2" />
          <p className="text-xs text-foreground-muted">No variables yet.</p>
          <p className="text-[10px] text-foreground-faint mt-0.5">
            e.g. playerCount, currentRound, startingPlayer
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {variables.map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-3 px-3 py-2.5 bg-card border border-border rounded-xl"
            >
              <code className="text-xs text-accent font-mono">{v.name}</code>
              <span className="text-[10px] text-foreground-faint px-1.5 py-0.5 bg-white/[0.04] rounded">
                {v.variable_type}
              </span>
              <span className="text-[10px] text-foreground-muted flex-1 truncate">
                = {v.default_value || '(empty)'}
              </span>
              <button
                onClick={() => removeVariable(v.id)}
                className="text-foreground-faint hover:text-red-400 transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
