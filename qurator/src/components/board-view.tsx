'use client';

import type { BoardCell, BoardPiece, BoardViewConfig, CanvasElement, CanvasShape } from '@/lib/types';
import { useState } from 'react';

interface BoardViewProps {
  config: BoardViewConfig;
  className?: string;
}

function Tooltip({ text, x, y }: { text: string; x: number; y: number }) {
  const w = Math.max(text.length * 6.5 + 20, 60);
  return (
    <g style={{ pointerEvents: 'none' }}>
      <rect
        x={x - w / 2}
        y={y - 30}
        width={w}
        height={24}
        rx={8}
        fill="rgba(10,10,20,0.96)"
        stroke="rgba(161,48,107,0.5)"
        strokeWidth={1}
      />
      <polygon
        points={`${x - 5},${y - 6} ${x + 5},${y - 6} ${x},${y}`}
        fill="rgba(10,10,20,0.96)"
      />
      <text
        x={x}
        y={y - 14.5}
        textAnchor="middle"
        fill="rgba(255,255,255,0.85)"
        fontSize={10}
        fontFamily="'Inter', system-ui, sans-serif"
        fontWeight={500}
      >
        {text}
      </text>
    </g>
  );
}

function PieceShape({
  piece,
  cx,
  cy,
  onHover,
}: {
  piece: BoardPiece;
  cx: number;
  cy: number;
  onHover: (id: string | null) => void;
}) {
  const r = 7;

  switch (piece.shape) {
    case 'triangle':
      return (
        <g
          onMouseEnter={() => onHover(piece.id)}
          onMouseLeave={() => onHover(null)}
          style={{ cursor: piece.tooltip ? 'pointer' : 'default' }}
        >
          <polygon
            points={`${cx},${cy - r - 1} ${cx - r},${cy + r * 0.6} ${cx + r},${cy + r * 0.6}`}
            fill={piece.color}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </g>
      );
    case 'square':
      return (
        <g
          onMouseEnter={() => onHover(piece.id)}
          onMouseLeave={() => onHover(null)}
          style={{ cursor: piece.tooltip ? 'pointer' : 'default' }}
        >
          <rect
            x={cx - r * 0.65}
            y={cy - r * 0.65}
            width={r * 1.3}
            height={r * 1.3}
            rx={2}
            fill={piece.color}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={1.5}
          />
        </g>
      );
    case 'diamond':
      return (
        <g
          onMouseEnter={() => onHover(piece.id)}
          onMouseLeave={() => onHover(null)}
          style={{ cursor: piece.tooltip ? 'pointer' : 'default' }}
        >
          <polygon
            points={`${cx},${cy - r} ${cx + r * 0.65},${cy} ${cx},${cy + r} ${cx - r * 0.65},${cy}`}
            fill={piece.color}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </g>
      );
    default:
      return (
        <g
          onMouseEnter={() => onHover(piece.id)}
          onMouseLeave={() => onHover(null)}
          style={{ cursor: piece.tooltip ? 'pointer' : 'default' }}
        >
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill={piece.color}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={1.5}
          />
        </g>
      );
  }
}

// ─── Hex Grid (Catan-style diamond: 3-4-5-4-3) ─────────────────────────────

const CATAN_ROW_PATTERN = [3, 4, 5, 4, 3];

