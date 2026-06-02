'use client';

import { useEditorStore } from '@/lib/store';
import type { BoardCell, BoardPiece, BoardType, BoardViewConfig, CanvasElement, CanvasShape, ContentStepPayload } from '@/lib/types';
import {
  ArrowLeft,
  Camera,
  Check,
  Circle,
  Copy,
  Crown,
  Diamond,
  Dices,
  Eye,
  EyeOff,
  Flag,
  Grid3X3,
  Hexagon,
  Image,
  Loader2,
  MousePointer2,
  RefreshCw,
  Save,
  Square,
  Star,
  Trash2,
  Triangle,
  Type,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const CANVAS_W = 800;
const CANVAS_H = 600;
const GRID_SIZE = 20;
const SNAP_THRESHOLD = 8;

function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function MeepleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 1 3 3c0 1.1-.6 2-1.5 2.5L15 10l4 10H5l4-10 1.5-2.5A3 3 0 0 1 9 5a3 3 0 0 1 3-3z" />
    </svg>
  );
}

function PawnIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="6" r="3" />
      <path d="M10 9h4l1 5H9l1-5z" />
      <path d="M8 14h8l1 6H7l1-6z" />
      <line x1="6" y1="22" x2="18" y2="22" />
    </svg>
  );
}

function TokenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="14" rx="8" ry="4" />
      <ellipse cx="12" cy="10" rx="8" ry="4" />
      <path d="M4 10v4" />
      <path d="M20 10v4" />
    </svg>
  );
}

function CardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M8 6h.01" />
      <path d="M16 18h.01" />
    </svg>
  );
}

function CubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <line x1="12" y1="22" x2="12" y2="12" />
    </svg>
  );
}

type Tool =
  | 'select'
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'diamond'
  | 'star'
  | 'hexagon'
  | 'meeple'
  | 'dice'
  | 'card'
  | 'token'
  | 'pawn'
  | 'cube'
  | 'flag'
  | 'crown'
  | 'text'
  | 'image';

const TOOLS: { tool: Tool; label: string; icon: React.ElementType; group: string }[] = [
  { tool: 'select', label: 'Select', icon: MousePointer2, group: 'pointer' },
  { tool: 'rectangle', label: 'Rectangle', icon: Square, group: 'shape' },
  { tool: 'circle', label: 'Circle', icon: Circle, group: 'shape' },
  { tool: 'triangle', label: 'Triangle', icon: Triangle, group: 'shape' },
  { tool: 'diamond', label: 'Diamond', icon: Diamond, group: 'shape' },
  { tool: 'star', label: 'Star', icon: Star, group: 'shape' },
  { tool: 'hexagon', label: 'Hexagon', icon: Hexagon, group: 'shape' },
  { tool: 'meeple', label: 'Meeple', icon: MeepleIcon, group: 'game' },
  { tool: 'pawn', label: 'Pawn', icon: PawnIcon, group: 'game' },
  { tool: 'dice', label: 'Dice', icon: Dices, group: 'game' },
  { tool: 'card', label: 'Card', icon: CardIcon, group: 'game' },
  { tool: 'token', label: 'Token', icon: TokenIcon, group: 'game' },
  { tool: 'cube', label: 'Resource Cube', icon: CubeIcon, group: 'game' },
  { tool: 'flag', label: 'Flag', icon: Flag, group: 'game' },
  { tool: 'crown', label: 'Crown', icon: Crown, group: 'game' },
  { tool: 'text', label: 'Text', icon: Type, group: 'content' },
  { tool: 'image', label: 'Image', icon: Image, group: 'content' },
];

const FILL_PRESETS = [
  { label: 'Accent', value: 'rgba(161, 48, 107, 0.5)' },
  { label: 'Red', value: 'rgba(220, 60, 60, 0.5)' },
  { label: 'Orange', value: 'rgba(220, 140, 40, 0.5)' },
  { label: 'Yellow', value: 'rgba(220, 200, 40, 0.5)' },
  { label: 'Green', value: 'rgba(60, 180, 80, 0.5)' },
  { label: 'Teal', value: 'rgba(60, 160, 140, 0.5)' },
  { label: 'Blue', value: 'rgba(60, 140, 220, 0.5)' },
  { label: 'Purple', value: 'rgba(130, 80, 180, 0.5)' },
  { label: 'Light', value: 'rgba(200, 200, 200, 0.3)' },
  { label: 'Dark', value: 'rgba(40, 40, 50, 0.8)' },
  { label: 'Glass', value: 'rgba(255, 255, 255, 0.1)' },
  { label: 'None', value: 'transparent' },
];

const STROKE_PRESETS = [
  { label: 'White', value: 'rgba(255, 255, 255, 0.3)' },
  { label: 'Bright', value: 'rgba(255, 255, 255, 0.6)' },
  { label: 'Accent', value: 'rgba(161, 48, 107, 0.7)' },
  { label: 'Red', value: 'rgba(220, 60, 60, 0.7)' },
  { label: 'Blue', value: 'rgba(60, 140, 220, 0.7)' },
  { label: 'Green', value: 'rgba(60, 180, 80, 0.7)' },
  { label: 'None', value: 'transparent' },
];

interface ExtractionResult {
  elements: CanvasElement[];
  title?: string;
  suggestedBoardType?: BoardType;
  gridDimensions?: { rows: number; cols: number };
  gridCells?: BoardCell[];
  gridPieces?: BoardPiece[];
}

const TEXT_COLOR_PRESETS = [
  { label: 'White', value: 'rgba(255, 255, 255, 0.9)' },
  { label: 'Dim', value: 'rgba(255, 255, 255, 0.6)' },
  { label: 'Accent', value: 'rgba(161, 48, 107, 0.9)' },
  { label: 'Green', value: 'rgba(184, 255, 107, 0.9)' },
  { label: 'Blue', value: 'rgba(100, 180, 255, 0.9)' },
  { label: 'Yellow', value: 'rgba(255, 220, 80, 0.9)' },
  { label: 'Red', value: 'rgba(255, 100, 100, 0.9)' },
];

const DEFAULT_SHAPE_SIZE = 80;

type DragState = {
  type: 'move';
  elementId: string;
  startX: number;
  startY: number;
  elStartX: number;
  elStartY: number;
} | {
  type: 'resize';
  elementId: string;
  handle: 'nw' | 'ne' | 'sw' | 'se';
  startX: number;
  startY: number;
  elStartX: number;
  elStartY: number;
  elStartW: number;
  elStartH: number;
} | null;

function svgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM()?.inverse();
  if (!ctm) return { x: 0, y: 0 };
  const transformed = pt.matrixTransform(ctm);
  return { x: transformed.x, y: transformed.y };
}

function shapePoints(shape: CanvasShape, x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2;
  const cy = y + h / 2;
  switch (shape) {
    case 'triangle':
      return `${cx},${y} ${x + w},${y + h} ${x},${y + h}`;
    case 'diamond':
      return `${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`;
    case 'star': {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const r = i % 2 === 0 ? Math.min(w, h) / 2 : Math.min(w, h) / 4.5;
        pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
      }
      return pts.join(' ');
    }
    case 'hexagon': {
      const pts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const rx = w / 2;
        const ry = h / 2;
        pts.push(`${cx + rx * Math.cos(angle)},${cy + ry * Math.sin(angle)}`);
      }
      return pts.join(' ');
    }
    case 'crown': {
      return [
        `${x},${y + h}`,
        `${x},${y + h * 0.18}`,
        `${x + w * 0.34},${y + h * 0.58}`,
        `${x + w * 0.5},${y}`,
        `${x + w * 0.66},${y + h * 0.58}`,
        `${x + w},${y + h * 0.18}`,
        `${x + w},${y + h}`,
      ].join(' ');
    }
    case 'flag': {
      const pw = w * 0.12;
      return `${x},${y + h} ${x},${y} ${x + w},${y + h * 0.25} ${x + pw},${y + h * 0.5} ${x + pw},${y + h} ${x},${y + h}`;
    }
    default:
      return '';
  }
}

