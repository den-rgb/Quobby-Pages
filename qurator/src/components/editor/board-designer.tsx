'use client';

import { BoardView } from '@/components/board-view';
import type {
  BoardCell,
  BoardPiece,
  BoardType,
  BoardViewConfig,
} from '@/lib/types';
import {
  ChevronDown,
  ChevronRight,
  Circle,
  Diamond,
  Grid3X3,
  Hexagon,
  Pencil,
  Plus,
  Square,
  Star,
  Trash2,
  Triangle,
} from 'lucide-react';
import { useCallback, useState } from 'react';

const PRESET_COLORS = [
  { label: 'Red', value: 'rgba(180,60,60,0.22)' },
  { label: 'Orange', value: 'rgba(200,120,40,0.22)' },
  { label: 'Yellow', value: 'rgba(180,160,60,0.22)' },
  { label: 'Green', value: 'rgba(70,140,70,0.22)' },
  { label: 'Teal', value: 'rgba(60,160,140,0.22)' },
  { label: 'Blue', value: 'rgba(60,120,200,0.22)' },
  { label: 'Purple', value: 'rgba(130,80,180,0.22)' },
  { label: 'Pink', value: 'rgba(180,80,140,0.22)' },
  { label: 'Brown', value: 'rgba(140,100,60,0.22)' },
  { label: 'Grey', value: 'rgba(120,120,140,0.22)' },
  { label: 'Light', value: 'rgba(200,200,200,0.15)' },
  { label: 'Dark', value: 'rgba(255,255,255,0.04)' },
];

const PIECE_COLORS = [
  { label: 'Red', value: 'rgba(220,60,60,0.8)' },
  { label: 'Blue', value: 'rgba(60,140,220,0.8)' },
  { label: 'Green', value: 'rgba(60,180,80,0.8)' },
  { label: 'Yellow', value: 'rgba(220,200,40,0.8)' },
  { label: 'Orange', value: 'rgba(220,140,40,0.8)' },
  { label: 'Purple', value: 'rgba(160,80,220,0.8)' },
  { label: 'White', value: 'rgba(255,255,255,0.7)' },
  { label: 'Black', value: 'rgba(40,40,40,0.8)' },
];

const SHAPES: { value: BoardPiece['shape']; label: string; icon: React.ElementType }[] = [
  { value: 'circle', label: 'Circle', icon: Circle },
  { value: 'triangle', label: 'Triangle', icon: Triangle },
  { value: 'square', label: 'Square', icon: Square },
  { value: 'diamond', label: 'Diamond', icon: Diamond },
  { value: 'star', label: 'Star', icon: Star },
];

function ColorPicker({
  value,
  onChange,
  presets,
}: {
  value: string;
  onChange: (c: string) => void;
  presets: typeof PRESET_COLORS;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {presets.map((c) => (
        <button
          key={c.value}
          onClick={() => onChange(c.value)}
          title={c.label}
          className={`w-5 h-5 rounded-md border transition-all ${value === c.value
              ? 'border-accent ring-1 ring-accent/40 scale-110'
              : 'border-white/10 hover:border-white/30'
            }`}
          style={{ background: c.value }}
        />
      ))}
    </div>
  );
}