function HexGrid({ config, hovered, setHovered }: {
  config: BoardViewConfig;
  hovered: string | null;
  setHovered: (id: string | null) => void;
}) {
  const hexR = 38;
  const hexW = hexR * Math.sqrt(3);
  const vertSpacing = hexR * 1.5;
  const padX = 50;
  const padY = 50;

  const maxCols = config.cols;
  const rowPattern =
    config.rows === 5 && config.cells.length === 19
      ? CATAN_ROW_PATTERN
      : Array.from({ length: config.rows }, () => maxCols);

  const hexPoints = (cx: number, cy: number) => {
    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 6;
      pts.push(
        `${(cx + hexR * Math.cos(angle)).toFixed(2)},${(cy + hexR * Math.sin(angle)).toFixed(2)}`
      );
    }
    return pts.join(' ');
  };

  const cellPositions: { cell: BoardCell; cx: number; cy: number }[] = [];
  let idx = 0;

  for (let row = 0; row < rowPattern.length; row++) {
    const colsInRow = rowPattern[row];
    const rowWidth = colsInRow * hexW;
    const maxWidth = Math.max(...rowPattern) * hexW;
    const offsetX = (maxWidth - rowWidth) / 2;

    for (let col = 0; col < colsInRow && idx < config.cells.length; col++) {
      const cx = padX + offsetX + col * hexW + hexW / 2;
      const cy = padY + row * vertSpacing + hexR;
      cellPositions.push({ cell: config.cells[idx], cx, cy });
      idx++;
    }
  }

  const allX = cellPositions.map((p) => p.cx);
  const allY = cellPositions.map((p) => p.cy);
  const svgW = Math.max(...allX) + hexR + padX;
  const svgH = Math.max(...allY) + hexR + padY;

  const pieceByCellId = new Map<string, BoardPiece[]>();
  config.pieces.forEach((p) => {
    const arr = pieceByCellId.get(p.cell_id) ?? [];
    arr.push(p);
    pieceByCellId.set(p.cell_id, arr);
  });

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto max-h-[460px]">
      <defs>
        <filter id="hex-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="hex-inner-shadow">
          <feOffset dx="0" dy="1" />
          <feGaussianBlur stdDeviation="1.5" />
          <feComposite operator="out" in="SourceGraphic" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.25 0" />
          <feBlend in="SourceGraphic" mode="normal" />
        </filter>
        <linearGradient id="hex-overlay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.12)" />
        </linearGradient>
      </defs>

      {cellPositions.map(({ cell, cx, cy }) => {
        const isHighlighted = config.highlight_cells?.includes(cell.id) || cell.highlight;
        const isHovered = hovered === cell.id;
        return (
          <g
            key={cell.id}
            style={{ cursor: cell.tooltip ? 'pointer' : 'default' }}
            onMouseEnter={() => cell.tooltip && setHovered(cell.id)}
            onMouseLeave={() => setHovered(null)}
          >
            {isHighlighted && (
              <polygon
                points={hexPoints(cx, cy)}
                fill="none"
                stroke="rgba(161,48,107,0.4)"
                strokeWidth={6}
                filter="url(#hex-glow)"
              />
            )}
            <polygon
              points={hexPoints(cx, cy)}
              fill={cell.color}
              stroke={
                isHovered
                  ? 'rgba(255,255,255,0.35)'
                  : isHighlighted
                    ? 'rgba(161,48,107,0.7)'
                    : 'rgba(255,255,255,0.08)'
              }
              strokeWidth={isHovered ? 2 : isHighlighted ? 2 : 1}
              strokeLinejoin="round"
              filter="url(#hex-inner-shadow)"
            />
            <polygon
              points={hexPoints(cx, cy)}
              fill="url(#hex-overlay)"
              opacity={0.5}
              style={{ pointerEvents: 'none' }}
            />

            {cell.icon && (
              <text
                x={cx}
                y={cy - 4}
                textAnchor="middle"
                dominantBaseline="central"
                fill="rgba(255,255,255,0.7)"
                fontSize={14}
                fontFamily="'Inter', system-ui, sans-serif"
                fontWeight={600}
                letterSpacing={0.5}
              >
                {cell.icon}
              </text>
            )}

            {cell.label && (
              <g>
                <circle
                  cx={cx}
                  cy={cy + 14}
                  r={10}
                  fill="rgba(0,0,0,0.55)"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth={0.75}
                />
                <text
                  x={cx}
                  y={cy + 14}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="rgba(255,255,255,0.9)"
                  fontSize={10}
                  fontWeight={700}
                  fontFamily="'Inter', system-ui, sans-serif"
                >
                  {cell.label}
                </text>
              </g>
            )}

            {pieceByCellId.get(cell.id)?.map((piece, pi) => {
              const count = pieceByCellId.get(cell.id)!.length;
              const offset = (pi - (count - 1) / 2) * 18;
              return (
                <PieceShape
                  key={piece.id}
                  piece={piece}
                  cx={cx + offset}
                  cy={cy - 18}
                  onHover={setHovered}
                />
              );
            })}
          </g>
        );
      })}

      {cellPositions.map(({ cell, cx, cy }) =>
        hovered === cell.id && cell.tooltip ? (
          <Tooltip key={`tip-${cell.id}`} text={cell.tooltip} x={cx} y={cy - hexR - 4} />
        ) : null
      )}

      {config.pieces
        .filter((p) => hovered === p.id && p.tooltip)
        .map((p) => {
          const pos = cellPositions.find((cp) => cp.cell.id === p.cell_id);
          if (!pos) return null;
          return (
            <Tooltip
              key={`ptip-${p.id}`}
              text={p.tooltip!}
              x={pos.cx}
              y={pos.cy - hexR - 20}
            />
          );
        })}
    </svg>
  );
}

