import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types test runner needs the explicit .ts extension.
import { resolveProfileId } from './auth.ts';

test('uses verified bearer identity when a bearer token is supplied', async () => {
  const profileId = await resolveProfileId(
    'Bearer valid-token',
    async (token) => token === 'valid-token' ? 'profile-1' : null,
    async () => 'cookie-profile',
  );
  assert.equal(profileId, 'profile-1');
});

test('falls back to the web cookie session when there is no bearer token', async () => {
  const profileId = await resolveProfileId(null, async () => null, async () => 'cookie-profile');
  assert.equal(profileId, 'cookie-profile');
});

test('does not trust an invalid bearer token or fall through to another profile', async () => {
  const profileId = await resolveProfileId('Bearer invalid', async () => null, async () => 'cookie-profile');
  assert.equal(profileId, null);
});

test('does not fall through to cookies for a malformed bearer header', async () => {
  const profileId = await resolveProfileId('Bearer', async () => 'unexpected', async () => 'cookie-profile');
  assert.equal(profileId, null);
});

test('does not use cookies when bearer verification fails', async () => {
  const profileId = await resolveProfileId(
    'Bearer expired-token',
    async () => { throw new Error('Token expired'); },
    async () => 'cookie-profile',
  );
  assert.equal(profileId, null);
});

test('treats a failed cookie-session lookup as signed out', async () => {
  const profileId = await resolveProfileId(
    null,
    async () => 'unexpected',
    async () => { throw new Error('Cookie session unavailable'); },
  );
  assert.equal(profileId, null);
});
