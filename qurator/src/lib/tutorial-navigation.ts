import type {
  LogicCondition,
  TutorialConnection,
  TutorialStep,
  TutorialVariable,
} from './types';

export type VariableState = Record<string, string | number | boolean>;

export interface BranchOption {
  label: string;
  targetStepId: string;
  setsVariable?: { name: string; value: string | number | boolean };
}

export interface BranchResult {
  prompt: string;
  branches: BranchOption[];
  autoTarget?: string;
}

export function initVariableState(variables: TutorialVariable[]): VariableState {
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

export function evaluateCondition(
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

export function interpolateVariables(text: string, state: VariableState): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const val = state[name];
    return val !== undefined ? String(val) : `{{${name}}}`;
  });
}

export type TextPart =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'br' };

export function parseMarkdownLite(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const pattern = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(\n)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) });
    if (m[2]) parts.push({ type: 'bold', value: m[2] });
    else if (m[4]) parts.push({ type: 'italic', value: m[4] });
    else if (m[5]) parts.push({ type: 'br' });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}

function getOutgoingConnections(
  stepId: string,
  connections: TutorialConnection[]
): TutorialConnection[] {
  return connections.filter((c) => c.from_step_id === stepId);
}

export function findFirstContentStep(
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

export function resolveBranches(
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

export function getNextContentStepId(
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