function CellEditor({
  cell,
  index,
  onUpdate,
  onRemove,
  pieces,
  onAddPiece,
  onUpdatePiece,
  onRemovePiece,
}: {
  cell: BoardCell;
  index: number;
  onUpdate: (updates: Partial<BoardCell>) => void;
  onRemove: () => void;
  pieces: BoardPiece[];
  onAddPiece: (cellId: string) => void;
  onUpdatePiece: (pieceId: string, updates: Partial<BoardPiece>) => void;
  onRemovePiece: (pieceId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Cell header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.02] transition-colors"
      >
        <div
          className="w-4 h-4 rounded border border-white/20 shrink-0"
          style={{ background: cell.color }}
        />
        <span className="text-xs text-foreground flex-1 text-left truncate">
          {cell.label || cell.icon || `Cell ${index + 1}`}
        </span>
        {pieces.length > 0 && (
          <span className="text-[10px] text-foreground-faint">
            {pieces.length} piece{pieces.length !== 1 ? 's' : ''}
          </span>
        )}
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-foreground-faint" />
        ) : (
          <ChevronRight className="w-3 h-3 text-foreground-faint" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-border pt-2.5">
          {/* Cell properties */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-foreground-faint mb-0.5">
                Label
              </label>
              <input
                type="text"
                value={cell.label ?? ''}
                onChange={(e) => onUpdate({ label: e.target.value || undefined })}
                className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30"
                placeholder="e.g. 10"
              />
            </div>
            <div>
              <label className="block text-[10px] text-foreground-faint mb-0.5">
                Icon / Abbrev.
              </label>
              <input
                type="text"
                value={cell.icon ?? ''}
                onChange={(e) => onUpdate({ icon: e.target.value || undefined })}
                className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30"
                placeholder="e.g. GRN"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-foreground-faint mb-0.5">
              Tooltip
            </label>
            <input
              type="text"
              value={cell.tooltip ?? ''}
              onChange={(e) =>
                onUpdate({ tooltip: e.target.value || undefined })
              }
              className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30"
              placeholder="Shown on hover"
            />
          </div>

          <div>
            <label className="block text-[10px] text-foreground-faint mb-1">
              Color
            </label>
            <ColorPicker
              value={cell.color}
              onChange={(c) => onUpdate({ color: c })}
              presets={PRESET_COLORS}
            />
          </div>

          {/* Pieces on this cell */}
          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-medium text-foreground-faint uppercase tracking-wider">
                Pieces on this cell
              </span>
              <button
                onClick={() => onAddPiece(cell.id)}
                className="flex items-center gap-0.5 text-[10px] text-accent hover:text-accent-light transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>

            {pieces.length === 0 ? (
              <p className="text-[10px] text-foreground-faint text-center py-1">
                No pieces
              </p>
            ) : (
              <div className="space-y-2">
                {pieces.map((piece) => (
                  <PieceEditor
                    key={piece.id}
                    piece={piece}
                    onUpdate={(u) => onUpdatePiece(piece.id, u)}
                    onRemove={() => onRemovePiece(piece.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onRemove}
            className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors pt-1"
          >
            <Trash2 className="w-3 h-3" />
            Remove cell
          </button>
        </div>
      )}
    </div>
  );
}

function PieceEditor({
  piece,
  onUpdate,
  onRemove,
}: {
  piece: BoardPiece;
  onUpdate: (updates: Partial<BoardPiece>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="p-2 bg-white/[0.02] rounded-lg border border-border/50 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {SHAPES.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.value}
                onClick={() => onUpdate({ shape: s.value })}
                title={s.label}
                className={`p-1 rounded transition-all ${piece.shape === s.value
                    ? 'bg-accent/20 text-accent'
                    : 'text-foreground-faint hover:text-foreground'
                  }`}
              >
                <Icon className="w-3 h-3" />
              </button>
            );
          })}
        </div>
        <button
          onClick={onRemove}
          className="text-foreground-faint hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      <div>
        <label className="block text-[10px] text-foreground-faint mb-0.5">
          Tooltip
        </label>
        <input
          type="text"
          value={piece.tooltip ?? ''}
          onChange={(e) => onUpdate({ tooltip: e.target.value || undefined })}
          className="w-full px-2 py-1 bg-card border border-border rounded-md text-[11px] text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30"
          placeholder="e.g. Red Settlement"
        />
      </div>

      <div>
        <label className="block text-[10px] text-foreground-faint mb-1">
          Color
        </label>
        <ColorPicker
          value={piece.color}
          onChange={(c) => onUpdate({ color: c })}
          presets={PIECE_COLORS}
        />
      </div>
    </div>
  );
}

interface BoardDesignerProps {
  config: BoardViewConfig;
  onChange: (config: BoardViewConfig) => void;
  onRemove: () => void;
}

export function BoardDesigner({ config, onChange, onRemove }: BoardDesignerProps) {
  const [activeSection, setActiveSection] = useState<'cells' | 'preview'>('cells');

  const updateConfig = useCallback(
    (patch: Partial<BoardViewConfig>) => {
      onChange({ ...config, ...patch });
    },
    [config, onChange]
  );

  const addCell = useCallback(() => {
    const id = `cell-${Date.now()}`;
    const newCell: BoardCell = {
      id,
      label: '',
      color: PRESET_COLORS[0].value,
      icon: '',
      tooltip: '',
    };
    onChange({ ...config, cells: [...config.cells, newCell] });
  }, [config, onChange]);

  const updateCell = useCallback(
    (cellId: string, updates: Partial<BoardCell>) => {
      onChange({
        ...config,
        cells: config.cells.map((c) =>
          c.id === cellId ? { ...c, ...updates } : c
        ),
      });
    },
    [config, onChange]
  );

  const removeCell = useCallback(
    (cellId: string) => {
      onChange({
        ...config,
        cells: config.cells.filter((c) => c.id !== cellId),
        pieces: config.pieces.filter((p) => p.cell_id !== cellId),
      });
    },
    [config, onChange]
  );

  const addPiece = useCallback(
    (cellId: string) => {
      const piece: BoardPiece = {
        id: `piece-${Date.now()}`,
        cell_id: cellId,
        label: '',
        color: PIECE_COLORS[0].value,
        shape: 'circle',
        tooltip: '',
      };
      onChange({ ...config, pieces: [...config.pieces, piece] });
    },
    [config, onChange]
  );

  const updatePiece = useCallback(
    (pieceId: string, updates: Partial<BoardPiece>) => {
      onChange({
        ...config,
        pieces: config.pieces.map((p) =>
          p.id === pieceId ? { ...p, ...updates } : p
        ),
      });
    },
    [config, onChange]
  );

  const removePiece = useCallback(
    (pieceId: string) => {
      onChange({
        ...config,
        pieces: config.pieces.filter((p) => p.id !== pieceId),
      });
    },
    [config, onChange]
  );

  const autoFillGrid = useCallback(() => {
    const total = config.cols * config.rows;
    const existing = config.cells.length;
    if (existing >= total) return;

    const newCells: BoardCell[] = [];
    for (let i = existing; i < total; i++) {
      newCells.push({
        id: `cell-${Date.now()}-${i}`,
        label: '',
        color: PRESET_COLORS[i % PRESET_COLORS.length].value,
        icon: '',
        tooltip: '',
      });
    }
    onChange({ ...config, cells: [...config.cells, ...newCells] });
  }, [config, onChange]);

  const expectedCells =
    config.type === 'hex_grid' && config.rows === 5
      ? 19
      : config.cols * config.rows;

  return (
    <div className="space-y-3">
      {/* Board settings */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-foreground-faint mb-0.5">
            Type
          </label>
          <select
            value={config.type}
            onChange={(e) =>
              updateConfig({ type: e.target.value as BoardType })
            }
            className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-accent/30"
          >
            <option value="hex_grid">Hex Grid</option>
            <option value="rect_grid">Rect Grid</option>
            <option value="row_layout">Row Layout</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div className="w-14">
          <label className="block text-[10px] font-medium text-foreground-faint mb-0.5">
            Cols
          </label>
          <input
            type="number"
            min={1}
            max={12}
            value={config.cols}
            onChange={(e) =>
              updateConfig({ cols: parseInt(e.target.value) || 1 })
            }
            className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-accent/30"
          />
        </div>
        <div className="w-14">
          <label className="block text-[10px] font-medium text-foreground-faint mb-0.5">
            Rows
          </label>
          <input
            type="number"
            min={1}
            max={12}
            value={config.rows}
            onChange={(e) =>
              updateConfig({ rows: parseInt(e.target.value) || 1 })
            }
            className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-accent/30"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-medium text-foreground-faint mb-0.5">
          Board Title
        </label>
        <input
          type="text"
          value={config.title ?? ''}
          onChange={(e) =>
            updateConfig({ title: e.target.value || undefined })
          }
          className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30"
          placeholder="e.g. Game Board"
        />
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 bg-white/[0.02] rounded-lg p-0.5">
        <button
          onClick={() => setActiveSection('cells')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all ${activeSection === 'cells'
              ? 'bg-accent text-black'
              : 'text-foreground-muted hover:text-foreground'
            }`}
        >
          <Pencil className="w-3 h-3" />
          Edit Cells ({config.cells.length})
        </button>
        <button
          onClick={() => setActiveSection('preview')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all ${activeSection === 'preview'
              ? 'bg-accent text-black'
              : 'text-foreground-muted hover:text-foreground'
            }`}
        >
          <Hexagon className="w-3 h-3" />
          Preview
        </button>
      </div>

      {activeSection === 'cells' && (
        <div className="space-y-2">
          {/* Quick actions */}
          <div className="flex gap-2">
            <button
              onClick={addCell}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-card border border-border rounded-lg text-[11px] text-foreground hover:border-accent/30 transition-all"
            >
              <Plus className="w-3 h-3 text-accent" />
              Add Cell
            </button>
            {config.cells.length < expectedCells && (
              <button
                onClick={autoFillGrid}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-card border border-border rounded-lg text-[11px] text-foreground hover:border-accent/30 transition-all"
              >
                <Grid3X3 className="w-3 h-3 text-accent" />
                Fill Grid ({expectedCells - config.cells.length} more)
              </button>
            )}
          </div>

          {config.cells.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-border rounded-xl">
              <Hexagon className="w-6 h-6 text-foreground-faint mx-auto mb-2" />
              <p className="text-xs text-foreground-muted mb-1">
                No cells yet
              </p>
              <p className="text-[10px] text-foreground-faint mb-3">
                Add cells to build your board layout. Each cell is a tile, card
                slot, or grid space.
              </p>
              <button
                onClick={autoFillGrid}
                className="px-3 py-1.5 bg-accent text-black text-[11px] font-semibold rounded-lg hover:bg-accent-light transition-colors"
              >
                Auto-fill {expectedCells} cells
              </button>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-0.5">
              {config.cells.map((cell, i) => (
                <CellEditor
                  key={cell.id}
                  cell={cell}
                  index={i}
                  onUpdate={(u) => updateCell(cell.id, u)}
                  onRemove={() => removeCell(cell.id)}
                  pieces={config.pieces.filter(
                    (p) => p.cell_id === cell.id
                  )}
                  onAddPiece={addPiece}
                  onUpdatePiece={updatePiece}
                  onRemovePiece={removePiece}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'preview' && (
        <div>
          {config.cells.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border rounded-xl">
              <p className="text-xs text-foreground-muted">
                Add cells first to see a preview.
              </p>
            </div>
          ) : (
            <BoardView config={config} />
          )}
        </div>
      )}

      {/* Remove board */}
      <button
        onClick={onRemove}
        className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors"
      >
        <Trash2 className="w-3 h-3" />
        Remove Board View
      </button>
    </div>
  );
}
