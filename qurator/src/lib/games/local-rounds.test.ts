import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types test runner needs the explicit .ts extension.
import { claimGuestRound, localRoundStorageKey, getLocalRoundForProfile, pendingRoundsForProfile, type LocalGameRound } from './local-rounds.ts';

function round(ownerProfileId: string | null, challengeId: string, pending = true): LocalGameRound {
  return {
    game: 'letter-ledger',
    challengeId,
    date: '2026-11-01',
    ownerProfileId,
    guesses: ['eerie'],
    giveUp: false,
    result: {
      game: 'letter-ledger',
      challengeId,
      date: '2026-11-01',
      outcome: 'lost',
      attempts: 1,
      answer: 'plant',
      feedback: [],
      claimable: pending,
      rewardPending: false,
      rewarded: false,
      xpAwarded: 0,
    },
  };
}

test('a profile only restores its own round or a guest round, never another profile', () => {
  const profileARound = round('profile-a', 'letter-2026-11-01');
  const guestRound = round(null, 'letter-2026-11-01');
  const records = { profileA: profileARound, guest: guestRound };

  assert.equal(getLocalRoundForProfile(records, 'letter-2026-11-01', 'profile-a'), profileARound);
  assert.equal(getLocalRoundForProfile(records, 'letter-2026-11-01', 'profile-b'), guestRound);
  assert.equal(getLocalRoundForProfile({ profileA: profileARound }, 'letter-2026-11-01', 'profile-b'), undefined);
});

test('pending replay for a profile includes its own and guest rounds, not another profile', () => {
  const records = {
    profileA: round('profile-a', 'letter-2026-11-01'),
    profileB: round('profile-b', 'number-2026-11-01'),
    guest: round(null, 'riddle-2026-11-01'),
  };

  const pending = pendingRoundsForProfile(records, 'profile-b');
  assert.deepEqual(pending.map((item) => item.challengeId).sort(), ['number-2026-11-01', 'riddle-2026-11-01']);
});

test('an ownerless legacy transcript stays guest-only because its profile cannot be identified', () => {
  const legacy = round(null, 'letter-2026-11-01');
  delete legacy.ownerProfileId;
  const records = { legacy };
  const explicitGuest = round(null, 'letter-2026-11-01');

  assert.notEqual(localRoundStorageKey(legacy), localRoundStorageKey(explicitGuest));
  assert.equal(getLocalRoundForProfile(records, 'letter-2026-11-01', 'profile-b'), undefined);
  assert.equal(getLocalRoundForProfile(records, 'letter-2026-11-01', null), legacy);
  assert.deepEqual(pendingRoundsForProfile(records, 'profile-b'), []);
  assert.equal(claimGuestRound(legacy, 'profile-b').ownerProfileId, undefined);
});

test('claiming a guest transcript binds it to the first profile that signs in', () => {
  const guestRound = round(null, 'riddle-2026-11-01');
  const claimed = claimGuestRound(guestRound, 'profile-b');
  assert.equal(claimed.ownerProfileId, 'profile-b');
  assert.equal(claimGuestRound(round('profile-a', 'riddle-2026-11-01'), 'profile-b').ownerProfileId, 'profile-a');
  assert.notEqual(localRoundStorageKey(round('profile-a', 'letter-2026-11-01')), localRoundStorageKey(round('profile-b', 'letter-2026-11-01')));
});
