'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Brain, Calculator, Check, Flame, Lightbulb } from 'lucide-react';
import { TrackedLink } from '@/components/analytics/tracked-link';
import { useAuth } from '@/lib/auth';
import { GAME_KEYS, type GameKey, type GameProfileStatsResponse } from '@/lib/games/types';

const modes = [
  {
    game: 'letter-ledger',
    href: '/games/letter-ledger',
    name: 'Letter Ledger',
    description: 'Find the shared five-letter word.',
    detail: '8 guesses',
    icon: Brain,
    color: 'rgba(161, 48, 107, 0.18)',
  },
  {
    game: 'number-trail',
    href: '/games/number-trail',
    name: 'Number Trail',
    description: 'Reach the daily target with arithmetic.',
    detail: 'Untimed',
    icon: Calculator,
    color: 'rgba(90, 200, 250, 0.14)',
  },
  {
    game: 'riddle-master',
    href: '/games/riddle-master',
    name: 'Riddle Master',
    description: 'Solve the daily riddle.',
    detail: '5 guesses',
    icon: Lightbulb,
    color: 'rgba(255, 214, 10, 0.12)',
  },
] as const;
const NO_COMPLETED_GAMES: ReadonlySet<GameKey> = new Set();

export function GamesHub() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const [completion, setCompletion] = useState<{ userId: string; games: Set<GameKey> } | null>(null);
  const completedGames = completion && completion.userId === userId ? completion.games : NO_COMPLETED_GAMES;

  useEffect(() => {
    let active = true;

    if (authLoading) return () => { active = false; };
    if (!userId) return () => { active = false; };

    fetch('/api/games/stats', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        return await response.json() as GameProfileStatsResponse;
      })
      .then((stats) => {
        if (!active || !stats || !Array.isArray(stats.completedToday)) return;
        setCompletion({
          userId,
          games: new Set(stats.completedToday.filter((game): game is GameKey => typeof game === 'string' && GAME_KEYS.some((knownGame) => knownGame === game))),
        });
      })
      .catch(() => {
        // Guests and temporary API failures have no profile markers to show.
      });

    return () => { active = false; };
  }, [authLoading, userId]);

  return (
    <div className="px-5 sm:px-6 py-10 sm:py-16">
      <div className="max-w-[1050px] mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-4">
            Qurator <span className="text-accent">Games</span>
          </h1>
          <p className="text-foreground-muted text-base sm:text-lg leading-relaxed">
            Three daily puzzles, shared by everyone.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 sm:gap-5">
          {modes.map(({ game, href, name, description, detail, icon: Icon, color }) => (
            <TrackedLink
              href={href}
              eventName="game_selected"
              eventProperties={{ game: href.slice(href.lastIndexOf('/') + 1), placement: 'games_hub' }}
              key={href}
              className="group min-h-[260px] p-6 bg-white/[0.03] border border-white/[0.07] rounded-3xl hover:bg-white/[0.055] hover:border-accent/30 transition-all flex flex-col"
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6" style={{ background: color }}>
                <Icon className="w-6 h-6 text-foreground" />
              </div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="text-xl font-bold text-foreground">{name}</h2>
                {completedGames.has(game) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 border border-green-400/20 px-2 py-1 text-[10px] font-semibold text-green-200 whitespace-nowrap">
                    <Check className="w-3 h-3" aria-hidden="true" /> Played today
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground-muted leading-relaxed">{description}</p>
              <div className="mt-auto pt-6 flex items-center justify-between gap-4">
                <span className="text-[11px] text-foreground-faint">{detail}</span>
                <span className="flex items-center gap-1 text-sm font-semibold text-accent group-hover:gap-2 transition-all">
                  Play <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </TrackedLink>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <TrackedLink
            href="/blog/qurator-games-hub"
            eventName="games_article_opened"
            eventProperties={{ placement: 'games_hub' }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground-muted hover:text-foreground transition-colors"
          >
            Game guide <ArrowRight className="w-4 h-4" />
          </TrackedLink>
        </div>

        <div className="mt-8 p-4 sm:p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4 text-orange-300" />
          </div>
          <p className="text-sm text-foreground-muted leading-relaxed">
            Finish a game for <strong className="text-foreground">25 XP</strong> and Games streak progress. Sign in to save your results.
          </p>
        </div>
      </div>
    </div>
  );
}