// ─── Rectangular Grid (Codenames-style) ─────────────────────────────────────

function RectGrid({ config, hovered, setHovered }: {
  config: BoardViewConfig;
  hovered: string | null;
  setHovered: (id: string | null) => void;
}) {
  const cellW = 76;
  const cellH = 42;
  const pad = 24;
  const gap = 4;
  const svgW = pad * 2 + config.cols * (cellW + gap) - gap;
  const svgH = pad * 2 + config.rows * (cellH + gap) - gap;

  const pieceByCellId = new Map<string, BoardPiece[]>();
  config.pieces.forEach((p) => {
    const arr = pieceByCellId.get(p.cell_id) ?? [];
    arr.push(p);
    pieceByCellId.set(p.cell_id, arr);
  });

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto max-h-[420px]">
      {config.cells.map((cell, i) => {
        const col = i % config.cols;
        const row = Math.floor(i / config.cols);
        const x = pad + col * (cellW + gap);
        const y = pad + row * (cellH + gap);
        const isHighlighted = config.highlight_cells?.includes(cell.id) || cell.highlight;
        const isHovered = hovered === cell.id;
        return (
          <g
            key={cell.id}
            style={{ cursor: cell.tooltip ? 'pointer' : 'default' }}
            onMouseEnter={() => cell.tooltip && setHovered(cell.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <rect
              x={x}
              y={y}
              width={cellW}
              height={cellH}
              rx={8}
              fill={cell.color}
              stroke={
                isHovered
                  ? 'rgba(255,255,255,0.3)'
                  : isHighlighted
                    ? 'rgba(161,48,107,0.6)'
                    : 'rgba(255,255,255,0.06)'
              }
              strokeWidth={isHovered || isHighlighted ? 1.5 : 0.75}
            />
            {cell.label && (
              <text
                x={x + cellW / 2}
                y={y + cellH / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill="rgba(255,255,255,0.8)"
                fontSize={9.5}
                fontFamily="'Inter', system-ui, sans-serif"
                fontWeight={600}
                letterSpacing={0.8}
              >
                {cell.label}
              </text>
            )}
            {pieceByCellId.get(cell.id)?.map((piece, pi) => (
              <PieceShape
                key={piece.id}
                piece={piece}
                cx={x + cellW - 10 - pi * 14}
                cy={y + 10}
                onHover={setHovered}
              />
            ))}
          </g>
        );
      })}

      {config.cells.map((cell, i) => {
        if (hovered !== cell.id || !cell.tooltip) return null;
        const col = i % config.cols;
        const row = Math.floor(i / config.cols);
        const x = pad + col * (cellW + gap) + cellW / 2;
        const y = pad + row * (cellH + gap);
        return <Tooltip key={`tip-${cell.id}`} text={cell.tooltip} x={x} y={y - 2} />;
      })}
    </svg>
  );
}

// ─── Row Layout (Wingspan-style) ────────────────────────────────────────────

function RowLayout({ config, hovered, setHovered }: {
  config: BoardViewConfig;
  hovered: string | null;
  setHovered: (id: string | null) => void;
}) {
  const cellW = 84;
  const cellH = 48;
  const pad = 24;
  const rowGap = 16;
  const colGap = 5;
  const labelH = 20;
  const svgW = pad * 2 + config.cols * (cellW + colGap) - colGap;
  const svgH = pad * 2 + config.rows * (cellH + rowGap + labelH) - rowGap;

  const pieceByCellId = new Map<string, BoardPiece[]>();
  config.pieces.forEach((p) => {
    const arr = pieceByCellId.get(p.cell_id) ?? [];
    arr.push(p);
    pieceByCellId.set(p.cell_id, arr);
  });

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto max-h-[420px]">
      {config.cells.map((cell, i) => {
        const col = i % config.cols;
        const row = Math.floor(i / config.cols);
        const x = pad + col * (cellW + colGap);
        const y = pad + row * (cellH + rowGap + labelH) + labelH;
        const isHighlighted = config.highlight_cells?.includes(cell.id) || cell.highlight;
        const isHovered = hovered === cell.id;
        const isFirstInRow = col === 0;

        return (
          <g
            key={cell.id}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHovered(cell.id)}
            onMouseLeave={() => setHovered(null)}
          >
            {isFirstInRow && cell.tooltip && (
              <text
                x={pad}
                y={y - 5}
                fill="rgba(255,255,255,0.4)"
                fontSize={10}
                fontFamily="'Inter', system-ui, sans-serif"
                fontWeight={600}
                letterSpacing={0.5}
                style={{ textTransform: 'uppercase' }}
              >
                {cell.tooltip}
              </text>
            )}
            <rect
              x={x}
              y={y}
              width={cellW}
              height={cellH}
              rx={10}
              fill={cell.color}
              stroke={
                isHovered
                  ? 'rgba(255,255,255,0.25)'
                  : isHighlighted
                    ? 'rgba(161,48,107,0.5)'
                    : 'rgba(255,255,255,0.05)'
              }
              strokeWidth={isHovered || isHighlighted ? 1.5 : 0.75}
            />
            {cell.icon && (
              <text
                x={x + cellW / 2}
                y={y + 18}
                textAnchor="middle"
                dominantBaseline="central"
                fill="rgba(255,255,255,0.6)"
                fontSize={13}
                fontFamily="'Inter', system-ui, sans-serif"
                fontWeight={500}
              >
                {cell.icon}
              </text>
            )}
            {cell.label && (
              <text
                x={x + cellW / 2}
                y={y + (cell.icon ? 38 : cellH / 2)}
                textAnchor="middle"
                dominantBaseline="central"
                fill="rgba(255,255,255,0.55)"
                fontSize={8}
                fontFamily="'Inter', system-ui, sans-serif"
                fontWeight={500}
              >
                {cell.label}
              </text>
            )}
            {pieceByCellId.get(cell.id)?.map((piece, pi) => (
              <PieceShape
                key={piece.id}
                piece={piece}
                cx={x + cellW - 10 - pi * 14}
                cy={y + 10}
                onHover={setHovered}
              />
            ))}
          </g>
        );
      })}

      {config.cells.map((cell, i) => {
        if (hovered !== cell.id || !cell.tooltip || i % config.cols === 0) return null;
        const col = i % config.cols;
        const row = Math.floor(i / config.cols);
        const x = pad + col * (cellW + colGap) + cellW / 2;
        const y = pad + row * (cellH + rowGap + labelH) + labelH;
        return <Tooltip key={`tip-${cell.id}`} text={cell.tooltip} x={x} y={y - 2} />;
      })}
    </svg>
  );
}

