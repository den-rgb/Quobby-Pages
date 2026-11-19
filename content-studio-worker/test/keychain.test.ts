import test from 'node:test';
import assert from 'node:assert/strict';
import { Keychain } from '../src/keychain.ts';

test('Keychain reads and updates one account with literal security arguments', async () => {
  const calls: { command: string; args: string[] }[] = [];
  const keychain = new Keychain(async (command, args) => { calls.push({ command, args }); return { code: 0, stdout: 'token-value\n' }; });
  assert.equal(await keychain.get('youtube'), 'token-value');
  await keychain.set('youtube', 'literal $(touch /tmp/nope)');
  assert.deepEqual(calls, [
    { command: '/usr/bin/security', args: ['find-generic-password', '-s', 'quobby-content-studio', '-a', 'youtube', '-w'] },
    { command: '/usr/bin/security', args: ['add-generic-password', '-U', '-s', 'quobby-content-studio', '-a', 'youtube', '-w', 'literal $(touch /tmp/nope)'] },
  ]);
});
test('Keychain distinguishes a missing item and sanitizes command failures', async () => {
  assert.equal(await new Keychain(async () => ({ code: 44, stdout: '' })).get('machine'), null);
  const keychain = new Keychain(async () => { throw new Error('token=secret from command'); });
  await assert.rejects(keychain.get('machine'), { message: 'Could not read macOS Keychain.' });
  await assert.rejects(keychain.set('youtube', 'secret'), { message: 'Could not update macOS Keychain.' });
});
