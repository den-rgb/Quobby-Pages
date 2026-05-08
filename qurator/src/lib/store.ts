import { create } from 'zustand';
import type {
  Category,
  ContentStepPayload,
  Game,
  LogicStepPayload,
  Tutorial,
  TutorialConnection,
  TutorialObject,
  TutorialStep,
  TutorialVariable,
} from './types';

interface EditorState {
  tutorial: Tutorial | null;
  game: Game | null;
  category: Category | null;
  steps: TutorialStep[];
  connections: TutorialConnection[];
  variables: TutorialVariable[];
  objects: TutorialObject[];
  selectedStepId: string | null;
  isDirty: boolean;

  setTutorial: (tutorial: Tutorial) => void;
  setGame: (game: Game | null) => void;
  setCategory: (category: Category | null) => void;
  setSteps: (steps: TutorialStep[]) => void;
  setConnections: (connections: TutorialConnection[]) => void;
  setVariables: (variables: TutorialVariable[]) => void;
  setObjects: (objects: TutorialObject[]) => void;
  selectStep: (id: string | null) => void;

  addContentStep: (x: number, y: number) => TutorialStep;
  addLogicStep: (x: number, y: number) => TutorialStep;
  duplicateStep: (id: string, offsetX?: number, offsetY?: number) => TutorialStep | null;
  updateStep: (id: string, updates: Partial<TutorialStep>) => void;
  removeStep: (id: string) => void;
  updateStepContent: (id: string, content: ContentStepPayload) => void;
  updateStepLogic: (id: string, logic: LogicStepPayload) => void;

  addConnection: (fromId: string, toId: string) => void;
  removeConnection: (id: string) => void;

  addVariable: (name: string, type: 'number' | 'string' | 'boolean', defaultValue: string) => void;
  removeVariable: (id: string) => void;

  addObject: (obj: Omit<TutorialObject, 'id'>) => void;
  removeObject: (id: string) => void;
}

function uuid(): string {
  return crypto.randomUUID();
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tutorial: null,
  game: null,
  category: null,
  steps: [],
  connections: [],
  variables: [],
  objects: [],
  selectedStepId: null,
  isDirty: false,

  setTutorial: (tutorial) => set({ tutorial }),
  setGame: (game) => set({ game }),
  setCategory: (category) => set({ category }),
  setSteps: (steps) => set({ steps }),
  setConnections: (connections) => set({ connections }),
  setVariables: (variables) => set({ variables }),
  setObjects: (objects) => set({ objects }),
  selectStep: (id) => set({ selectedStepId: id }),

  addContentStep: (x, y) => {
    const step: TutorialStep = {
      id: uuid(),
      tutorial_id: get().tutorial?.id ?? '',
      step_type: 'content',
      sort_order: get().steps.length,
      content_json: { heading: 'New Step', body: '' },
      logic_json: null,
      position_x: x,
      position_y: y,
    };
    set((s) => ({ steps: [...s.steps, step], isDirty: true }));
    return step;
  },

  addLogicStep: (x, y) => {
    const step: TutorialStep = {
      id: uuid(),
      tutorial_id: get().tutorial?.id ?? '',
      step_type: 'logic',
      sort_order: get().steps.length,
      content_json: null,
      logic_json: { prompt: '', conditions: [], default_target_step_id: '', default_label: '' },
      position_x: x,
      position_y: y,
    };
    set((s) => ({ steps: [...s.steps, step], isDirty: true }));
    return step;
  },

  duplicateStep: (id, offsetX = 40, offsetY = 40) => {
    const source = get().steps.find((s) => s.id === id);
    if (!source) return null;
    const step: TutorialStep = {
      ...structuredClone(source),
      id: uuid(),
      sort_order: get().steps.length,
      position_x: source.position_x + offsetX,
      position_y: source.position_y + offsetY,
    };
    set((s) => ({ steps: [...s.steps, step], isDirty: true }));
    return step;
  },

  updateStep: (id, updates) =>
    set((s) => ({
      steps: s.steps.map((step) =>
        step.id === id ? { ...step, ...updates } : step
      ),
      isDirty: true,
    })),

  removeStep: (id) =>
    set((s) => ({
      steps: s.steps.filter((step) => step.id !== id),
      connections: s.connections.filter(
        (c) => c.from_step_id !== id && c.to_step_id !== id
      ),
      selectedStepId: s.selectedStepId === id ? null : s.selectedStepId,
      isDirty: true,
    })),

  updateStepContent: (id, content) =>
    set((s) => ({
      steps: s.steps.map((step) =>
        step.id === id ? { ...step, content_json: content } : step
      ),
      isDirty: true,
    })),

  updateStepLogic: (id, logic) =>
    set((s) => ({
      steps: s.steps.map((step) =>
        step.id === id ? { ...step, logic_json: logic } : step
      ),
      isDirty: true,
    })),

  addConnection: (fromId, toId) => {
    const existing = get().connections.find(
      (c) => c.from_step_id === fromId && c.to_step_id === toId
    );
    if (existing) return;
    const conn: TutorialConnection = {
      id: uuid(),
      from_step_id: fromId,
      to_step_id: toId,
      condition_json: null,
    };
    set((s) => ({ connections: [...s.connections, conn], isDirty: true }));
  },

  removeConnection: (id) =>
    set((s) => ({
      connections: s.connections.filter((c) => c.id !== id),
      isDirty: true,
    })),

  addVariable: (name, type, defaultValue) => {
    const v: TutorialVariable = {
      id: uuid(),
      tutorial_id: get().tutorial?.id ?? '',
      name,
      variable_type: type,
      default_value: defaultValue,
    };
    set((s) => ({ variables: [...s.variables, v], isDirty: true }));
  },

  removeVariable: (id) =>
    set((s) => ({
      variables: s.variables.filter((v) => v.id !== id),
      isDirty: true,
    })),

  addObject: (obj) => {
    const o: TutorialObject = { ...obj, id: uuid() };
    set((s) => ({ objects: [...s.objects, o], isDirty: true }));
  },

  removeObject: (id) =>
    set((s) => ({
      objects: s.objects.filter((o) => o.id !== id),
      isDirty: true,
    })),
}));
