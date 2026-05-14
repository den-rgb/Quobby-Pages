'use client';

import { useEditorStore } from '@/lib/store';
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FileText, GitBranch, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContentStepNode } from './nodes/content-step-node';
import { LogicStepNode } from './nodes/logic-step-node';

const nodeTypes: NodeTypes = {
  contentStep: ContentStepNode,
  logicStep: LogicStepNode,
};

function FlowEditorInner({
  onNodeDoubleClick,
}: {
  onNodeDoubleClick?: () => void;
}) {
  const {
    steps,
    connections,
    selectedStepId,
    selectStep,
    updateStep,
    addContentStep,
    addLogicStep,
    duplicateStep,
    addConnection,
    removeConnection,
    removeStep,
  } = useEditorStore();

  const { screenToFlowPosition } = useReactFlow();
  const clipboardStepId = useRef<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const el = document.activeElement;
      const isTextInput =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (isTextInput) return;

      if (e.key === 'c' && selectedStepId) {
        clipboardStepId.current = selectedStepId;
      }

      if (e.key === 'v' && clipboardStepId.current) {
        e.preventDefault();
        const newStep = duplicateStep(clipboardStepId.current);
        if (newStep) selectStep(newStep.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedStepId, duplicateStep, selectStep]);

  const confirmAndDeleteStep = useCallback((stepId: string) => {
    const step = steps.find((s) => s.id === stepId);
    if (!step) return;
    const hasContent =
      step.step_type === 'content'
        ? (!!step.content_json?.heading && step.content_json.heading !== 'New Step') || !!step.content_json?.body
        : !!step.logic_json?.prompt || (step.logic_json?.conditions?.length ?? 0) > 0;
    if (hasContent && !confirm('Delete this step? This cannot be undone.')) return;
    removeStep(stepId);
  }, [steps, removeStep]);

  const nodes: Node[] = useMemo(
    () =>
      steps.map((step) => ({
        id: step.id,
        type: step.step_type === 'content' ? 'contentStep' : 'logicStep',
        position: { x: step.position_x, y: step.position_y },
        data: {
          step,
          isSelected: selectedStepId === step.id,
          onDelete: () => confirmAndDeleteStep(step.id),
        },
        selected: selectedStepId === step.id,
        draggable: true,
        connectable: true,
      })),
    [steps, selectedStepId, confirmAndDeleteStep]
  );

  const edges: Edge[] = useMemo(
    () =>
      connections.map((conn) => ({
        id: conn.id,
        source: conn.from_step_id,
        target: conn.to_step_id,
        animated: true,
        selectable: true,
        selected: selectedEdgeId === conn.id,
        interactionWidth: 20,
        style: {
          stroke: selectedEdgeId === conn.id ? 'rgba(255, 100, 150, 0.9)' : 'rgba(161, 48, 107, 0.6)',
          strokeWidth: selectedEdgeId === conn.id ? 3 : 2,
        },
      })),
    [connections, selectedEdgeId]
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      let newSelection: string | null | undefined;
      for (const change of changes) {
        if (change.type === 'position' && change.position && !change.dragging) {
          updateStep(change.id, {
            position_x: change.position.x,
            position_y: change.position.y,
          });
        }
        if (change.type === 'select') {
          if (change.selected) {
            newSelection = change.id;
          } else if (selectedStepId === change.id && newSelection === undefined) {
            newSelection = null;
          }
        }
        if (change.type === 'remove') {
          confirmAndDeleteStep(change.id);
        }
      }
      if (newSelection !== undefined) {
        selectStep(newSelection);
      }
    },
    [updateStep, selectStep, confirmAndDeleteStep, selectedStepId]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      for (const change of changes) {
        if (change.type === 'remove') {
          removeConnection(change.id);
          if (selectedEdgeId === change.id) setSelectedEdgeId(null);
        }
        if (change.type === 'select') {
          setSelectedEdgeId(change.selected ? change.id : null);
        }
      }
    },
    [removeConnection, selectedEdgeId]
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (connection.source && connection.target) {
        addConnection(connection.source, connection.target);
      }
    },
    [addConnection]
  );

  const onPaneClick = useCallback(() => {
    selectStep(null);
    setSelectedEdgeId(null);
  }, [selectStep]);

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      selectStep(node.id);
      onNodeDoubleClick?.();
    },
    [selectStep, onNodeDoubleClick]
  );

  const getNewNodePosition = useCallback(() => {
    if (steps.length === 0) return { x: 250, y: 80 };
    const lastStep = steps[steps.length - 1];
    const x = Math.round((lastStep.position_x + 300) / 20) * 20;
    const y = Math.round(lastStep.position_y / 20) * 20;
    return { x, y };
  }, [steps]);

  const handleAddContentStep = useCallback(() => {
    const { x, y } = getNewNodePosition();
    const step = addContentStep(x, y);
    selectStep(step.id);
  }, [getNewNodePosition, addContentStep, selectStep]);

  const handleAddLogicStep = useCallback(() => {
    const { x, y } = getNewNodePosition();
    const step = addLogicStep(x, y);
    selectStep(step.id);
  }, [getNewNodePosition, addLogicStep, selectStep]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/qurator-step-type');
      if (!type) return;
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const step =
        type === 'content'
          ? addContentStep(position.x, position.y)
          : addLogicStep(position.x, position.y);
      selectStep(step.id);
    },
    [screenToFlowPosition, addContentStep, addLogicStep, selectStep]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onPaneClick={onPaneClick}
      onNodeDoubleClick={handleNodeDoubleClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
      nodeTypes={nodeTypes}
      fitView
      deleteKeyCode={['Backspace', 'Delete']}
      proOptions={{ hideAttribution: true }}
      defaultEdgeOptions={{
        animated: true,
        selectable: true,
        interactionWidth: 20,
        style: { stroke: 'rgba(161, 48, 107, 0.6)', strokeWidth: 2 },
      }}
      connectionLineStyle={{
        stroke: 'rgba(161, 48, 107, 0.4)',
        strokeWidth: 2,
      }}
      snapToGrid
      snapGrid={[20, 20]}
    >
      <Background color="rgba(255,255,255,0.03)" gap={24} />
      <Controls
        position="bottom-left"
        className="!bg-transparent !border-0 !shadow-none"
      />
      <MiniMap
        position="bottom-right"
        nodeColor={(node) =>
          node.type === 'contentStep' ? '#a1306b' : '#b8ff6b'
        }
        nodeStrokeColor="#fff"
        nodeStrokeWidth={2}
        maskColor="rgba(18, 18, 30, 0.6)"
        className="!border !border-border !rounded-xl"
        pannable
        zoomable
      />
      <Panel position="top-left" className="flex gap-2">
        <button
          onClick={handleAddContentStep}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/qurator-step-type', 'content');
            e.dataTransfer.effectAllowed = 'move';
          }}
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:bg-card-hover hover:border-accent/20 transition-all cursor-grab active:cursor-grabbing"
        >
          <FileText className="w-4 h-4 text-accent" />
          Add Content Step
        </button>
        <button
          onClick={handleAddLogicStep}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/qurator-step-type', 'logic');
            e.dataTransfer.effectAllowed = 'move';
          }}
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:bg-card-hover hover:border-green/20 transition-all cursor-grab active:cursor-grabbing"
        >
          <GitBranch className="w-4 h-4 text-green" />
          Add Logic Step
        </button>
      </Panel>

      {steps.length === 0 && (
        <Panel position="top-center" className="mt-20">
          <div className="text-center p-8 bg-card border border-border rounded-2xl max-w-sm">
            <Plus className="w-8 h-8 text-foreground-faint mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-2">
              Start building your tutorial
            </h3>
            <p className="text-sm text-foreground-muted mb-4">
              Add content steps for what players see, and logic steps for
              branching. <strong>Double-click</strong> a step to edit it.
              Drag from a handle to connect steps.
            </p>
            <button
              onClick={handleAddContentStep}
              className="px-4 py-2 bg-accent text-black text-sm font-semibold rounded-lg hover:bg-accent-light transition-colors"
            >
              Add First Step
            </button>
          </div>
        </Panel>
      )}
    </ReactFlow>
  );
}

export function FlowEditor({
  onNodeDoubleClick,
}: {
  onNodeDoubleClick?: () => void;
}) {
  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <FlowEditorInner onNodeDoubleClick={onNodeDoubleClick} />
      </ReactFlowProvider>
    </div>
  );
}
