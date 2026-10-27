'use client';

import { LetterLedger } from '@/components/games/letter-ledger';
import { GameResult } from '@/components/games/game-result';
import { NumberTrail } from '@/components/games/number-trail';
import { RiddleMaster } from '@/components/games/riddle-master';
import { useAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/client';
import {
  claimGuestRound,
  getLocalRoundEntryForProfile,
  localRoundStorageKey,
  pendingRoundEntriesForProfile,
  type LocalGameRound,
} from '@/lib/games/local-rounds';
import type {
  DailyGameResponse,
  GameKey,
  GuessFeedback,
  LetterMark,
  NumberChallengeData,
  NumberFeedback,
  RoundResult,
  RiddleChallengeData,
  RiddleFeedback,
  WordChallengeData,
  WordFeedback,
} from '@/lib/games/types';
import { track } from '@vercel/analytics';
import { ArrowLeft, Loader2, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'qurator-games:rounds:v1';

type LocalRound = LocalGameRound;

interface ActiveResponse {
  ended: false;
  feedback: GuessFeedback;
  guessesRemaining: number | null;
  error?: string;
  code?: string;
}

type RoundResponse = ActiveResponse | (RoundResult & { ended: true; error?: string; code?: string });

function readRounds(): Record<string, LocalRound> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, LocalRound>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    // Ownerless records predate profile scoping. Keep them distinguishable
    // from explicit guest rounds and never claim them for a signed-in profile.
    return parsed;
  } catch {
    return {};
  }
}

