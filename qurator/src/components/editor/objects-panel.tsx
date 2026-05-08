'use client';

import { useEditorStore } from '@/lib/store';
import type { ComponentType } from '@/lib/types';
import {
  Anchor, BookOpen, Box, Bug, CircleDot, Coins, Compass, Crown, Diamond,
  Dices, Flag, Flame, Gamepad2, Gem, Ghost, Heart, Hexagon, Key,
  Lock, Map, Medal, Mountain, Plus, Scroll, Shield, Skull,
  Sparkles, Square, Star, Sword, Target, Trash2, TreePine, Trophy, Zap,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

const BOARD_GAME_TYPES: { value: ComponentType; label: string }[] = [
  { value: 'card', label: 'Card' },
  { value: 'token', label: 'Token' },
  { value: 'die', label: 'Die' },
  { value: 'board', label: 'Board' },
  { value: 'meeple', label: 'Meeple' },
  { value: 'tile', label: 'Tile' },
  { value: 'marker', label: 'Marker' },
  { value: 'other', label: 'Other' },
];

const GENERIC_TYPES: { value: ComponentType; label: string }[] = [
  { value: 'image', label: 'Image' },
  { value: 'diagram', label: 'Diagram' },
  { value: 'annotation', label: 'Annotation' },
  { value: 'label', label: 'Label' },
  { value: 'other', label: 'Other' },
];

const ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: 'sword', icon: Sword },
  { name: 'shield', icon: Shield },
  { name: 'heart', icon: Heart },
  { name: 'star', icon: Star },
  { name: 'crown', icon: Crown },
  { name: 'flag', icon: Flag },
  { name: 'gem', icon: Gem },
  { name: 'coins', icon: Coins },
  { name: 'zap', icon: Zap },
  { name: 'flame', icon: Flame },
  { name: 'target', icon: Target },
  { name: 'key', icon: Key },
  { name: 'lock', icon: Lock },
  { name: 'skull', icon: Skull },
  { name: 'ghost', icon: Ghost },
  { name: 'bug', icon: Bug },
  { name: 'treePine', icon: TreePine },
  { name: 'mountain', icon: Mountain },
  { name: 'anchor', icon: Anchor },
  { name: 'compass', icon: Compass },
  { name: 'map', icon: Map },
  { name: 'scroll', icon: Scroll },
  { name: 'bookOpen', icon: BookOpen },
  { name: 'dices', icon: Dices },
  { name: 'trophy', icon: Trophy },
  { name: 'medal', icon: Medal },
  { name: 'sparkles', icon: Sparkles },
  { name: 'diamond', icon: Diamond },
  { name: 'hexagon', icon: Hexagon },
  { name: 'square', icon: Square },
  { name: 'circleDot', icon: CircleDot },
];

const ICON_MAP = Object.fromEntries(ICON_OPTIONS.map((o) => [o.name, o.icon]));

export function ObjectsPanel() {
  const { objects, addObject, removeObject, tutorial, category } = useEditorStore();
  const isBoardGames = category?.slug === 'board-games';
  const componentTypes = isBoardGames ? BOARD_GAME_TYPES : GENERIC_TYPES;
  const [name, setName] = useState('');
  const [compType, setCompType] = useState<ComponentType>(componentTypes[0].value);
  const [imageUrl, setImageUrl] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [showIcons, setShowIcons] = useState(false);

  const handleAdd = () => {
    if (!name.trim()) return;
    addObject({
      tutorial_id: tutorial?.id ?? '',
      name: name.trim(),
      component_type: compType,
      image_url: imageUrl || null,
      properties_json: selectedIcon ? { icon: selectedIcon } : {},
    });
    setName('');
    setImageUrl('');
    setSelectedIcon(null);
  };

  return (
    <div className="p-5">
      <div className="flex items-center gap-2.5 mb-5">
        <Box className="w-5 h-5 text-accent" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {isBoardGames ? 'Game Components' : 'Tutorial Objects'}
          </h2>
          <p className="text-[10px] text-foreground-muted">
            {isBoardGames
              ? 'Catalog cards, tokens, dice, and other game pieces.'
              : 'Add images, diagrams, and labeled elements.'}
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
            placeholder="Component name"
            className="flex-1 px-2.5 py-2 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <select
            value={compType}
            onChange={(e) => setCompType(e.target.value as ComponentType)}
            className="px-2.5 py-2 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-accent/30"
          >
            {componentTypes.map((ct) => (
              <option key={ct.value} value={ct.value}>
                {ct.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Image URL (optional)"
            className="flex-1 px-2.5 py-2 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={() => setShowIcons((p) => !p)}
            className={`px-2.5 py-2 border rounded-lg text-xs transition-colors ${selectedIcon ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border bg-card text-foreground-muted hover:text-foreground'}`}
            title="Pick icon"
          >
            {selectedIcon && ICON_MAP[selectedIcon] ? (() => { const Ic = ICON_MAP[selectedIcon]; return <Ic className="w-3.5 h-3.5" />; })() : <Box className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleAdd}
            disabled={!name.trim()}
            className="flex items-center gap-1 px-4 py-2 bg-accent text-black text-xs font-semibold rounded-lg hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
        {showIcons && (
          <div className="grid grid-cols-8 gap-1 pt-1">
            <button
              onClick={() => { setSelectedIcon(null); setShowIcons(false); }}
              className={`p-1.5 rounded-lg transition-colors ${!selectedIcon ? 'bg-accent/15 text-accent' : 'text-foreground-faint hover:text-foreground hover:bg-white/5'}`}
              title="None"
            >
              <Box className="w-3.5 h-3.5 mx-auto" />
            </button>
            {ICON_OPTIONS.map(({ name: n, icon: Ic }) => (
              <button
                key={n}
                onClick={() => { setSelectedIcon(n); setShowIcons(false); }}
                className={`p-1.5 rounded-lg transition-colors ${selectedIcon === n ? 'bg-accent/15 text-accent' : 'text-foreground-faint hover:text-foreground hover:bg-white/5'}`}
                title={n}
              >
                <Ic className="w-3.5 h-3.5 mx-auto" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Object list */}
      {objects.length === 0 ? (
        <div className="text-center py-8">
          <Gamepad2 className="w-8 h-8 text-foreground-faint mx-auto mb-2" />
          <p className="text-xs text-foreground-muted">No components yet.</p>
          <p className="text-[10px] text-foreground-faint mt-0.5">
            Add cards, tokens, dice, boards, and other pieces.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {objects.map((obj) => (
            <div
              key={obj.id}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-card border border-border rounded-xl"
            >
              {obj.image_url ? (
                <img
                  src={obj.image_url}
                  alt={obj.name}
                  className="w-9 h-9 rounded-lg object-cover shrink-0"
                />
              ) : (() => {
                const iconName = (obj.properties_json as Record<string, unknown>)?.icon as string | undefined;
                const Ic = iconName && ICON_MAP[iconName] ? ICON_MAP[iconName] : Box;
                return (
                  <div className="w-9 h-9 rounded-lg bg-white/[0.03] flex items-center justify-center shrink-0">
                    <Ic className="w-3.5 h-3.5 text-foreground-faint" />
                  </div>
                );
              })()}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {obj.name}
                </p>
                <p className="text-[10px] text-foreground-faint capitalize">
                  {obj.component_type}
                </p>
              </div>
              <button
                onClick={() => removeObject(obj.id)}
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