// ─── Canvas View (freeform drag-and-drop boards) ────────────────────────────

function canvasShapePoints(shape: CanvasShape, x: number, y: number, w: number, h: number): string {
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
        pts.push(`${cx + (w / 2) * Math.cos(angle)},${cy + (h / 2) * Math.sin(angle)}`);
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

function canvasGameShapePath(shape: CanvasShape, x: number, y: number, w: number, h: number): string {
  const cx = x + w / 2;
  switch (shape) {
    case 'meeple': {
      const sx = w / 80; const sy = h / 80;
      return [
        `M${x + 40 * sx},${y + 2 * sy}`, `a${12 * sx},${12 * sy} 0 0 1 ${12 * sx},${12 * sy}`, `a${12 * sx},${12 * sy} 0 0 1 ${-12 * sx},${12 * sy}`,
        `a${12 * sx},${12 * sy} 0 0 1 ${-12 * sx},${-12 * sy}`, `a${12 * sx},${12 * sy} 0 0 1 ${12 * sx},${-12 * sy}`, `Z`,
        `M${x + 28 * sx},${y + 26 * sy}`, `L${x + 4 * sx},${y + 48 * sy}`, `Q${x},${y + 52 * sy} ${x + 4 * sx},${y + 56 * sy}`,
        `L${x + 20 * sx},${y + 56 * sy}`, `L${x + 28 * sx},${y + 42 * sy}`, `L${x + 28 * sx},${y + 76 * sy}`,
        `L${x + 52 * sx},${y + 76 * sy}`, `L${x + 52 * sx},${y + 42 * sy}`, `L${x + 60 * sx},${y + 56 * sy}`,
        `L${x + 76 * sx},${y + 56 * sy}`, `Q${x + 80 * sx},${y + 52 * sy} ${x + 76 * sx},${y + 48 * sy}`, `L${x + 52 * sx},${y + 26 * sy}`, `Z`,
      ].join(' ');
    }
    case 'pawn': {
      const sx = w / 60; const sy = h / 80;
      return [
        `M${x + 30 * sx},${y + 4 * sy}`, `a${10 * sx},${10 * sy} 0 0 1 0,${20 * sy}`, `a${10 * sx},${10 * sy} 0 0 1 0,${-20 * sy}`, `Z`,
        `M${x + 22 * sx},${y + 24 * sy}`, `L${x + 16 * sx},${y + 50 * sy}`, `L${x + 44 * sx},${y + 50 * sy}`, `L${x + 38 * sx},${y + 24 * sy}`, `Z`,
        `M${x + 10 * sx},${y + 52 * sy}`, `L${x + 8 * sx},${y + 70 * sy}`, `Q${x + 8 * sx},${y + 76 * sy} ${x + 14 * sx},${y + 76 * sy}`,
        `L${x + 46 * sx},${y + 76 * sy}`, `Q${x + 52 * sx},${y + 76 * sy} ${x + 52 * sx},${y + 70 * sy}`, `L${x + 50 * sx},${y + 52 * sy}`, `Z`,
      ].join(' ');
    }
    case 'dice': {
      const sx = w / 80; const sy = h / 80;
      const r = 6 * Math.min(sx, sy); const dotR = 4 * Math.min(sx, sy);
      const rn = r / Math.min(sx, sy);
      const rect = `M${x + rn * sx},${y} h${(80 - 2 * rn) * sx} a${r},${r} 0 0 1 ${r},${r} v${(80 - 2 * rn) * sy} a${r},${r} 0 0 1 ${-r},${r} h${-(80 - 2 * rn) * sx} a${r},${r} 0 0 1 ${-r},${-r} v${-(80 - 2 * rn) * sy} a${r},${r} 0 0 1 ${r},${-r} Z`;
      const dot = (dx: number, dy: number) =>
        `M${x + dx * sx + dotR},${y + dy * sy} a${dotR},${dotR} 0 1 0 ${-dotR * 2},0 a${dotR},${dotR} 0 1 0 ${dotR * 2},0`;
      return `${rect} ${dot(20, 20)} ${dot(60, 20)} ${dot(40, 40)} ${dot(20, 60)} ${dot(60, 60)}`;
    }
    case 'token': {
      const rx = w / 2; const ry = h * 0.25;
      const topY = y + h * 0.3; const botY = y + h * 0.55;
      return [
        `M${cx - rx},${topY}`, `L${cx - rx},${botY}`, `a${rx},${ry} 0 0 0 ${rx * 2},0`,
        `L${cx + rx},${topY}`, `a${rx},${ry} 0 0 0 ${-rx * 2},0`, `Z`,
        `M${cx - rx},${topY}`, `a${rx},${ry} 0 0 1 ${rx * 2},0`, `a${rx},${ry} 0 0 1 ${-rx * 2},0`, `Z`,
      ].join(' ');
    }
    case 'card': {
      const rad = Math.min(w, h) * 0.08;
      const cw = w * 0.85; const ch = h;
      const ox = x + (w - cw) / 2;
      return [
        `M${ox + rad},${y}`, `h${cw - 2 * rad}`, `a${rad},${rad} 0 0 1 ${rad},${rad}`, `v${ch - 2 * rad}`,
        `a${rad},${rad} 0 0 1 ${-rad},${rad}`, `h${-(cw - 2 * rad)}`, `a${rad},${rad} 0 0 1 ${-rad},${-rad}`,
        `v${-(ch - 2 * rad)}`, `a${rad},${rad} 0 0 1 ${rad},${-rad}`, `Z`,
        `M${ox + cw * 0.15},${y + ch * 0.15}`, `h${cw * 0.7}`, `v${ch * 0.5}`, `h${-cw * 0.7}`, `Z`,
      ].join(' ');
    }
    default:
      return '';
  }
}

function CanvasShapeSvg({ el }: { el: CanvasElement }) {
  const { x, y, width: w, height: h, shape, fill, stroke, strokeWidth } = el;
  const f = fill ?? 'rgba(161,48,107,0.5)';
  const s = stroke ?? 'rgba(255,255,255,0.3)';
  const sw = strokeWidth ?? 2;

  switch (shape) {
    case 'circle':
      return (
        <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2 - sw / 2} ry={h / 2 - sw / 2}
          fill={f} stroke={s} strokeWidth={sw} />
      );
    case 'rectangle':
      return (
        <rect x={x + sw / 2} y={y + sw / 2} width={w - sw} height={h - sw} rx={4}
          fill={f} stroke={s} strokeWidth={sw} />
      );
    case 'triangle':
    case 'diamond':
    case 'star':
    case 'hexagon':
    case 'flag':
    case 'crown':
      return (
        <polygon points={canvasShapePoints(shape!, x, y, w, h)}
          fill={f} stroke={s} strokeWidth={sw} strokeLinejoin="round" />
      );
    case 'cube': {
      const sx = w / 80; const sy = h / 80;
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
        <path d={canvasGameShapePath(shape!, x, y, w, h)}
          fill={f} stroke={s} strokeWidth={sw} strokeLinejoin="round" fillRule="evenodd" />
      );
    default:
      return (
        <rect x={x} y={y} width={w} height={h} rx={4}
          fill={f} stroke={s} strokeWidth={sw} />
      );
  }
}

