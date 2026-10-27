'use client';

import { LetterLedger } from '@/components/games/letter-ledger';
import { GameResult } from '@/components/games/game-result';
import { NumberTrail } from '@/components/games/number-trail';
import { RiddleMaster } from '@/components/games/riddle-master';
import { useAuth } from '@/lib/auth';
import type {
  GameKey,
  GuessFeedback,
  LetterMark,
  NumberChallengeData,
  NumberFeedback,
  PublicChallenge,
  RoundResult,
  RiddleChallengeData,
  RiddleFeedback,
  WordChallengeData,
  WordFeedback,
} from '@/lib/games/types';
import { track } from '@vercel/analytics';
import { ArrowLeft, Loader2, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'qurator-games:rounds:v1';

interface LocalRound {
  game: GameKey;
  challengeId: string;
  date: string;
  guesses: string[];
  giveUp: boolean;
  letterMarks?: Record<string, LetterMark>;
  result?: RoundResult;
}

interface ActiveResponse {
  ended: false;
  feedback: GuessFeedback;
  guessesRemaining: number | null;
  error?: string;
}

type RoundResponse = ActiveResponse | (RoundResult & { ended: true; error?: string });

function readRounds(): Record<string, LocalRound> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, LocalRound>;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeRound(round: LocalRound): void {
  try {
    const rounds = readRounds();
    rounds[round.challengeId] = round;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rounds));
  } catch {
    // The current round can still finish in memory if browser storage is unavailable.
  }
}

function titleFor(game: GameKey): string {
  if (game === 'letter-ledger') return 'Letter Ledger';
  if (game === 'number-trail') return 'Number Trail';
  return 'Riddle Master';
}

function descriptionFor(game: GameKey): string {
  if (game === 'letter-ledger') {
    return 'Guess today’s shared five-letter word. Every answer uses unique letters, and green, yellow, and red counts guide up to eight guesses.';
  }
  if (game === 'number-trail') {
    return 'Use each of today’s five numbers at most once with arithmetic and parentheses to reach the target. There is no timer.';
  }
  return 'Solve today’s classic-style riddle in up to five guesses. Qurator reveals the answer when the round ends.';
}

