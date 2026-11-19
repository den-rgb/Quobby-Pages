import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { requireMachineToken } from './machine-auth.ts';

function setToken(t: TestContext, value: string | undefined) {
  const previous = process.env.CONTENT_STUDIO_MACHINE_TOKEN;
  if (value === undefined) delete process.env.CONTENT_STUDIO_MACHINE_TOKEN;
  else process.env.CONTENT_STUDIO_MACHINE_TOKEN = value;
  t.after(() => {
    if (previous === undefined) delete process.env.CONTENT_STUDIO_MACHINE_TOKEN;
    else process.env.CONTENT_STUDIO_MACHINE_TOKEN = previous;
  });
}

function request(token?: string) {
  return new Request('https://qurator.test/api/internal/content-studio/claim', { headers: token === undefined ? {} : { 'x-content-studio-machine-token': token } });
}

test('rejects missing, wrong-length, and unequal worker tokens', (t) => {
  setToken(t, 'test-worker-secret');
  assert.equal(requireMachineToken(request()), false);
  assert.equal(requireMachineToken(request('short')), false);
  assert.equal(requireMachineToken(request('test-worker-secrex')), false);
});
test('accepts only the matching configured worker token', (t) => {
  setToken(t, 'test-worker-secret');
  assert.equal(requireMachineToken(request('test-worker-secret')), true);
});
test('fails closed when the server token is unset or empty', (t) => {
  setToken(t, undefined);
  assert.equal(requireMachineToken(request('anything')), false);
  assert.equal(requireMachineToken(request('')), false);
  setToken(t, '');
  assert.equal(requireMachineToken(request('')), false);
});
test('compares UTF-8 byte lengths before constant-time comparison', (t) => {
  setToken(t, 'é');
  assert.equal(requireMachineToken(request('x')), false);
  assert.equal(requireMachineToken(request('xx')), false);
  assert.equal(requireMachineToken(request('é')), true);
});