function CanvasElementSvg({ el }: { el: CanvasElement }) {
  const transform = el.rotation
    ? `rotate(${el.rotation} ${el.x + el.width / 2} ${el.y + el.height / 2})`
    : undefined;

  return (
    <g transform={transform} opacity={el.opacity}>
      {el.type === 'shape' && <CanvasShapeSvg el={el} />}
      {el.type === 'line' && (
        <line
          x1={el.x}
          y1={el.y}
          x2={el.x + el.width}
          y2={el.y + el.height}
          stroke={el.stroke ?? 'rgba(255,255,255,0.6)'}
          strokeWidth={el.strokeWidth ?? 2}
          strokeLinecap="round"
          strokeDasharray={el.lineDash?.join(' ')}
        />
      )}
      {el.type === 'text' && (
        <foreignObject x={el.x} y={el.y} width={el.width} height={el.height}>
          <div
            style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center',
              justifyContent: el.textAlign === 'left' ? 'flex-start' : el.textAlign === 'right' ? 'flex-end' : 'center',
              fontSize: el.fontSize ?? 16, fontWeight: el.fontWeight ?? 600,
              color: el.textColor ?? 'rgba(255,255,255,0.9)',
              textAlign: el.textAlign ?? 'center',
              fontFamily: "'Inter', system-ui, sans-serif",
              lineHeight: 1.3, padding: '4px 8px',
              overflow: 'hidden', wordBreak: 'break-word',
            }}
          >
            {el.text ?? 'Text'}
          </div>
        </foreignObject>
      )}
      {el.type === 'image' && el.imageUrl && (
        <image href={el.imageUrl} x={el.x} y={el.y} width={el.width} height={el.height}
          preserveAspectRatio="xMidYMid slice" />
      )}
      {el.type === 'path' && el.pathData && (
        <g>
          <path
            d={el.pathData}
            fill={el.fill ?? 'rgba(100, 180, 255, 0.15)'}
            stroke={el.stroke ?? 'rgba(100, 180, 255, 0.7)'}
            strokeWidth={el.strokeWidth ?? 1.5}
            strokeLinejoin="round"
          />
          {el.label && (
            <text
              x={el.x + el.width / 2}
              y={el.y + el.height / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill={el.textColor ?? 'rgba(255,255,255,0.9)'}
              fontSize={Math.min(el.width, el.height) * 0.15}
              fontFamily="'Inter', system-ui, sans-serif"
              fontWeight={600}
              style={{ pointerEvents: 'none' }}
            >
              {el.label}
            </text>
          )}
        </g>
      )}
    </g>
  );
}

