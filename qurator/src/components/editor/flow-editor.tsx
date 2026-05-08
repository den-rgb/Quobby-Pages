'use client';

import { useEditorStore } from '@/lib/store';
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeTypes,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { FileText, GitBranch, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
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

  const clipboardStepId = useRef<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

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

  const nodes: Node[] = useMemo(
    () =>
      steps.map((step) => ({
        id: step.id,
        type: step.step_type === 'content' ? 'contentStep' : 'logicStep',
        position: { x: step.position_x, y: step.position_y },
        data: {
          step,
          isSelected: selectedStepId === step.id,
          onDelete: () => removeStep(step.id),
        },
        selected: selectedStepId === step.id,
        draggable: true,
        connectable: true,
      })),
    [steps, selectedStepId, removeStep]
  );

  const edges: Edge[] = useMemo(
    () =>
      connections.map((conn) => ({
        id: conn.id,
        source: conn.from_step_id,
        target: conn.to_step_id,
        animated: true,
        style: {
          stroke: 'rgba(161, 48, 107, 0.6)',
          strokeWidth: 2,
        },
      })),
    [connections]
  );

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position && !change.dragging) {
          updateStep(change.id, {
            position_x: change.position.x,
            position_y: change.position.y,
          });
        }
        if (change.type === 'select' && change.selected) {
          selectStep(change.id);
        }
        if (change.type === 'select' && !change.selected) {
          if (selectedStepId === change.id) {
            selectStep(null);
          }
        }
        if (change.type === 'remove') {
          removeStep(change.id);
        }
      }
    },
    [updateStep, selectStep, removeStep, selectedStepId]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      for (const change of changes) {
        if (change.type === 'remove') {
          removeConnection(change.id);
        }
      }
    },
    [removeConnection]
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
  }, [selectStep]);

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      selectStep(node.id);
      onNodeDoubleClick?.();
    },
    [selectStep, onNodeDoubleClick]
  );

  const handleAddContentStep = useCallback(() => {
    const x = 250;
    const y = 80 + steps.length * 180;
    const step = addContentStep(x, y);
    selectStep(step.id);
  }, [steps.length, addContentStep, selectStep]);

  const handleAddLogicStep = useCallback(() => {
    const x = 250;
    const y = 80 + steps.length * 180;
    const step = addLogicStep(x, y);
    selectStep(step.id);
  }, [steps.length, addLogicStep, selectStep]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onPaneClick={onPaneClick}
      onNodeDoubleClick={handleNodeDoubleClick}
      nodeTypes={nodeTypes}
      fitView
      proOptions={{ hideAttribution: true }}
      defaultEdgeOptions={{
        animated: true,
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
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:bg-card-hover hover:border-accent/20 transition-all"
        >
          <FileText className="w-4 h-4 text-accent" />
          Add Content Step
        </button>
        <button
          onClick={handleAddLogicStep}
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:bg-card-hover hover:border-green/20 transition-all"
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
