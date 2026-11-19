import test from 'node:test';
import assert from 'node:assert/strict';
import { capture, run } from '../src/process.ts';

test('process passes literal shell characters without executing them', async () => {
  const value = '$(echo should-not-run); `exit 9`';
  assert.equal(await capture(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', value]), value);
  await run(process.execPath, ['-e', 'process.exit(0)']);
});

test('process fails on nonzero exit and bounds stderr to its final 4KB', async () => {
  await assert.rejects(run(process.execPath, ['-e', "process.stderr.write('A'.repeat(5000) + 'END'); process.exit(7)"]), (error: Error) => {
    assert.match(error.message, /7/);
    assert.match(error.message, /END$/);
    assert.ok(error.message.length < 4200);
    return true;
  });
  await assert.rejects(run('/no/such/quobby-command', []), /ENOENT|not found/);
});
