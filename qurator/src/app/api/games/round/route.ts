import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { isGameKey } from '@/lib/games/challenges';
import { GameValidationError, validateTranscript } from '@/lib/games/validation';
import {
  awardGameCompletion,
  getChallengeById,
  getSignedInProfileId,
} from '@/lib/games/server';

export const runtime = 'nodejs';

interface RoundRequest {
  game: string;
  challengeId: string;
  guesses: string[];
  giveUp: boolean;
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 60, windowMs: 60_000 });
  if (limited) return limited;

  let body: RoundRequest;
  try {
    body = await request.json() as RoundRequest;
  } catch {
    return NextResponse.json({ error: 'Send a valid game round.' }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== 'object' ||
    !isGameKey(body.game) ||
    typeof body.challengeId !== 'string' ||
    body.challengeId.length > 120 ||
    !Array.isArray(body.guesses) ||
    body.guesses.length > 50 ||
    !body.guesses.every((guess) => typeof guess === 'string' && guess.length <= 160) ||
    typeof body.giveUp !== 'boolean'
  ) {
    return NextResponse.json({ error: 'That game round is not valid.' }, { status: 400 });
  }

  try {
    const challenge = await getChallengeById(body.challengeId);
    if (!challenge || challenge.game !== body.game) {
      return NextResponse.json({ error: 'That daily challenge is no longer available.' }, { status: 404 });
    }

    const transcript = validateTranscript(challenge, body.guesses, body.giveUp);
    if (!transcript.ended) {
      return NextResponse.json({
        ended: false,
        feedback: transcript.feedback,
        guessesRemaining: transcript.guessesRemaining,
      });
    }

    const terminal = {
      ended: true as const,
      game: challenge.game,
      challengeId: challenge.challengeId,
      date: challenge.date,
      outcome: transcript.outcome,
      attempts: transcript.attempts,
      answer: transcript.answer,
      ...(transcript.solution ? { solution: transcript.solution } : {}),
      feedback: transcript.feedback,
      claimable: false,
      rewardPending: false,
      rewarded: false,
      xpAwarded: 0,
    };

    const profileId = await getSignedInProfileId();
    if (!profileId) {
      return NextResponse.json({ ...terminal, claimable: true });
    }

    try {
      const reward = await awardGameCompletion(profileId, challenge, transcript.outcome);
      return NextResponse.json({
        ...terminal,
        rewarded: true,
        alreadyRewarded: !reward.awarded,
        xpAwarded: reward.awarded ? 25 : 0,
        stats: reward.stats,
      });
    } catch (error) {
      console.error('Game reward pending:', error instanceof Error ? error.message : 'unknown');
      return NextResponse.json({
        ...terminal,
        claimable: true,
        rewardPending: true,
      });
    }
  } catch (error) {
    if (error instanceof GameValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Game round validation failed:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { error: 'Your round could not be checked. Please retry.' },
      { status: 503 },
    );
  }
}
