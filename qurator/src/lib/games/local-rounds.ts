import type { RoundResult, GameKey } from './types';

export interface LocalGameRound {
  game: GameKey;
  challengeId: string;
  date: string;
  guesses: string[];
  giveUp: boolean;
  ownerProfileId?: string | null;
  letterMarks?: Record<string, 'red' | 'yellow' | 'green'>;
  result?: RoundResult;
}

export interface LocalRoundEntry {
  key: string;
  round: LocalGameRound;
}

export function localRoundStorageKey(round: LocalGameRound): string {
  const owner = round.ownerProfileId === undefined
    ? 'legacy'
    : round.ownerProfileId === null
      ? 'guest'
      : `profile:${encodeURIComponent(round.ownerProfileId)}`;
  return `${round.challengeId}::${owner}`;
}

export function getLocalRoundEntryForProfile(
  records: Record<string, LocalGameRound>,
  challengeId: string,
  profileId: string | null,
): LocalRoundEntry | undefined {
  const candidates = Object.entries(records)
    .filter(([, round]) => round.challengeId === challengeId);
  if (profileId) {
    const owned = candidates.find(([, round]) => round.ownerProfileId === profileId);
    if (owned) return { key: owned[0], round: owned[1] };
  }
  const guest = candidates.find(([, round]) => round.ownerProfileId === null);
  if (guest) return { key: guest[0], round: guest[1] };
  if (profileId === null) {
    const legacy = candidates.find(([, round]) => round.ownerProfileId === undefined);
    if (legacy) return { key: legacy[0], round: legacy[1] };
  }
  return undefined;
}

export function getLocalRoundForProfile(
  records: Record<string, LocalGameRound>,
  challengeId: string,
  profileId: string | null,
): LocalGameRound | undefined {
  return getLocalRoundEntryForProfile(records, challengeId, profileId)?.round;
}

export function pendingRoundEntriesForProfile(
  records: Record<string, LocalGameRound>,
  profileId: string,
): LocalRoundEntry[] {
  return Object.entries(records)
    .filter(([, round]) =>
      (round.ownerProfileId === null || round.ownerProfileId === profileId) &&
      Boolean(round.result?.claimable || round.result?.rewardPending),
    )
    .map(([key, round]) => ({ key, round }));
}

export function pendingRoundsForProfile(
  records: Record<string, LocalGameRound>,
  profileId: string,
): LocalGameRound[] {
  return pendingRoundEntriesForProfile(records, profileId).map(({ round }) => round);
}

export function claimGuestRound(round: LocalGameRound, profileId: string): LocalGameRound {
  if (round.ownerProfileId !== null) return round;
  return { ...round, ownerProfileId: profileId };
}