function gameShapePath(shape: CanvasShape, x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2;
  switch (shape) {
    case 'meeple': {
      const sx = w / 80;
      const sy = h / 80;
      const ox = x;
      const oy = y;
      return [
        `M${ox + 40 * sx},${oy + 2 * sy}`,
        `a${12 * sx},${12 * sy} 0 0 1 ${12 * sx},${12 * sy}`,
        `a${12 * sx},${12 * sy} 0 0 1 ${-12 * sx},${12 * sy}`,
        `a${12 * sx},${12 * sy} 0 0 1 ${-12 * sx},${-12 * sy}`,
        `a${12 * sx},${12 * sy} 0 0 1 ${12 * sx},${-12 * sy}`,
        `Z`,
        `M${ox + 28 * sx},${oy + 26 * sy}`,
        `L${ox + 4 * sx},${oy + 48 * sy}`,
        `Q${ox},${oy + 52 * sy} ${ox + 4 * sx},${oy + 56 * sy}`,
        `L${ox + 20 * sx},${oy + 56 * sy}`,
        `L${ox + 28 * sx},${oy + 42 * sy}`,
        `L${ox + 28 * sx},${oy + 76 * sy}`,
        `L${ox + 52 * sx},${oy + 76 * sy}`,
        `L${ox + 52 * sx},${oy + 42 * sy}`,
        `L${ox + 60 * sx},${oy + 56 * sy}`,
        `L${ox + 76 * sx},${oy + 56 * sy}`,
        `Q${ox + 80 * sx},${oy + 52 * sy} ${ox + 76 * sx},${oy + 48 * sy}`,
        `L${ox + 52 * sx},${oy + 26 * sy}`,
        `Z`,
      ].join(' ');
    }
    case 'pawn': {
      const sx = w / 60;
      const sy = h / 80;
      const ox = x;
      const oy = y;
      return [
        `M${ox + 30 * sx},${oy + 4 * sy}`,
        `a${10 * sx},${10 * sy} 0 0 1 0,${20 * sy}`,
        `a${10 * sx},${10 * sy} 0 0 1 0,${-20 * sy}`,
        `Z`,
        `M${ox + 22 * sx},${oy + 24 * sy}`,
        `L${ox + 16 * sx},${oy + 50 * sy}`,
        `L${ox + 44 * sx},${oy + 50 * sy}`,
        `L${ox + 38 * sx},${oy + 24 * sy}`,
        `Z`,
        `M${ox + 10 * sx},${oy + 52 * sy}`,
        `L${ox + 8 * sx},${oy + 70 * sy}`,
        `Q${ox + 8 * sx},${oy + 76 * sy} ${ox + 14 * sx},${oy + 76 * sy}`,
        `L${ox + 46 * sx},${oy + 76 * sy}`,
        `Q${ox + 52 * sx},${oy + 76 * sy} ${ox + 52 * sx},${oy + 70 * sy}`,
        `L${ox + 50 * sx},${oy + 52 * sy}`,
        `Z`,
      ].join(' ');
    }
    case 'dice': {
      const sx = w / 80;
      const sy = h / 80;
      const ox = x;
      const oy = y;
      const r = 6 * Math.min(sx, sy);
      const dotR = 4 * Math.min(sx, sy);
      const rect = `M${ox + r * sx / Math.min(sx, sy)},${oy} h${(80 - 2 * r / Math.min(sx, sy)) * sx} a${r},${r} 0 0 1 ${r},${r} v${(80 - 2 * r / Math.min(sx, sy)) * sy} a${r},${r} 0 0 1 ${-r},${r} h${-(80 - 2 * r / Math.min(sx, sy)) * sx} a${r},${r} 0 0 1 ${-r},${-r} v${-(80 - 2 * r / Math.min(sx, sy)) * sy} a${r},${r} 0 0 1 ${r},${-r} Z`;
      const dot = (dx: number, dy: number) =>
        `M${ox + dx * sx + dotR},${oy + dy * sy} a${dotR},${dotR} 0 1 0 ${-dotR * 2},0 a${dotR},${dotR} 0 1 0 ${dotR * 2},0`;
      return `${rect} ${dot(20, 20)} ${dot(60, 20)} ${dot(40, 40)} ${dot(20, 60)} ${dot(60, 60)}`;
    }
    case 'token': {
      const rx = w / 2;
      const ry = h * 0.25;
      const topY = y + h * 0.3;
      const botY = y + h * 0.55;
      return [
        `M${cx - rx},${topY}`,
        `L${cx - rx},${botY}`,
        `a${rx},${ry} 0 0 0 ${rx * 2},0`,
        `L${cx + rx},${topY}`,
        `a${rx},${ry} 0 0 0 ${-rx * 2},0`,
        `Z`,
        `M${cx - rx},${topY}`,
        `a${rx},${ry} 0 0 1 ${rx * 2},0`,
        `a${rx},${ry} 0 0 1 ${-rx * 2},0`,
        `Z`,
      ].join(' ');
    }
    case 'card': {
      const r = Math.min(w, h) * 0.08;
      const cw = w * 0.85;
      const ch = h;
      const ox = x + (w - cw) / 2;
      const oy = y;
      return [
        `M${ox + r},${oy}`,
        `h${cw - 2 * r}`,
        `a${r},${r} 0 0 1 ${r},${r}`,
        `v${ch - 2 * r}`,
        `a${r},${r} 0 0 1 ${-r},${r}`,
        `h${-(cw - 2 * r)}`,
        `a${r},${r} 0 0 1 ${-r},${-r}`,
        `v${-(ch - 2 * r)}`,
        `a${r},${r} 0 0 1 ${r},${-r}`,
        `Z`,
        `M${ox + cw * 0.15},${oy + ch * 0.15}`,
        `h${cw * 0.7}`,
        `v${ch * 0.5}`,
        `h${-cw * 0.7}`,
        `Z`,
      ].join(' ');
    }
    default:
      return '';
  }
}

