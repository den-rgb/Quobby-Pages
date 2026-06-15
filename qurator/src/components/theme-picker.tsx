'use client';

import { THEMES } from '@/lib/themes';
import { Check, Palette } from 'lucide-react';
import { useTheme } from './theme-provider';

export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      {!compact && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <Palette className="w-3.5 h-3.5 text-accent" />
          <h2 className="text-xs font-semibold text-foreground-faint uppercase tracking-wider">
            Appearance
          </h2>
        </div>
      )}
      <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {THEMES.map((option) => {
          const selected = theme === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setTheme(option.id)}
              aria-label={option.name}
              aria-pressed={selected}
              className={`text-left rounded-2xl border p-2.5 transition-all ${selected
                  ? 'border-accent bg-accent/10 ring-1 ring-accent/40'
                  : 'border-border bg-card hover:bg-card-hover hover:border-accent/20'
                }`}
            >
              <div
                className="relative h-12 rounded-xl overflow-hidden mb-2 border border-black/10"
                style={{ background: option.background }}
              >
                <div
                  className="absolute inset-x-2 bottom-1.5 h-5 rounded-md"
                  style={{ background: option.card }}
                />
                <span
                  className="absolute top-1.5 right-6 w-3.5 h-3.5 rounded-full"
                  style={{ background: option.secondary }}
                />
                <span
                  className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full"
                  style={{ background: option.accent }}
                />
                {selected && (
                  <span className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-black" />
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-foreground leading-tight">
                {option.name}
              </p>
              {!compact && (
                <p className="text-[10px] text-foreground-faint mt-0.5 leading-snug">
                  {option.description}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
