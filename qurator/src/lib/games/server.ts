import 'server-only';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { createChallengeForDate, getUtcDate } from './challenges';
import type { GameKey, GameProfileStats, PublicChallenge, StoredChallenge } from './types';

interface ChallengeRow {
  puzzle_date: string;
  game_key: GameKey;
  challenge_id: string;
  public_data: PublicChallenge['data'];
  private_solution: Record<string, unknown>;
}

function fromRow(row: ChallengeRow): StoredChallenge {
  return {
    game: row.game_key,
    challengeId: row.challenge_id,
    date: row.puzzle_date,
    title: row.game_key === 'letter-ledger'
      ? 'Letter Ledger'
      : row.game_key === 'number-trail'
        ? 'Number Trail'
        : 'Riddle Master',
    data: row.public_data,
    solution: row.private_solution,
  };
}

async function loadChallenge(game: GameKey, date: string): Promise<StoredChallenge | null> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('qurator_game_daily_challenges')
    .select('puzzle_date, game_key, challenge_id, public_data, private_solution')
    .eq('puzzle_date', date)
    .eq('game_key', game)
    .maybeSingle();
  if (error) throw new Error(`Daily challenge lookup failed: ${error.message}`);
  return data ? fromRow(data as ChallengeRow) : null;
}

export async function getDailyChallenge(game: GameKey): Promise<StoredChallenge> {
  const date = getUtcDate();
  const existing = await loadChallenge(game, date);
  if (existing) return existing;

  const generated = createChallengeForDate(game, date);
  const admin = supabaseAdmin();
  const { error } = await admin.from('qurator_game_daily_challenges').upsert(
    {
      puzzle_date: generated.date,
      game_key: generated.game,
      challenge_id: generated.challengeId,
      public_data: generated.data,
      private_solution: generated.solution,
    },
    { onConflict: 'puzzle_date,game_key', ignoreDuplicates: true },
  );
  if (error) throw new Error(`Daily challenge could not be stored: ${error.message}`);

  const persisted = await loadChallenge(game, date);
  if (!persisted) throw new Error('Daily challenge was not available after creation.');
  return persisted;
}

export async function getChallengeById(challengeId: string): Promise<StoredChallenge | null> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('qurator_game_daily_challenges')
    .select('puzzle_date, game_key, challenge_id, public_data, private_solution')
    .eq('challenge_id', challengeId)
    .maybeSingle();
  if (error) throw new Error(`Challenge lookup failed: ${error.message}`);
  return data ? fromRow(data as ChallengeRow) : null;
}

export function toPublicChallenge(challenge: StoredChallenge): PublicChallenge {
  return {
    game: challenge.game,
    challengeId: challenge.challengeId,
    date: challenge.date,
    title: challenge.title,
    data: challenge.data,
  };
}

export async function getSignedInProfileId(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function awardGameCompletion(
  profileId: string,
  challenge: StoredChallenge,
  outcome: 'won' | 'lost',
): Promise<{ awarded: boolean; stats: GameProfileStats }> {
  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc('qurator_award_game_completion', {
    p_profile_id: profileId,
    p_game_key: challenge.game,
    p_puzzle_date: challenge.date,
    p_outcome: outcome,
  });
  if (error) throw new Error(`Game reward could not be recorded: ${error.message}`);

  const result = data as {
    awarded?: boolean;
    totalXp?: number;
    level?: number;
    currentStreak?: number;
    bestStreak?: number;
    totalCompleted?: number;
  } | null;
  if (!result) throw new Error('The game reward response was empty.');

  return {
    awarded: result.awarded === true,
    stats: {
      totalXp: Number(result.totalXp ?? 0),
      level: Number(result.level ?? 1),
      currentStreak: Number(result.currentStreak ?? 0),
      bestStreak: Number(result.bestStreak ?? 0),
      totalCompleted: Number(result.totalCompleted ?? 0),
    },
  };
}

export async function getProfileGameStats(profileId: string): Promise<GameProfileStats> {
  const admin = supabaseAdmin();
  const [profileResult, gameStatsResult] = await Promise.all([
    admin.from('profiles').select('total_xp, level').eq('id', profileId).maybeSingle(),
    admin
      .from('qurator_game_profile_stats')
      .select('current_streak, best_streak, total_completed')
      .eq('profile_id', profileId)
      .maybeSingle(),
  ]);
  if (profileResult.error) throw new Error(`Profile stats lookup failed: ${profileResult.error.message}`);
  if (gameStatsResult.error) throw new Error(`Games stats lookup failed: ${gameStatsResult.error.message}`);

  return {
    totalXp: Number(profileResult.data?.total_xp ?? 0),
    level: Number(profileResult.data?.level ?? 1),
    currentStreak: Number(gameStatsResult.data?.current_streak ?? 0),
    bestStreak: Number(gameStatsResult.data?.best_streak ?? 0),
    totalCompleted: Number(gameStatsResult.data?.total_completed ?? 0),
  };
}