function ShapeSvg({ el }: { el: CanvasElement }) {
  const { x, y, width: w, height: h, shape, fill, stroke, strokeWidth } = el;
  const f = fill ?? 'rgba(161,48,107,0.5)';
  const s = stroke ?? 'rgba(255,255,255,0.3)';
  const sw = strokeWidth ?? 2;

  switch (shape) {
    case 'circle':
      return (
        <ellipse
          cx={x + w / 2}
          cy={y + h / 2}
          rx={w / 2 - sw / 2}
          ry={h / 2 - sw / 2}
          fill={f}
          stroke={s}
          strokeWidth={sw}
        />
      );
    case 'rectangle':
      return (
        <rect
          x={x + sw / 2}
          y={y + sw / 2}
          width={w - sw}
          height={h - sw}
          rx={4}
          fill={f}
          stroke={s}
          strokeWidth={sw}
        />
      );
    case 'triangle':
    case 'diamond':
    case 'star':
    case 'hexagon':
    case 'flag':
    case 'crown':
      return (
        <polygon
          points={shapePoints(shape!, x, y, w, h)}
          fill={f}
          stroke={s}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
      );
    case 'cube': {
      const sx = w / 80;
      const sy = h / 80;
      const top = { x: x + 40 * sx, y: y + 4 * sy };
      const tr = { x: x + 76 * sx, y: y + 24 * sy };
      const br = { x: x + 76 * sx, y: y + 56 * sy };
      const bot = { x: x + 40 * sx, y: y + 76 * sy };
      const bl = { x: x + 4 * sx, y: y + 56 * sy };
      const tl = { x: x + 4 * sx, y: y + 24 * sy };
      const ctr = { x: x + 40 * sx, y: y + 40 * sy };
      const pts = `${top.x},${top.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bot.x},${bot.y} ${bl.x},${bl.y} ${tl.x},${tl.y}`;
      return (
        <g>
          <polygon points={pts} fill={f} stroke={s} strokeWidth={sw} strokeLinejoin="round" />
          <line x1={ctr.x} y1={ctr.y} x2={bot.x} y2={bot.y} stroke={s} strokeWidth={sw} />
          <line x1={ctr.x} y1={ctr.y} x2={tr.x} y2={tr.y} stroke={s} strokeWidth={sw} />
          <line x1={ctr.x} y1={ctr.y} x2={tl.x} y2={tl.y} stroke={s} strokeWidth={sw} />
        </g>
      );
    }
    case 'meeple':
    case 'pawn':
    case 'dice':
    case 'token':
    case 'card':
      return (
        <path
          d={gameShapePath(shape!, x, y, w, h)}
          fill={f}
          stroke={s}
          strokeWidth={sw}
          strokeLinejoin="round"
          fillRule="evenodd"
        />
      );
    default:
      return (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={4}
          fill={f}
          stroke={s}
          strokeWidth={sw}
        />
      );
  }
}

function ElementSvg({ el }: { el: CanvasElement }) {
  const transform = el.rotation
    ? `rotate(${el.rotation} ${el.x + el.width / 2} ${el.y + el.height / 2})`
    : undefined;

  return (
    <g transform={transform} opacity={el.opacity}>
      {el.type === 'shape' && <ShapeSvg el={el} />}
      {el.type === 'text' && (
        <foreignObject x={el.x} y={el.y} width={el.width} height={el.height}>
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                el.textAlign === 'left'
                  ? 'flex-start'
                  : el.textAlign === 'right'
                    ? 'flex-end'
                    : 'center',
              fontSize: el.fontSize ?? 16,
              fontWeight: el.fontWeight ?? 600,
              color: el.textColor ?? 'rgba(255,255,255,0.9)',
              textAlign: el.textAlign ?? 'center',
              fontFamily: "'Inter', system-ui, sans-serif",
              lineHeight: 1.3,
              padding: '4px 8px',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {el.text ?? 'Text'}
          </div>
        </foreignObject>
      )}
      {el.type === 'image' && el.imageUrl && (
        <image
          href={el.imageUrl}
          x={el.x}
          y={el.y}
          width={el.width}
          height={el.height}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`inset(0 round 8px)`}
        />
      )}
      {el.type === 'image' && !el.imageUrl && (
        <rect
          x={el.x}
          y={el.y}
          width={el.width}
          height={el.height}
          rx={8}
          fill="rgba(255,255,255,0.05)"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
          strokeDasharray="6 3"
        />
      )}
    </g>
  );
}

function ColorSwatches({
  value,
  presets,
  onChange,
}: {
  value: string;
  presets: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {presets.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          title={p.label}
          className={`w-5 h-5 rounded-md border transition-all ${value === p.value
            ? 'border-accent ring-1 ring-accent/40 scale-110'
            : 'border-white/10 hover:border-white/30'
            }`}
          style={{
            background:
              p.value === 'transparent'
                ? 'repeating-conic-gradient(rgba(255,255,255,0.1) 0% 25%, transparent 0% 50%) 50% / 8px 8px'
                : p.value,
          }}
        />
      ))}
    </div>
  );
}

