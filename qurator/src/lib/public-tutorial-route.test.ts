import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types test runner needs the explicit .ts extension.
import { isPublicTutorialRoute } from './public-tutorial-route.ts';

test('identifies the browse page and individual tutorial pages as public', () => {
  assert.equal(isPublicTutorialRoute('/tutorials'), true);
  assert.equal(isPublicTutorialRoute('/tutorials/00000000-0000-4000-a000-000000000003'), true);
});

test('keeps unrelated routes behind the existing session refresh', () => {
  assert.equal(isPublicTutorialRoute('/tutorials-admin'), false);
  assert.equal(isPublicTutorialRoute('/profile/123'), false);
  assert.equal(isPublicTutorialRoute('/create'), false);
});