function writeRound(round: LocalRound): void {
  try {
    const rounds = readRounds();
    if (round.ownerProfileId === undefined) {
      // Migrate an ambiguous ownerless record without turning it into a guest
      // record that a later signed-in profile could claim.
      for (const [key, saved] of Object.entries(rounds)) {
        if (key === round.challengeId && saved.challengeId === round.challengeId && saved.ownerProfileId === undefined) {
          delete rounds[key];
        }
      }
    }
    rounds[localRoundStorageKey(round)] = round;
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

export function GamePlayer({ game }: { game: GameKey }) {
  const { user, loading: authLoading } = useAuth();
  const requestKey = `${game}:${user?.id ?? 'guest'}`;
  const [challengeEntry, setChallengeEntry] = useState<{ requestKey: string; data: DailyGameResponse } | null>(null);
  const challenge = challengeEntry?.requestKey === requestKey ? challengeEntry.data : null;
  const [round, setRound] = useState<LocalRound | null>(null);
  const [feedback, setFeedback] = useState<GuessFeedback>([]);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [loadedRequestKey, setLoadedRequestKey] = useState<string | null>(null);
  const loading = authLoading || loadedRequestKey !== requestKey;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<LocalRound | null>(null);
  const pendingRollbacks = useRef(new Map<string, LocalRound>());
  const autoRetryAttempt = useRef(0);
  const hydratedChallenge = useRef<string | null>(null);
  const claimedUser = useRef<string | null>(null);
  const activeRequestKey = useRef(requestKey);
  const activeProfileId = useRef(user?.id ?? null);
  const requestGenerations = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    activeRequestKey.current = requestKey;
    activeProfileId.current = user?.id ?? null;
    return () => {
      if (activeRequestKey.current === requestKey) activeRequestKey.current = '';
    };
  }, [requestKey, user?.id]);

  useEffect(() => {
    let active = true;
    if (authLoading) return () => { active = false; };

    fetch(`/api/games/daily?game=${encodeURIComponent(game)}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Today’s challenge could not be loaded.');
        return data as DailyGameResponse;
      })
      .then((data) => {
        if (active) {
          hydratedChallenge.current = null;
          claimedUser.current = null;
          setRound(null);
          setFeedback([]);
          setResult(null);
          setBusy(false);
          setPendingRequest(null);
          setError(null);
          track('game_opened', { game });
          setChallengeEntry({ requestKey, data });
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Today’s challenge could not be loaded.');
      })
      .finally(() => {
        if (active) setLoadedRequestKey(requestKey);
      });
    return () => { active = false; };
  }, [authLoading, game, requestKey]);

  const sendRound = useCallback(async (record: LocalRound, rollback: LocalRound | null = null): Promise<boolean> => {
    const requestKeyAtStart = activeRequestKey.current;
    const profileId = activeProfileId.current;
    let requestRecord = record;
    let requestRollback = rollback;
    if (requestRecord.ownerProfileId === undefined && profileId) return false;
    if (requestRecord.ownerProfileId !== undefined && requestRecord.ownerProfileId !== null && requestRecord.ownerProfileId !== profileId) return false;
    if (requestRecord.ownerProfileId === null && profileId) {
      requestRecord = claimGuestRound(requestRecord, profileId);
      writeRound(requestRecord);
      if (requestRollback && requestRollback.ownerProfileId === null) {
        requestRollback = claimGuestRound(requestRollback, profileId);
      }
    }

    const recordKey = localRoundStorageKey(requestRecord);
    const generation = (requestGenerations.current.get(recordKey) ?? 0) + 1;
    requestGenerations.current.set(recordKey, generation);
    const isCurrentRequest = () =>
      activeRequestKey.current === requestKeyAtStart &&
      requestGenerations.current.get(recordKey) === generation;

    setBusy(true);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (profileId) {
        const { data: { session } } = await createClient().auth.getSession();
        if (session?.user.id !== profileId || activeRequestKey.current !== requestKeyAtStart) return false;
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      const response = await fetch('/api/games/round', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          game: requestRecord.game,
          challengeId: requestRecord.challengeId,
          guesses: requestRecord.guesses,
          giveUp: requestRecord.giveUp,
        }),
      });
      const data = await response.json() as RoundResponse;
      if (!isCurrentRequest()) return false;
      if (!response.ok) {
        const message = data.error ?? 'Your guess could not be checked.';
        setError(message);
        const retryableStatus = [401, 408, 425, 429].includes(response.status);
        if (response.status < 500 && !retryableStatus) {
          const rejectedRollback = requestRollback ?? pendingRollbacks.current.get(recordKey) ??
            (data.code === 'invalid_word' && requestRecord.guesses.length > 0
              ? { ...requestRecord, guesses: requestRecord.guesses.slice(0, -1), giveUp: false, result: undefined }
              : null);
          if (data.code === 'invalid_word') {
            if (requestRecord.result) setFeedback(requestRecord.result.feedback.slice(0, -1));
            setResult(null);
          }
          setPendingRequest(null);
          pendingRollbacks.current.delete(recordKey);
          autoRetryAttempt.current = 0;
          if (rejectedRollback) {
            writeRound(rejectedRollback);
            setRound(rejectedRollback);
          }
          return false;
        }
        if (requestRollback) pendingRollbacks.current.set(recordKey, requestRollback);
        writeRound(requestRecord);
        setRound(requestRecord);
        setPendingRequest(requestRecord);
        return true;
      }

      setPendingRequest(null);
      pendingRollbacks.current.delete(recordKey);
      if (!data.ended || !data.rewardPending) autoRetryAttempt.current = 0;
      if (data.ended) {
        if (!requestRecord.result) {
          track('game_finished', { game: requestRecord.game, outcome: data.outcome });
        }
        const saved = { ...requestRecord, result: data as RoundResult };
        writeRound(saved);
        setRound(saved);
        setFeedback(data.feedback);
        setResult(data as RoundResult);
      } else {
        const saved = { ...requestRecord, result: undefined };
        writeRound(saved);
        setRound(saved);
        setFeedback(data.feedback);
        setResult(null);
      }
      return true;
    } catch {
      if (!isCurrentRequest()) return false;
      setError('Could not reach Qurator.');
      if (requestRollback) pendingRollbacks.current.set(recordKey, requestRollback);
      writeRound(requestRecord);
      setRound(requestRecord);
      setPendingRequest(requestRecord);
      return true;
    } finally {
      if (isCurrentRequest()) setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (busy) return;
    const retryRound = pendingRequest ?? (
      result && user && (result.rewardPending || result.claimable) ? round : null
    );
    if (!retryRound) {
      autoRetryAttempt.current = 0;
      return;
    }
    const retryKey = localRoundStorageKey(retryRound);
    const rollback = pendingRollbacks.current.get(retryKey) ?? null;
    const delayMs = Math.min(1_000 * (2 ** Math.min(autoRetryAttempt.current, 6)), 60_000);
    const timer = window.setTimeout(() => {
      autoRetryAttempt.current += 1;
      void sendRound(retryRound, rollback);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [busy, pendingRequest, result, round, sendRound, user]);

  useEffect(() => {
    if (!challenge || challenge.profileCompletion || authLoading) return;
    const profileId = user?.id ?? null;
    const hydrationKey = `${challenge.challengeId}:${profileId ?? 'guest'}`;
    if (hydratedChallenge.current === hydrationKey) return;
    hydratedChallenge.current = hydrationKey;

    const entry = getLocalRoundEntryForProfile(readRounds(), challenge.challengeId, profileId);
    let saved: LocalRound;
    if (entry) {
      saved = entry.round;
      if (profileId && saved.ownerProfileId === null) {
        saved = claimGuestRound(saved, profileId);
        writeRound(saved);
        try {
          const rounds = readRounds();
          delete rounds[entry.key];
          rounds[localRoundStorageKey(saved)] = saved;
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rounds));
        } catch {
          // The claimed transcript stays in memory and can still be retried.
        }
      }
    } else {
      saved = {
        game,
        challengeId: challenge.challengeId,
        date: challenge.date,
        guesses: [],
        giveUp: false,
        ownerProfileId: profileId,
      };
    }

    setRound(saved);
    setFeedback(saved.result?.feedback ?? []);
    setResult(saved.result ?? null);
    if (saved.guesses.length > 0 || saved.giveUp) {
      const restoreTimer = window.setTimeout(() => void sendRound(saved), 0);
      return () => {
        window.clearTimeout(restoreTimer);
        if (hydratedChallenge.current === hydrationKey) hydratedChallenge.current = null;
      };
    }
  }, [authLoading, challenge, game, sendRound, user]);

  const claimOtherPendingRounds = useCallback(async (skipChallengeId: string, profileId: string) => {
    const requestKeyAtStart = requestKey;
    const pending = pendingRoundEntriesForProfile(readRounds(), profileId);

    for (const entry of pending) {
      if (activeRequestKey.current !== requestKeyAtStart) return;
      if (entry.round.challengeId === skipChallengeId) continue;
      let candidate = entry.round;
      if (candidate.ownerProfileId === null) {
        candidate = claimGuestRound(candidate, profileId);
        try {
          const rounds = readRounds();
          delete rounds[entry.key];
          rounds[localRoundStorageKey(candidate)] = candidate;
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rounds));
        } catch {
          // The request still uses this profile-bound snapshot.
        }
      }
      if (candidate.ownerProfileId !== profileId) continue;

      let retryDelayMs = 1_000;
      while (activeRequestKey.current === requestKeyAtStart) {
        try {
          const { data: { session } } = await createClient().auth.getSession();
          if (session?.user.id !== profileId || activeRequestKey.current !== requestKeyAtStart) return;
          const response = await fetch('/api/games/round', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: "Bearer " + session.access_token,
            },
            body: JSON.stringify({
              game: candidate.game,
              challengeId: candidate.challengeId,
              guesses: candidate.guesses,
              giveUp: candidate.giveUp,
            }),
          });
          const data = await response.json() as RoundResponse;
          if (activeRequestKey.current !== requestKeyAtStart) return;
          if (!response.ok) {
            if (data.code === 'invalid_word' && candidate.guesses.length > 0) {
              writeRound({
                ...candidate,
                guesses: candidate.guesses.slice(0, -1),
                giveUp: false,
                result: undefined,
              });
              break;
            }
            if (response.status < 500 && ![401, 408, 425, 429].includes(response.status)) break;
          } else {
            candidate = data.ended
              ? { ...candidate, result: data as RoundResult }
              : { ...candidate, result: undefined };
            writeRound(candidate);
            if (!data.ended || (!data.claimable && !data.rewardPending)) break;
          }
        } catch {
          // Keep the profile-owned transcript for the next automatic attempt.
        }
        if (activeRequestKey.current !== requestKeyAtStart) return;
        await new Promise<void>((resolve) => window.setTimeout(resolve, retryDelayMs));
        retryDelayMs = Math.min(retryDelayMs * 2, 60_000);
      }
    }
  }, [requestKey]);

  useEffect(() => {
    if (!user || !challenge || authLoading || claimedUser.current === user.id) return;
    claimedUser.current = user.id;
    void claimOtherPendingRounds(challenge.challengeId, user.id);
  }, [authLoading, challenge, claimOtherPendingRounds, user]);

  const submitGuess = useCallback(async (guess: string): Promise<boolean> => {
    if (!challenge || challenge.profileCompletion || result || busy) return false;
    const previous: LocalRound = round ?? {
      game,
      challengeId: challenge.challengeId,
      date: challenge.date,
      guesses: [],
      giveUp: false,
      ownerProfileId: user?.id ?? null,
    };
    const next: LocalRound = {
      ...previous,
      guesses: [...previous.guesses, guess],
      giveUp: false,
      result: undefined,
    };
    writeRound(next);
    return sendRound(next, previous);
  }, [busy, challenge, game, result, round, sendRound, user]);

  const giveUp = useCallback(() => {
    if (!challenge || challenge.profileCompletion || result || busy) return;
    const previous: LocalRound = round ?? {
      game,
      challengeId: challenge.challengeId,
      date: challenge.date,
      guesses: [],
      giveUp: false,
      ownerProfileId: user?.id ?? null,
    };
    const next: LocalRound = { ...previous, giveUp: true, result: undefined };
    writeRound(next);
    void sendRound(next, previous);
  }, [busy, challenge, game, result, round, sendRound, user]);

  const updateLetterMark = useCallback((letterKey: string, mark: LetterMark | null) => {
    if (!challenge) return;
    const currentRound: LocalRound = round ?? {
      game,
      challengeId: challenge.challengeId,
      date: challenge.date,
      guesses: [],
      giveUp: false,
      ownerProfileId: user?.id ?? null,
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
  }, [challenge, game, round, user]);

  const clearLetterMarks = useCallback(() => {
    if (!challenge || !round?.letterMarks || Object.keys(round.letterMarks).length === 0) return;
    const updatedRound = { ...round, letterMarks: {} };
    writeRound(updatedRound);
    setRound(updatedRound);
  }, [challenge, round]);

  if (loading || authLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-5 py-12 text-center">
        <div className="max-w-2xl mb-7">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">{titleFor(game)}</h1>
        </div>
        <p className="flex items-center text-foreground-faint">
          <Loader2 className="w-5 h-5 animate-spin mr-3" />
          Loading…
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

  if (challenge.profileCompletion) {
    return (
      <div className="px-5 sm:px-6 py-8 sm:py-12">
        <div className="max-w-[760px] mx-auto">
          <Link href="/games" className="inline-flex items-center gap-2 text-sm text-foreground-faint hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> All games
          </Link>
          <div className="p-6 sm:p-8 rounded-3xl border border-green-400/20 bg-green-500/[0.06] text-center">
            <p className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-200 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-green-300" aria-hidden="true" /> Played today
            </p>
            <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">{titleFor(game)}</h1>
          </div>
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
        </div>

        <div className="p-4 sm:p-6 rounded-3xl border border-white/[0.07] bg-white/[0.025]">
          {result ? (
            <GameResult result={result} />
          ) : game === 'letter-ledger' ? (
            <LetterLedger
              data={challenge.data as WordChallengeData}
              feedback={feedback as WordFeedback[]}
              letterMarks={round?.letterMarks ?? {}}
              busy={busy}
              completed={Boolean(result)}
              error={error}
              onGuess={submitGuess}
              onGiveUp={giveUp}
              onLetterMarkChange={updateLetterMark}
              onClearLetterMarks={clearLetterMarks}
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
        </div>
      </div>
    </div>
  );
}
