import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { parsePlatformCopy, platformCopyPrompt, PLATFORM_COPY_MAX_DESCRIPTION } from './platform-copy.ts';

test('platform copy is sanitised per platform and drops unusable entries', () => {
  const copy = parsePlatformCopy(JSON.stringify({
    instagram: { description: '  My brain at 2am 😴  deciding to revise.  ', hashtags: ['#studytok', 'exam season', 'studytok', '🔥'] },
    tiktok: { description: '', hashtags: ['fyp'] },
    youtube: { description: 'A short clip about late-night revision and Quobby flashcards.', hashtags: ['study tips', 'quobby', 'revision'] },
    extra: { description: 'ignored', hashtags: ['nope'] },
  }));
  assert.deepEqual(copy.instagram, { description: 'My brain at 2am deciding to revise.', hashtags: ['studytok', 'examseason'] });
  assert.equal(copy.tiktok, undefined);
  assert.deepEqual(copy.youtube?.hashtags, ['studytips', 'quobby', 'revision']);
});

test('platform copy rejects unreadable bodies and over-long descriptions', () => {
  assert.deepEqual(parsePlatformCopy('not json'), {});
  assert.deepEqual(parsePlatformCopy(JSON.stringify({ instagram: { description: 'x'.repeat(PLATFORM_COPY_MAX_DESCRIPTION + 1), hashtags: ['a'] } })), {});
});

test('the copy prompt covers each platform style and forbids invented features', () => {
  const prompt = platformCopyPrompt({ title: 'The 2am promise', hook: 'Me at 2am', cta: 'Try Quobby' });
  assert.match(prompt, /The 2am promise/);
  assert.match(prompt, /instagram:/); assert.match(prompt, /tiktok:/); assert.match(prompt, /youtube:/);
  assert.match(prompt, /never invent/);
  assert.match(prompt, /studytok and fyp/);
});