function PropertiesPanel({
  element,
  onUpdate,
  onDelete,
  onDuplicate,
  onBringForward,
  onSendBackward,
}: {
  element: CanvasElement;
  onUpdate: (updates: Partial<CanvasElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          {element.type === 'shape' ? element.shape : element.type}
        </h3>
        <button
          onClick={onDelete}
          className="p-1 text-foreground-faint hover:text-red-400 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Label */}
      <div>
        <label className="block text-[10px] font-medium text-foreground-faint mb-1 uppercase tracking-wider">
          Label (hover tooltip)
        </label>
        <input
          type="text"
          value={element.label ?? ''}
          onChange={(e) => onUpdate({ label: e.target.value || undefined })}
          className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30"
          placeholder="e.g. Red Meeple, Starting Token..."
        />
      </div>

      {/* Position */}
      <div>
        <label className="block text-[10px] font-medium text-foreground-faint mb-1.5 uppercase tracking-wider">
          Position
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-foreground-faint mb-0.5">X</label>
            <input
              type="number"
              value={Math.round(element.x)}
              onChange={(e) => onUpdate({ x: Number(e.target.value) })}
              className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-accent/30"
            />
          </div>
          <div>
            <label className="block text-[10px] text-foreground-faint mb-0.5">Y</label>
            <input
              type="number"
              value={Math.round(element.y)}
              onChange={(e) => onUpdate({ y: Number(e.target.value) })}
              className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-accent/30"
            />
          </div>
        </div>
      </div>

      {/* Size */}
      <div>
        <label className="block text-[10px] font-medium text-foreground-faint mb-1.5 uppercase tracking-wider">
          Size
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-foreground-faint mb-0.5">Width</label>
            <input
              type="number"
              min={10}
              value={Math.round(element.width)}
              onChange={(e) => onUpdate({ width: Math.max(10, Number(e.target.value)) })}
              className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-accent/30"
            />
          </div>
          <div>
            <label className="block text-[10px] text-foreground-faint mb-0.5">Height</label>
            <input
              type="number"
              min={10}
              value={Math.round(element.height)}
              onChange={(e) => onUpdate({ height: Math.max(10, Number(e.target.value)) })}
              className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-accent/30"
            />
          </div>
        </div>
      </div>

      {/* Rotation & Opacity */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-foreground-faint mb-0.5">Rotation</label>
          <input
            type="number"
            value={element.rotation}
            onChange={(e) => onUpdate({ rotation: Number(e.target.value) })}
            className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-accent/30"
          />
        </div>
        <div>
          <label className="block text-[10px] text-foreground-faint mb-0.5">Opacity</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={element.opacity}
            onChange={(e) => onUpdate({ opacity: Number(e.target.value) })}
            className="w-full mt-1.5 accent-accent"
          />
        </div>
      </div>

      {/* Shape-specific */}
      {element.type === 'shape' && (
        <>
          <div>
            <label className="block text-[10px] font-medium text-foreground-faint mb-1.5 uppercase tracking-wider">
              Fill
            </label>
            <ColorSwatches
              value={element.fill ?? 'rgba(161,48,107,0.5)'}
              presets={FILL_PRESETS}
              onChange={(v) => onUpdate({ fill: v })}
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-foreground-faint mb-1.5 uppercase tracking-wider">
              Stroke
            </label>
            <ColorSwatches
              value={element.stroke ?? 'rgba(255,255,255,0.3)'}
              presets={STROKE_PRESETS}
              onChange={(v) => onUpdate({ stroke: v })}
            />
          </div>
          <div>
            <label className="block text-[10px] text-foreground-faint mb-0.5">
              Stroke Width
            </label>
            <input
              type="number"
              min={0}
              max={10}
              step={0.5}
              value={element.strokeWidth ?? 2}
              onChange={(e) => onUpdate({ strokeWidth: Number(e.target.value) })}
              className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-accent/30"
            />
          </div>
        </>
      )}

      {/* Text-specific */}
      {element.type === 'text' && (
        <>
          <div>
            <label className="block text-[10px] font-medium text-foreground-faint mb-1 uppercase tracking-wider">
              Text
            </label>
            <textarea
              value={element.text ?? ''}
              onChange={(e) => onUpdate({ text: e.target.value })}
              rows={3}
              className="w-full px-2.5 py-2 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30 resize-y"
              placeholder="Enter text..."
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-foreground-faint mb-0.5">Size</label>
              <input
                type="number"
                min={8}
                max={72}
                value={element.fontSize ?? 16}
                onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
                className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-accent/30"
              />
            </div>
            <div>
              <label className="block text-[10px] text-foreground-faint mb-0.5">Weight</label>
              <select
                value={element.fontWeight ?? 600}
                onChange={(e) => onUpdate({ fontWeight: Number(e.target.value) })}
                className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-accent/30"
              >
                <option value={400}>Normal</option>
                <option value={500}>Medium</option>
                <option value={600}>Semibold</option>
                <option value={700}>Bold</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-foreground-faint mb-0.5">Align</label>
            <div className="flex gap-1">
              {(['left', 'center', 'right'] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => onUpdate({ textAlign: a })}
                  className={`flex-1 py-1 text-[10px] rounded-md transition-all ${(element.textAlign ?? 'center') === a
                    ? 'bg-accent text-black font-semibold'
                    : 'bg-white/[0.03] text-foreground-muted hover:text-foreground'
                    }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-foreground-faint mb-1.5 uppercase tracking-wider">
              Color
            </label>
            <ColorSwatches
              value={element.textColor ?? 'rgba(255,255,255,0.9)'}
              presets={TEXT_COLOR_PRESETS}
              onChange={(v) => onUpdate({ textColor: v })}
            />
          </div>
        </>
      )}

      {/* Image-specific */}
      {element.type === 'image' && (
        <div>
          <label className="block text-[10px] font-medium text-foreground-faint mb-1 uppercase tracking-wider">
            Image URL
          </label>
          <input
            type="url"
            value={element.imageUrl ?? ''}
            onChange={(e) => onUpdate({ imageUrl: e.target.value || undefined })}
            className="w-full px-2.5 py-2 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30"
            placeholder="https://..."
          />
        </div>
      )}

      {/* Layer actions */}
      <div className="pt-3 border-t border-border space-y-2">
        <label className="block text-[10px] font-medium text-foreground-faint mb-1 uppercase tracking-wider">
          Layer
        </label>
        <div className="flex gap-1.5">
          <button
            onClick={onBringForward}
            className="flex-1 py-1.5 text-[10px] text-foreground-muted bg-white/[0.03] border border-border rounded-lg hover:border-accent/30 transition-all"
          >
            Bring Forward
          </button>
          <button
            onClick={onSendBackward}
            className="flex-1 py-1.5 text-[10px] text-foreground-muted bg-white/[0.03] border border-border rounded-lg hover:border-accent/30 transition-all"
          >
            Send Backward
          </button>
        </div>
        <button
          onClick={onDuplicate}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-foreground-muted bg-white/[0.03] border border-border rounded-lg hover:border-accent/30 transition-all"
        >
          <Copy className="w-3 h-3" />
          Duplicate
        </button>
      </div>
    </div>
  );
}

export function CanvasBoardDesigner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const stepId = searchParams.get('step');

  const { steps, updateStepContent } = useEditorStore();
  const step = steps.find((s) => s.id === stepId);
  const content = step?.content_json;

  const svgRef = useRef<SVGSVGElement>(null);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [drag, setDrag] = useState<DragState>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [boardTitle, setBoardTitle] = useState('');
  const [snapLines, setSnapLines] = useState<{ x?: number; y?: number }>({});
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [showReference, setShowReference] = useState(true);
  const [referenceOpacity, setReferenceOpacity] = useState(0.2);
  const [extractHint, setExtractHint] = useState('');
  const lastImageBase64Ref = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingExtraction, setPendingExtraction] = useState<ExtractionResult | null>(null);
  const [pendingToggles, setPendingToggles] = useState<Record<string, boolean>>({});
  const [pendingMode, setPendingMode] = useState<'canvas' | 'grid'>('canvas');

  const runExtraction = useCallback(async (base64: string, hint?: string) => {
    setExtracting(true);
    setExtractError(null);
    try {
      const res = await fetch('/api/board/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          ...(hint ? { prompt: hint } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Extraction failed' }));
        throw new Error(err.error || 'Extraction failed');
      }

      const data = await res.json() as ExtractionResult;
      if (data.elements?.length) {
        const toggles: Record<string, boolean> = {};
        data.elements.forEach((el) => { toggles[el.id] = true; });
        setPendingToggles(toggles);
        const hasGrid = data.suggestedBoardType && data.suggestedBoardType !== 'custom' && data.gridCells?.length;
        setPendingMode(hasGrid ? 'grid' : 'canvas');
        setPendingExtraction(data);
      } else {
        setExtractError('No board elements detected in the image');
      }
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  }, []);

  const handleImportFromPhoto = useCallback(async (file: File) => {
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    setReferenceImage(dataUrl);
    setShowReference(true);

    const base64 = dataUrl.split(',')[1];
    lastImageBase64Ref.current = base64;
    if (fileInputRef.current) fileInputRef.current.value = '';

    await runExtraction(base64, extractHint || undefined);
  }, [runExtraction, extractHint]);

  const handleRegenerate = useCallback(async () => {
    if (!lastImageBase64Ref.current) return;
    setPendingExtraction(null);
    await runExtraction(lastImageBase64Ref.current, extractHint || undefined);
  }, [runExtraction, extractHint]);

  const handleApplyExtraction = useCallback(() => {
    if (!pendingExtraction) return;

    if (pendingMode === 'grid' && pendingExtraction.gridCells?.length && stepId && step) {
      const gridConfig: BoardViewConfig = {
        type: pendingExtraction.suggestedBoardType ?? 'rect_grid',
        cols: pendingExtraction.gridDimensions?.cols ?? 5,
        rows: pendingExtraction.gridDimensions?.rows ?? 5,
        cells: pendingExtraction.gridCells,
        pieces: pendingExtraction.gridPieces ?? [],
        title: pendingExtraction.title,
      };
      const currentContent: ContentStepPayload = step.content_json ?? { heading: '', body: '' };
      updateStepContent(stepId, { ...currentContent, board_view: gridConfig });
      setPendingExtraction(null);
      router.push('/create/new');
      return;
    }

    const included = pendingExtraction.elements.filter((el) => pendingToggles[el.id]);
    if (included.length) {
      setElements((prev) => {
        const maxZ = prev.reduce((max, el) => Math.max(max, el.zIndex), 0);
        const rebased = included.map((el, i) => ({ ...el, zIndex: maxZ + 1 + i }));
        return [...prev, ...rebased];
      });
      if (pendingExtraction.title && !boardTitle) {
        setBoardTitle(pendingExtraction.title);
      }
    }
    setPendingExtraction(null);
  }, [pendingExtraction, pendingMode, pendingToggles, boardTitle, stepId, step, updateStepContent]);

  const handleCancelExtraction = useCallback(() => {
    setPendingExtraction(null);
  }, []);

  useEffect(() => {
    if (content?.board_view) {
      setElements(content.board_view.canvas_elements ?? []);
      setBoardTitle(content.board_view.title ?? '');
    } else {
      setElements([]);
      setBoardTitle('');
    }
    setSelectedId(null);
    setTool('select');
  }, [stepId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toSvg = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      return svgPoint(svgRef.current, clientX, clientY);
    },
    []
  );

  const nextZ = useMemo(
    () => elements.reduce((max, el) => Math.max(max, el.zIndex), 0) + 1,
    [elements]
  );

  const addElement = useCallback(
    (type: CanvasElement['type'], cx: number, cy: number, overrides: Partial<CanvasElement> = {}) => {
      const w = type === 'text' ? 200 : type === 'image' ? 150 : DEFAULT_SHAPE_SIZE;
      const h = type === 'text' ? 40 : type === 'image' ? 150 : DEFAULT_SHAPE_SIZE;
      const el: CanvasElement = {
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        x: cx - w / 2,
        y: cy - h / 2,
        width: w,
        height: h,
        rotation: 0,
        zIndex: nextZ,
        opacity: 1,
        ...overrides,
      };
      setElements((prev) => [...prev, el]);
      setSelectedId(el.id);
      setTool('select');
    },
    [nextZ]
  );

  const updateElement = useCallback((id: string, updates: Partial<CanvasElement>) => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...updates } : el)));
  }, []);

  const deleteElement = useCallback(
    (id: string) => {
      setElements((prev) => prev.filter((el) => el.id !== id));
      if (selectedId === id) setSelectedId(null);
    },
    [selectedId]
  );

  const duplicateElement = useCallback(
    (id: string) => {
      const source = elements.find((el) => el.id === id);
      if (!source) return;
      const newEl: CanvasElement = {
        ...source,
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        x: source.x + 20,
        y: source.y + 20,
        zIndex: nextZ,
      };
      setElements((prev) => [...prev, newEl]);
      setSelectedId(newEl.id);
    },
    [elements, nextZ]
  );

  const bringForward = useCallback(
    (id: string) => {
      setElements((prev) => {
        const el = prev.find((e) => e.id === id);
        if (!el) return prev;
        const maxZ = prev.reduce((max, e) => Math.max(max, e.zIndex), 0);
        return prev.map((e) => (e.id === id ? { ...e, zIndex: maxZ + 1 } : e));
      });
    },
    []
  );

  const sendBackward = useCallback(
    (id: string) => {
      setElements((prev) => {
        const el = prev.find((e) => e.id === id);
        if (!el) return prev;
        const minZ = prev.reduce((min, e) => Math.min(min, e.zIndex), Infinity);
        return prev.map((e) => (e.id === id ? { ...e, zIndex: minZ - 1 } : e));
      });
    },
    []
  );

  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0) return;
      const { x, y } = toSvg(e.clientX, e.clientY);

      if (tool === 'select') {
        setSelectedId(null);
        return;
      }

      const shapeTools: Tool[] = [
        'rectangle', 'circle', 'triangle', 'diamond', 'star', 'hexagon',
        'meeple', 'dice', 'card', 'token', 'pawn', 'cube', 'flag', 'crown',
      ];
      if (shapeTools.includes(tool)) {
        const gameDefaults: Partial<Record<Tool, { w: number; h: number }>> = {
          meeple: { w: 60, h: 70 },
          pawn: { w: 50, h: 70 },
          dice: { w: 60, h: 60 },
          card: { w: 55, h: 80 },
          token: { w: 60, h: 50 },
          cube: { w: 50, h: 50 },
          flag: { w: 50, h: 60 },
          crown: { w: 70, h: 50 },
        };
        const sz = gameDefaults[tool];
        addElement('shape', x, y, {
          shape: tool as CanvasShape,
          fill: 'rgba(161, 48, 107, 0.5)',
          stroke: 'rgba(255, 255, 255, 0.3)',
          strokeWidth: 2,
          ...(sz ? { width: sz.w, height: sz.h } : {}),
        });
        return;
      }

      if (tool === 'text') {
        addElement('text', x, y, {
          text: 'Text',
          fontSize: 18,
          fontWeight: 600,
          textColor: 'rgba(255, 255, 255, 0.9)',
          textAlign: 'center',
          width: 200,
          height: 50,
        });
        return;
      }

      if (tool === 'image') {
        addElement('image', x, y, {
          imageUrl: '',
          width: 150,
          height: 150,
        });
        return;
      }
    },
    [tool, toSvg, addElement]
  );

  const handleElementPointerDown = useCallback(
    (e: React.PointerEvent, elId: string) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      setSelectedId(elId);
      setTool('select');

      const el = elements.find((x) => x.id === elId);
      if (!el) return;

      const { x, y } = toSvg(e.clientX, e.clientY);
      setDrag({
        type: 'move',
        elementId: elId,
        startX: x,
        startY: y,
        elStartX: el.x,
        elStartY: el.y,
      });
    },
    [elements, toSvg]
  );

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, elId: string, handle: 'nw' | 'ne' | 'sw' | 'se') => {
      e.stopPropagation();
      if (e.button !== 0) return;

      const el = elements.find((x) => x.id === elId);
      if (!el) return;

      const { x, y } = toSvg(e.clientX, e.clientY);
      setDrag({
        type: 'resize',
        elementId: elId,
        handle,
        startX: x,
        startY: y,
        elStartX: el.x,
        elStartY: el.y,
        elStartW: el.width,
        elStartH: el.height,
      });
    },
    [elements, toSvg]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;
      const { x, y } = toSvg(e.clientX, e.clientY);
      const dx = x - drag.startX;
      const dy = y - drag.startY;
      const freeMode = e.shiftKey;

      if (drag.type === 'move') {
        let rawX = drag.elStartX + dx;
        let rawY = drag.elStartY + dy;
        let snapX: number | undefined;
        let snapY: number | undefined;

        if (!freeMode) {
          const el = elements.find((el) => el.id === drag.elementId);
          const elW = el?.width ?? 0;
          const elH = el?.height ?? 0;

          const gridSnappedX = snapToGrid(rawX);
          const gridSnappedY = snapToGrid(rawY);
          if (Math.abs(rawX - gridSnappedX) < SNAP_THRESHOLD) { rawX = gridSnappedX; snapX = rawX; }
          if (Math.abs(rawY - gridSnappedY) < SNAP_THRESHOLD) { rawY = gridSnappedY; snapY = rawY; }

          const gridCenterX = snapToGrid(rawX + elW / 2);
          const gridCenterY = snapToGrid(rawY + elH / 2);
          if (snapX === undefined && Math.abs((rawX + elW / 2) - gridCenterX) < SNAP_THRESHOLD) { rawX = gridCenterX - elW / 2; snapX = gridCenterX; }
          if (snapY === undefined && Math.abs((rawY + elH / 2) - gridCenterY) < SNAP_THRESHOLD) { rawY = gridCenterY - elH / 2; snapY = gridCenterY; }

          for (const other of elements) {
            if (other.id === drag.elementId) continue;
            const otherCX = other.x + other.width / 2;
            const otherCY = other.y + other.height / 2;
            const curCX = rawX + elW / 2;
            const curCY = rawY + elH / 2;
            if (Math.abs(curCX - otherCX) < SNAP_THRESHOLD) { rawX = otherCX - elW / 2; snapX = otherCX; }
            if (Math.abs(curCY - otherCY) < SNAP_THRESHOLD) { rawY = otherCY - elH / 2; snapY = otherCY; }
            if (Math.abs(rawX - other.x) < SNAP_THRESHOLD) { rawX = other.x; snapX = rawX; }
            if (Math.abs(rawY - other.y) < SNAP_THRESHOLD) { rawY = other.y; snapY = rawY; }
            if (Math.abs((rawX + elW) - (other.x + other.width)) < SNAP_THRESHOLD) { rawX = other.x + other.width - elW; snapX = rawX + elW; }
            if (Math.abs((rawY + elH) - (other.y + other.height)) < SNAP_THRESHOLD) { rawY = other.y + other.height - elH; snapY = rawY + elH; }
          }
        }

        setSnapLines({ x: snapX, y: snapY });
        updateElement(drag.elementId, { x: rawX, y: rawY });
      } else if (drag.type === 'resize') {
        const { handle, elStartX, elStartY, elStartW, elStartH } = drag;
        let newX = elStartX;
        let newY = elStartY;
        let newW = elStartW;
        let newH = elStartH;

        if (handle === 'se') {
          newW = Math.max(20, elStartW + dx);
          newH = Math.max(20, elStartH + dy);
        } else if (handle === 'sw') {
          newX = elStartX + dx;
          newW = Math.max(20, elStartW - dx);
          newH = Math.max(20, elStartH + dy);
        } else if (handle === 'ne') {
          newY = elStartY + dy;
          newW = Math.max(20, elStartW + dx);
          newH = Math.max(20, elStartH - dy);
        } else if (handle === 'nw') {
          newX = elStartX + dx;
          newY = elStartY + dy;
          newW = Math.max(20, elStartW - dx);
          newH = Math.max(20, elStartH - dy);
        }

        if (!freeMode) {
          let snapX: number | undefined;
          let snapY: number | undefined;
          const snappedW = snapToGrid(newW);
          const snappedH = snapToGrid(newH);
          if (Math.abs(newW - snappedW) < SNAP_THRESHOLD) { const diff = snappedW - newW; newW = snappedW; if (handle.includes('w')) newX -= diff; snapX = handle.includes('w') ? newX : newX + newW; }
          if (Math.abs(newH - snappedH) < SNAP_THRESHOLD) { const diff = snappedH - newH; newH = snappedH; if (handle.includes('n')) newY -= diff; snapY = handle.includes('n') ? newY : newY + newH; }
          setSnapLines({ x: snapX, y: snapY });
        } else {
          setSnapLines({});
        }

        updateElement(drag.elementId, { x: newX, y: newY, width: newW, height: newH });
      }
    },
    [drag, toSvg, updateElement, elements]
  );

  const handlePointerUp = useCallback(() => {
    setDrag(null);
    setSnapLines({});
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === 'c' && selectedId) {
        const el = elements.find((x) => x.id === selectedId);
        if (el) clipboardRef.current = { ...el };
        return;
      }

      if (mod && e.key === 'v' && clipboardRef.current) {
        e.preventDefault();
        const src = clipboardRef.current;
        const newEl: CanvasElement = {
          ...src,
          id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          x: src.x + 20,
          y: src.y + 20,
          zIndex: elements.reduce((max, el) => Math.max(max, el.zIndex), 0) + 1,
        };
        setElements((prev) => [...prev, newEl]);
        setSelectedId(newEl.id);
        clipboardRef.current = newEl;
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        deleteElement(selectedId);
      }
      if (e.key === 'Escape') {
        setSelectedId(null);
        setTool('select');
      }
      if (!mod && (e.key === 'v' || e.key === 'V')) setTool('select');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, elements, deleteElement]);

  const handleSave = useCallback(() => {
    if (!stepId || !step) return;
    const currentContent: ContentStepPayload = step.content_json ?? { heading: '', body: '' };
    updateStepContent(stepId, {
      ...currentContent,
      board_view: {
        type: 'custom',
        cols: 0,
        rows: 0,
        cells: [],
        pieces: [],
        canvas_elements: elements,
        canvas_width: CANVAS_W,
        canvas_height: CANVAS_H,
        title: boardTitle || undefined,
      },
    });
    router.push('/create/new');
  }, [stepId, step, elements, boardTitle, updateStepContent, router]);

  const clipboardRef = useRef<CanvasElement | null>(null);

  const selectedElement = elements.find((el) => el.id === selectedId);
  const sortedElements = useMemo(
    () => [...elements].sort((a, b) => a.zIndex - b.zIndex),
    [elements]
  );

  if (!step) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-sm text-foreground-muted mb-3">Step not found</p>
          <button
            onClick={() => router.push('/create/new')}
            className="px-4 py-2 bg-accent text-black text-sm font-semibold rounded-lg"
          >
            Back to Editor
          </button>
        </div>
      </div>
    );
  }

  const toolGroups = [
    { key: 'pointer', label: '', tools: TOOLS.filter((t) => t.group === 'pointer') },
    { key: 'shape', label: 'Shapes', tools: TOOLS.filter((t) => t.group === 'shape') },
    { key: 'game', label: 'Game', tools: TOOLS.filter((t) => t.group === 'game') },
    { key: 'content', label: 'Content', tools: TOOLS.filter((t) => t.group === 'content') },
  ];

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border bg-background/90 backdrop-blur-md flex items-center px-4 gap-4 shrink-0 z-30">
        <button
          onClick={() => router.push('/create/new')}
          className="flex items-center gap-1.5 text-foreground-muted hover:text-foreground transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </button>

        <div className="h-5 w-px bg-border" />

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm font-medium text-foreground">Board Setup Designer</span>
          <span className="text-xs text-foreground-faint">—</span>
          <input
            type="text"
            value={boardTitle}
            onChange={(e) => setBoardTitle(e.target.value)}
            className="flex-1 max-w-[200px] px-2 py-1 bg-transparent border-b border-transparent hover:border-border focus:border-accent/30 text-xs text-foreground-muted focus:text-foreground focus:outline-none transition-colors"
            placeholder="Board title..."
          />
        </div>

        <div className="text-[10px] text-foreground-faint tabular-nums">
          {elements.length} element{elements.length !== 1 ? 's' : ''}
        </div>

        {referenceImage && (
          <>
            <div className="h-5 w-px bg-border" />

            <button
              onClick={() => setShowReference((v) => !v)}
              title={showReference ? 'Hide reference' : 'Show reference'}
              className={`p-1.5 rounded-lg transition-all ${showReference
                ? 'text-accent bg-accent/10'
                : 'text-foreground-faint hover:text-foreground hover:bg-white/[0.05]'
                }`}
            >
              {showReference ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>

            {showReference && (
              <input
                type="range"
                min={0.05}
                max={0.5}
                step={0.05}
                value={referenceOpacity}
                onChange={(e) => setReferenceOpacity(Number(e.target.value))}
                className="w-16 h-1 accent-accent"
                title={`Reference opacity: ${Math.round(referenceOpacity * 100)}%`}
              />
            )}

            <button
              onClick={handleRegenerate}
              disabled={extracting}
              title="Regenerate board from photo"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-foreground-muted bg-white/[0.03] border border-border rounded-lg hover:border-accent/30 hover:text-foreground transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${extracting ? 'animate-spin' : ''}`} />
              Regenerate
            </button>

            <input
              type="text"
              value={extractHint}
              onChange={(e) => setExtractHint(e.target.value)}
              className="max-w-[180px] px-2 py-1 bg-transparent border-b border-transparent hover:border-border focus:border-accent/30 text-[11px] text-foreground-muted focus:text-foreground focus:outline-none transition-colors"
              placeholder="Focus on..."
              title="Hint for AI extraction (e.g. 'focus on the scoring track')"
            />
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFromPhoto(file);
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={extracting}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-foreground-muted bg-white/[0.03] border border-border rounded-lg hover:border-accent/30 hover:text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          {extracting ? 'Extracting...' : 'Import from Photo'}
        </button>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-1.5 bg-accent text-black text-sm font-semibold rounded-lg hover:bg-accent-light transition-colors"
        >
          <Save className="w-4 h-4" />
          Save & Return
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left toolbar */}
        <div className="w-[52px] shrink-0 border-r border-border bg-background flex flex-col items-center py-3 gap-0.5 overflow-y-auto">
          {toolGroups.map((group, gi) => (
            <div key={group.key} className="flex flex-col items-center gap-0.5">
              {gi > 0 && <div className="w-6 h-px bg-border my-1.5" />}
              {group.label && (
                <span className="text-[7px] font-semibold text-foreground-faint uppercase tracking-widest mb-0.5">
                  {group.label}
                </span>
              )}
              {group.tools.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.tool}
                    onClick={() => setTool(t.tool)}
                    title={t.label}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${tool === t.tool
                      ? 'bg-accent text-black'
                      : 'text-foreground-muted hover:text-foreground hover:bg-white/[0.05]'
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Canvas area */}
        <div className="flex-1 relative flex items-center justify-center bg-background-secondary overflow-hidden p-6">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            className="w-full h-full max-w-[900px] max-h-full rounded-xl border border-border shadow-2xl"
            style={{
              aspectRatio: `${CANVAS_W}/${CANVAS_H}`,
              background:
                'linear-gradient(145deg, rgba(14,14,24,1) 0%, rgba(8,8,16,1) 100%)',
              cursor:
                tool === 'select'
                  ? drag
                    ? 'grabbing'
                    : 'default'
                  : 'crosshair',
            }}
            preserveAspectRatio="xMidYMid meet"
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* Grid dots */}
            <defs>
              <pattern id="grid-dots" width={20} height={20} patternUnits="userSpaceOnUse">
                <circle cx={10} cy={10} r={0.5} fill="rgba(255,255,255,0.08)" />
              </pattern>
            </defs>
            <rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid-dots)" />

            {/* Reference image background */}
            {referenceImage && showReference && (
              <image
                href={referenceImage}
                x={0}
                y={0}
                width={CANVAS_W}
                height={CANVAS_H}
                preserveAspectRatio="xMidYMid meet"
                opacity={referenceOpacity}
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Canvas boundary indicator */}
            <rect
              x={0.5}
              y={0.5}
              width={CANVAS_W - 1}
              height={CANVAS_H - 1}
              fill="none"
              stroke="rgba(161, 48, 107, 0.35)"
              strokeWidth={1}
              strokeDasharray="8 4"
              rx={4}
              style={{ pointerEvents: 'none' }}
            />
            <text x={6} y={14} fontSize={9} fill="rgba(161, 48, 107, 0.5)" fontFamily="'Inter', system-ui, sans-serif" fontWeight={500}>capture area</text>

            {/* Elements */}
            {sortedElements.map((el) => (
              <g
                key={el.id}
                onPointerDown={(e) => handleElementPointerDown(e, el.id)}
                onPointerEnter={() => el.label && setHoveredId(el.id)}
                onPointerLeave={() => setHoveredId((prev) => (prev === el.id ? null : prev))}
                style={{ cursor: tool === 'select' ? (drag ? 'grabbing' : 'grab') : 'crosshair' }}
              >
                <ElementSvg el={el} />
                <rect
                  x={el.x - 4}
                  y={el.y - 4}
                  width={el.width + 8}
                  height={el.height + 8}
                  fill="transparent"
                  stroke="none"
                />
              </g>
            ))}

            {/* Selection outline + resize handles */}
            {selectedElement && (
              <g style={{ pointerEvents: 'none' }}>
                <rect
                  x={selectedElement.x - 1}
                  y={selectedElement.y - 1}
                  width={selectedElement.width + 2}
                  height={selectedElement.height + 2}
                  fill="none"
                  stroke="rgba(161, 48, 107, 0.8)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  rx={2}
                  transform={
                    selectedElement.rotation
                      ? `rotate(${selectedElement.rotation} ${selectedElement.x + selectedElement.width / 2} ${selectedElement.y + selectedElement.height / 2})`
                      : undefined
                  }
                />
                {/* Resize handles */}
                {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => {
                  const hx =
                    handle.includes('w') ? selectedElement.x : selectedElement.x + selectedElement.width;
                  const hy =
                    handle.includes('n') ? selectedElement.y : selectedElement.y + selectedElement.height;
                  return (
                    <rect
                      key={handle}
                      x={hx - 4}
                      y={hy - 4}
                      width={8}
                      height={8}
                      rx={2}
                      fill="rgba(161, 48, 107, 1)"
                      stroke="rgba(255,255,255,0.6)"
                      strokeWidth={1}
                      style={{
                        pointerEvents: 'all',
                        cursor:
                          handle === 'nw' || handle === 'se'
                            ? 'nwse-resize'
                            : 'nesw-resize',
                      }}
                      onPointerDown={(e) =>
                        handleResizePointerDown(e, selectedElement.id, handle)
                      }
                    />
                  );
                })}
              </g>
            )}

            {/* Snap guide lines */}
            {snapLines.x !== undefined && (
              <line x1={snapLines.x} y1={0} x2={snapLines.x} y2={CANVAS_H} stroke="rgba(161, 48, 107, 0.6)" strokeWidth={0.5} strokeDasharray="4 3" style={{ pointerEvents: 'none' }} />
            )}
            {snapLines.y !== undefined && (
              <line x1={0} y1={snapLines.y} x2={CANVAS_W} y2={snapLines.y} stroke="rgba(161, 48, 107, 0.6)" strokeWidth={0.5} strokeDasharray="4 3" style={{ pointerEvents: 'none' }} />
            )}

            {/* Hover tooltip */}
            {hoveredId && (() => {
              const el = elements.find((e) => e.id === hoveredId);
              if (!el?.label) return null;
              const tx = el.x + el.width / 2;
              const ty = el.y - 8;
              const tw = Math.max(el.label.length * 6.5 + 20, 60);
              return (
                <g style={{ pointerEvents: 'none' }}>
                  <rect
                    x={tx - tw / 2}
                    y={ty - 26}
                    width={tw}
                    height={22}
                    rx={6}
                    fill="rgba(10,10,20,0.95)"
                    stroke="rgba(161,48,107,0.5)"
                    strokeWidth={1}
                  />
                  <polygon
                    points={`${tx - 4},${ty - 4} ${tx + 4},${ty - 4} ${tx},${ty + 1}`}
                    fill="rgba(10,10,20,0.95)"
                  />
                  <text
                    x={tx}
                    y={ty - 12}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.85)"
                    fontSize={10}
                    fontFamily="'Inter', system-ui, sans-serif"
                    fontWeight={500}
                  >
                    {el.label}
                  </text>
                </g>
              );
            })()}
          </svg>

          {/* Extraction overlay */}
          {extracting && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl z-20">
              <div className="flex flex-col items-center gap-3 px-6 py-5 bg-card border border-border rounded-2xl shadow-2xl">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-sm font-medium text-foreground">Analyzing board...</p>
                <p className="text-xs text-foreground-faint">This may take a few seconds</p>
              </div>
            </div>
          )}

          {/* Extraction review dialog */}
          {pendingExtraction && !extracting && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm rounded-xl z-20">
              <div className="w-[420px] max-h-[80%] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
                {/* Review header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Review Extraction</h3>
                    {pendingExtraction.title && (
                      <p className="text-xs text-foreground-faint mt-0.5">{pendingExtraction.title}</p>
                    )}
                  </div>
                  <button
                    onClick={handleCancelExtraction}
                    className="p-1 text-foreground-faint hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Mode selector (if grid available) */}
                {pendingExtraction.suggestedBoardType && pendingExtraction.suggestedBoardType !== 'custom' && pendingExtraction.gridCells?.length ? (
                  <div className="px-5 py-3 border-b border-border">
                    <p className="text-[10px] font-medium text-foreground-faint uppercase tracking-wider mb-2">Board Mode</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPendingMode('canvas')}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${pendingMode === 'canvas'
                            ? 'bg-accent text-black'
                            : 'bg-white/[0.03] text-foreground-muted border border-border hover:border-accent/30'
                          }`}
                      >
                        <Image className="w-3.5 h-3.5" />
                        Canvas ({pendingExtraction.elements.length} elements)
                      </button>
                      <button
                        onClick={() => setPendingMode('grid')}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${pendingMode === 'grid'
                            ? 'bg-accent text-black'
                            : 'bg-white/[0.03] text-foreground-muted border border-border hover:border-accent/30'
                          }`}
                      >
                        <Grid3X3 className="w-3.5 h-3.5" />
                        {pendingExtraction.suggestedBoardType.replace('_', ' ')} ({pendingExtraction.gridCells.length} cells)
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Element list */}
                <div className="flex-1 overflow-y-auto px-5 py-3">
                  {pendingMode === 'canvas' ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-medium text-foreground-faint uppercase tracking-wider">
                          Elements ({Object.values(pendingToggles).filter(Boolean).length}/{pendingExtraction.elements.length})
                        </p>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              const all: Record<string, boolean> = {};
                              pendingExtraction.elements.forEach((el) => { all[el.id] = true; });
                              setPendingToggles(all);
                            }}
                            className="text-[10px] text-accent hover:text-accent-light transition-colors"
                          >
                            All
                          </button>
                          <span className="text-[10px] text-foreground-faint">|</span>
                          <button
                            onClick={() => {
                              const none: Record<string, boolean> = {};
                              pendingExtraction.elements.forEach((el) => { none[el.id] = false; });
                              setPendingToggles(none);
                            }}
                            className="text-[10px] text-foreground-faint hover:text-foreground transition-colors"
                          >
                            None
                          </button>
                        </div>
                      </div>
                      {pendingExtraction.elements.map((el) => (
                        <label
                          key={el.id}
                          className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all ${pendingToggles[el.id]
                              ? 'bg-accent/10 border border-accent/20'
                              : 'bg-white/[0.02] border border-transparent hover:border-border'
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={pendingToggles[el.id] ?? true}
                            onChange={(e) => setPendingToggles((prev) => ({ ...prev, [el.id]: e.target.checked }))}
                            className="accent-accent w-3.5 h-3.5"
                          />
                          <div
                            className="w-4 h-4 rounded shrink-0 border border-white/10"
                            style={{ background: el.type === 'shape' ? (el.fill ?? 'rgba(161,48,107,0.5)') : 'rgba(255,255,255,0.1)' }}
                          />
                          <span className="text-xs text-foreground flex-1 truncate">
                            {el.label || el.text || (el.type === 'shape' ? el.shape : el.type)}
                          </span>
                          <span className="text-[10px] text-foreground-faint capitalize">{el.type === 'shape' ? el.shape : el.type}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10px] font-medium text-foreground-faint uppercase tracking-wider mb-2">
                        Grid: {pendingExtraction.suggestedBoardType?.replace('_', ' ')} — {pendingExtraction.gridDimensions?.cols}×{pendingExtraction.gridDimensions?.rows}
                      </p>
                      <div className="grid grid-cols-5 gap-1">
                        {pendingExtraction.gridCells?.slice(0, 25).map((cell, i) => (
                          <div
                            key={cell.id}
                            className="aspect-square rounded-md border border-white/10 flex items-center justify-center"
                            style={{ background: cell.color }}
                            title={cell.tooltip || cell.label || `Cell ${i + 1}`}
                          >
                            <span className="text-[8px] text-white/80 font-medium truncate px-0.5">
                              {cell.icon || cell.label || ''}
                            </span>
                          </div>
                        ))}
                      </div>
                      {(pendingExtraction.gridCells?.length ?? 0) > 25 && (
                        <p className="text-[10px] text-foreground-faint text-center">
                          + {(pendingExtraction.gridCells?.length ?? 0) - 25} more cells
                        </p>
                      )}
                      {pendingExtraction.gridPieces?.length ? (
                        <p className="text-xs text-foreground-muted mt-2">
                          {pendingExtraction.gridPieces.length} piece{pendingExtraction.gridPieces.length !== 1 ? 's' : ''} detected
                        </p>
                      ) : null}
                      <p className="text-[10px] text-foreground-faint mt-1">
                        Grid mode will replace the canvas with a structured grid board.
                      </p>
                    </div>
                  )}
                </div>

                {/* Review footer */}
                <div className="flex items-center gap-2 px-5 py-3 border-t border-border">
                  <button
                    onClick={handleRegenerate}
                    disabled={extracting}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground-muted bg-white/[0.03] border border-border rounded-lg hover:border-accent/30 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerate
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={handleCancelExtraction}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground-muted bg-white/[0.03] border border-border rounded-lg hover:border-accent/30 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                  <button
                    onClick={handleApplyExtraction}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-accent text-black rounded-lg hover:bg-accent-light transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Apply {pendingMode === 'canvas' ? `(${Object.values(pendingToggles).filter(Boolean).length})` : 'Grid'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Extraction error */}
          {extractError && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
              <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl">
                <p className="text-xs text-red-400">{extractError}</p>
                <button
                  onClick={() => setExtractError(null)}
                  className="text-red-400 hover:text-red-300 text-xs font-medium ml-1"
                >
                  dismiss
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right properties panel */}
        {selectedElement && (
          <div className="w-[260px] shrink-0 border-l border-border bg-background overflow-y-auto p-4">
            <PropertiesPanel
              element={selectedElement}
              onUpdate={(u) => updateElement(selectedElement.id, u)}
              onDelete={() => deleteElement(selectedElement.id)}
              onDuplicate={() => duplicateElement(selectedElement.id)}
              onBringForward={() => bringForward(selectedElement.id)}
              onSendBackward={() => sendBackward(selectedElement.id)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