export function GamePlayer({ game }: { game: GameKey }) {
  const { user, loading: authLoading } = useAuth();
  const [challenge, setChallenge] = useState<PublicChallenge | null>(null);
  const [round, setRound] = useState<LocalRound | null>(null);
  const [feedback, setFeedback] = useState<GuessFeedback>([]);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<LocalRound | null>(null);
  const hydratedChallenge = useRef<string | null>(null);
  const claimedUser = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/games/daily?game=${encodeURIComponent(game)}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Today’s challenge could not be loaded.');
        return data as PublicChallenge;
      })
      .then((data) => {
        if (active) {
          track('game_opened', { game });
          setChallenge(data);
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Today’s challenge could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [game]);

  const sendRound = useCallback(async (record: LocalRound, rollback: LocalRound | null = null): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/games/round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game: record.game,
          challengeId: record.challengeId,
          guesses: record.guesses,
          giveUp: record.giveUp,
        }),
      });
      const data = await response.json() as RoundResponse;
      if (!response.ok) {
        const message = data.error ?? 'Your guess could not be checked.';
        setError(message);
        if (response.status < 500) {
          setPendingRequest(null);
          if (rollback) {
            writeRound(rollback);
            setRound(rollback);
          } else {
            setPendingRequest(null);
          }
          return false;
        }
        writeRound(record);
        setRound(record);
        setPendingRequest(record);
        return true;
      }

      setPendingRequest(null);
      if (data.ended) {
        if (!record.result) {
          track('game_finished', { game: record.game, outcome: data.outcome });
        }
        const saved = { ...record, result: data as RoundResult };
        writeRound(saved);
        setRound(saved);
        setFeedback(data.feedback);
        setResult(data as RoundResult);
      } else {
        const saved = { ...record, result: undefined };
        writeRound(saved);
        setRound(saved);
        setFeedback(data.feedback);
        setResult(null);
      }
      return true;
    } catch {
      setError('Could not reach Qurator. Retry this action when your connection is back.');
      writeRound(record);
      setRound(record);
      setPendingRequest(record);
      return true;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!challenge || authLoading || hydratedChallenge.current === challenge.challengeId) return;
    hydratedChallenge.current = challenge.challengeId;
    const saved = readRounds()[challenge.challengeId] ?? {
      game,
      challengeId: challenge.challengeId,
      date: challenge.date,
      guesses: [],
      giveUp: false,
    };
    if (saved.guesses.length > 0 || saved.giveUp || saved.result) {
      const restoreTimer = window.setTimeout(() => void sendRound(saved), 0);
      return () => {
        window.clearTimeout(restoreTimer);
        if (hydratedChallenge.current === challenge.challengeId) hydratedChallenge.current = null;
      };
    }
  }, [authLoading, challenge, game, sendRound]);

  const claimOtherPendingRounds = useCallback(async (skipChallengeId: string) => {
    const pending = Object.values(readRounds()).filter((candidate) =>
      candidate.challengeId !== skipChallengeId &&
      (candidate.result?.claimable || candidate.result?.rewardPending),
    );

    for (const candidate of pending) {
      if (candidate.game === game && candidate.result) {
        setRound(candidate);
        setFeedback(candidate.result.feedback);
        setResult(candidate.result);
      }
      try {
        const response = await fetch('/api/games/round', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            game: candidate.game,
            challengeId: candidate.challengeId,
            guesses: candidate.guesses,
            giveUp: candidate.giveUp,
          }),
        });
        if (!response.ok) continue;
        const data = await response.json() as RoundResponse;
        if (data.ended) {
          const saved = { ...candidate, result: data as RoundResult };
          writeRound(saved);
          if (candidate.game === game) {
            setRound(saved);
            setFeedback(data.feedback);
            setResult(data as RoundResult);
          }
        }
      } catch {
        // Leave the guest result in local storage so the claim can be retried later.
      }
    }
  }, [game]);

  useEffect(() => {
    if (!user || !challenge || authLoading || claimedUser.current === user.id) return;
    claimedUser.current = user.id;
    void claimOtherPendingRounds(challenge.challengeId);
  }, [authLoading, challenge, claimOtherPendingRounds, user]);

  const submitGuess = useCallback(async (guess: string): Promise<boolean> => {
    if (!challenge || result || busy) return false;
    const previous: LocalRound = round ?? {
      game,
      challengeId: challenge.challengeId,
      date: challenge.date,
      guesses: [],
      giveUp: false,
    };
    const next: LocalRound = {
      ...previous,
      guesses: [...previous.guesses, guess],
      giveUp: false,
      result: undefined,
    };
    writeRound(next);
    return sendRound(next, previous);
  }, [busy, challenge, game, result, round, sendRound]);

  const giveUp = useCallback(() => {
    if (!challenge || result || busy) return;
    const previous: LocalRound = round ?? {
      game,
      challengeId: challenge.challengeId,
      date: challenge.date,
      guesses: [],
      giveUp: false,
    };
    const next: LocalRound = { ...previous, giveUp: true, result: undefined };
    writeRound(next);
    void sendRound(next, previous);
  }, [busy, challenge, game, result, round, sendRound]);

  const retry = useCallback(() => {
    const retryRound = pendingRequest ?? round;
    if (retryRound) void sendRound(retryRound);
  }, [pendingRequest, round, sendRound]);

  const updateLetterMark = useCallback((letterKey: string, mark: LetterMark | null) => {
    if (!challenge) return;
    const currentRound: LocalRound = round ?? {
      game,
      challengeId: challenge.challengeId,
      date: challenge.date,
      guesses: [],
      giveUp: false,
    };
    const letterMarks = { ...currentRound.letterMarks };
    if (mark) {
      letterMarks[letterKey] = mark;
    } else {
      delete letterMarks[letterKey];
    }
    const updatedRound = { ...currentRound, letterMarks };
    writeRound(updatedRound);
    setRound(updatedRound);
  }, [challenge, game, round]);

  if (loading || authLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-5 py-12 text-center">
        <div className="max-w-2xl mb-7">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">{titleFor(game)}</h1>
          <p className="text-sm sm:text-base text-foreground-muted leading-relaxed mt-3">{descriptionFor(game)}</p>
        </div>
        <p className="flex items-center text-foreground-faint">
          <Loader2 className="w-5 h-5 animate-spin mr-3" />
          Loading today’s challenge…
        </p>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="px-5 py-16 text-center">
        <div className="max-w-md mx-auto p-7 rounded-2xl border border-white/[0.07] bg-white/[0.025]">
          <h1 className="text-xl font-bold text-foreground">Challenge unavailable</h1>
          <p className="text-sm text-foreground-muted mt-2">{error ?? 'Please try again in a moment.'}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-black text-sm font-semibold">
            <RotateCcw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 sm:px-6 py-8 sm:py-12">
      <div className="max-w-[760px] mx-auto">
        <Link href="/games" className="inline-flex items-center gap-2 text-sm text-foreground-faint hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> All games
        </Link>
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-accent mb-2">Daily challenge · {result?.date ?? challenge.date} UTC</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">{titleFor(game)}</h1>
          <p className="text-sm text-foreground-muted mt-2">{result ? 'Your completed challenge and profile stats.' : 'Same challenge for everyone today.'}</p>
        </div>

        <div className="p-4 sm:p-6 rounded-3xl border border-white/[0.07] bg-white/[0.025]">
          {result ? (
            <GameResult result={result} onRetry={retry} retrying={busy} />
          ) : game === 'letter-ledger' ? (
            <LetterLedger
              data={challenge.data as WordChallengeData}
              feedback={feedback as WordFeedback[]}
              letterMarks={round?.letterMarks ?? {}}
              busy={busy}
              error={error}
              onGuess={submitGuess}
              onGiveUp={giveUp}
              onLetterMarkChange={updateLetterMark}
            />
          ) : game === 'number-trail' ? (
            <NumberTrail
              data={challenge.data as NumberChallengeData}
              feedback={feedback as NumberFeedback[]}
              busy={busy}
              error={error}
              onGuess={submitGuess}
              onGiveUp={giveUp}
            />
          ) : (
            <RiddleMaster
              data={challenge.data as RiddleChallengeData}
              feedback={feedback as RiddleFeedback[]}
              busy={busy}
              error={error}
              onGuess={submitGuess}
              onGiveUp={giveUp}
            />
          )}
          {pendingRequest && !result && (
            <div className="mt-5 flex items-center justify-between gap-3 p-3 rounded-xl bg-orange-300/[0.06] border border-orange-200/15">
              <p className="text-xs text-foreground-muted">Your last action is saved on this device, waiting to be checked.</p>
              <button type="button" onClick={retry} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-black text-xs font-semibold disabled:opacity-40">
                <RotateCcw className="w-3.5 h-3.5" /> {busy ? 'Retrying…' : 'Retry'}
              </button>
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-[11px] text-foreground-faint">Finish this mode to earn 25 XP once and count today toward your Games streak.</p>
      </div>
    </div>
  );
}