function CanvasView({ config }: { config: BoardViewConfig }) {
  const elements = [...(config.canvas_elements ?? [])].sort((a, b) => a.zIndex - b.zIndex);
  const w = config.canvas_width ?? 800;
  const h = config.canvas_height ?? 600;
  const [hovId, setHovId] = useState<string | null>(null);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto max-h-[460px]">
      {elements.map((el) => (
        <g
          key={el.id}
          onMouseEnter={() => el.label && setHovId(el.id)}
          onMouseLeave={() => setHovId((p) => (p === el.id ? null : p))}
          style={{ cursor: el.label ? 'pointer' : 'default' }}
        >
          <CanvasElementSvg el={el} />
        </g>
      ))}
      {hovId && (() => {
        const el = elements.find((e) => e.id === hovId);
        if (!el?.label) return null;
        const tx = el.x + el.width / 2;
        const ty = el.y - 8;
        const tw = Math.max(el.label.length * 6.5 + 20, 60);
        return (
          <g style={{ pointerEvents: 'none' }}>
            <rect x={tx - tw / 2} y={ty - 26} width={tw} height={22} rx={6}
              fill="rgba(10,10,20,0.95)" stroke="rgba(161,48,107,0.5)" strokeWidth={1} />
            <polygon points={`${tx - 4},${ty - 4} ${tx + 4},${ty - 4} ${tx},${ty + 1}`}
              fill="rgba(10,10,20,0.95)" />
            <text x={tx} y={ty - 12} textAnchor="middle" fill="rgba(255,255,255,0.85)"
              fontSize={10} fontFamily="'Inter', system-ui, sans-serif" fontWeight={500}>
              {el.label}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

// ─── Board View Container ───────────────────────────────────────────────────

export function BoardView({ config, className }: BoardViewProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const hasCanvasElements = config.canvas_elements && config.canvas_elements.length > 0;

  return (
    <div
      className={`rounded-2xl border border-white/[0.06] overflow-hidden ${className ?? ''}`}
      style={{
        background: 'linear-gradient(145deg, rgba(18,18,30,0.95) 0%, rgba(10,10,20,0.98) 100%)',
      }}
    >
      {config.title && (
        <div className="px-4 py-2.5 border-b border-white/[0.04]">
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.12em]">
            {config.title}
          </p>
        </div>
      )}
      <div className="p-4">
        {config.type === 'hex_grid' && (
          <HexGrid config={config} hovered={hovered} setHovered={setHovered} />
        )}
        {config.type === 'rect_grid' && (
          <RectGrid config={config} hovered={hovered} setHovered={setHovered} />
        )}
        {config.type === 'row_layout' && (
          <RowLayout config={config} hovered={hovered} setHovered={setHovered} />
        )}
        {config.type === 'custom' && hasCanvasElements && (
          <CanvasView config={config} />
        )}
        {config.type === 'custom' && !hasCanvasElements && (
          <RectGrid config={config} hovered={hovered} setHovered={setHovered} />
        )}
      </div>
    </div>
  );
}
