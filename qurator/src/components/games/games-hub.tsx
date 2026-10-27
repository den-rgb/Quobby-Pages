import { ArrowRight, Brain, Calculator, Flame, Lightbulb } from 'lucide-react';
import { TrackedLink } from '@/components/analytics/tracked-link';

const modes = [
  {
    href: '/games/letter-ledger',
    name: 'Letter Ledger',
    eyebrow: 'WORD COUNTS',
    description: 'Find the five-letter word from green, yellow, and red counts.',
    detail: '8 guesses · no repeated letters',
    icon: Brain,
    color: 'rgba(161, 48, 107, 0.18)',
  },
  {
    href: '/games/number-trail',
    name: 'Number Trail',
    eyebrow: 'NUMBER TARGET',
    description: 'Join the day’s five numbers with arithmetic to reach the target.',
    detail: 'Untimed · give up whenever you like',
    icon: Calculator,
    color: 'rgba(90, 200, 250, 0.14)',
  },
  {
    href: '/games/riddle-master',
    name: 'Riddle Master',
    eyebrow: 'OLD-TIME RIDDLES',
    description: 'Unravel a traditional-style riddle before your guesses run out.',
    detail: '5 guesses · answer revealed at the end',
    icon: Lightbulb,
    color: 'rgba(255, 214, 10, 0.12)',
  },
];

export function GamesHub() {
  return (
    <div className="px-5 sm:px-6 py-10 sm:py-16">
      <div className="max-w-[1050px] mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent-glow border border-accent/20 rounded-full text-xs text-accent font-semibold mb-5">
            <Flame className="w-3.5 h-3.5" />
            A fresh challenge every day
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-4">
            Qurator <span className="text-accent">Games</span>
          </h1>
          <p className="text-foreground-muted text-base sm:text-lg leading-relaxed">
            Pick a word, number, or riddle challenge. Every player gets the same game today, and one finished game is enough to keep your Games streak moving.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 sm:gap-5">
          {modes.map(({ href, name, eyebrow, description, detail, icon: Icon, color }) => (
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
              <p className="text-[10px] tracking-[0.16em] font-bold text-foreground-faint mb-2">{eyebrow}</p>
              <h2 className="text-xl font-bold text-foreground mb-2">{name}</h2>
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

        <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <div>
            <h2 className="font-semibold text-foreground">New to the daily games?</h2>
            <p className="text-sm text-foreground-muted mt-1">Read how the shared word, number, and riddle challenges work.</p>
          </div>
          <TrackedLink
            href="/blog/qurator-games-hub"
            eventName="games_article_opened"
            eventProperties={{ placement: 'games_hub' }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.1] text-sm font-semibold text-foreground hover:bg-white/[0.06] transition-colors shrink-0"
          >
            Read the guide <ArrowRight className="w-4 h-4" />
          </TrackedLink>
        </div>

        <div className="mt-8 p-4 sm:p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4 text-orange-300" />
          </div>
          <p className="text-sm text-foreground-muted leading-relaxed">
            Finish any one daily game to earn <strong className="text-foreground">25 XP</strong> and count toward your separate Games streak. Sign in after a round to save progress to your Quobby profile.
          </p>
        </div>
        <p className="text-center text-[11px] text-foreground-faint mt-5">Challenges change together at 00:00 UTC.</p>
      </div>
    </div>
  );
}
