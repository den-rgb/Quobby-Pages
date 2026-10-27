import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types test runner needs the explicit .ts extension.
import { hasActivePremium } from './premium.ts';

test('accepts lifetime premium and active subscriptions but rejects expired memberships', () => {
  assert.equal(hasActivePremium({ has_lifetime_premium: true, subscription_tier: 'free', subscription_expires_at: null }), true);
  assert.equal(hasActivePremium({ has_lifetime_premium: false, subscription_tier: 'premium', subscription_expires_at: '2099-01-01T00:00:00.000Z' }), true);
  assert.equal(hasActivePremium({ has_lifetime_premium: false, subscription_tier: 'premium', subscription_expires_at: '2000-01-01T00:00:00.000Z' }), false);
});
