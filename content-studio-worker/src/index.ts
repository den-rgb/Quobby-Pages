import { ContentStudioClient } from './client.ts';
import { loadConfig } from './config.ts';
import { Keychain } from './keychain.ts';
import { Worker } from './worker.ts';
import { publishPublication } from './social/publish.ts';

async function main(): Promise<void> {
  if (process.argv.slice(2).some((arg) => arg !== '--once') || process.argv.slice(2).length > 1) throw new Error('Use npm start -- [--once].');
  const machineToken = process.env.CONTENT_STUDIO_MACHINE_TOKEN || await new Keychain().get('machine');
  const config = loadConfig({ ...process.env, CONTENT_STUDIO_MACHINE_TOKEN: machineToken ?? undefined });
  const worker = new Worker(new ContentStudioClient(config), { publishPublication });
  if (process.argv.includes('--once')) { await worker.runOnce(); return; }
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try { await worker.runForever(controller.signal); }
  finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
}

main().catch(() => {
  // Never print raw network, command, or Keychain errors into launchd logs.
  console.error('Content Studio worker stopped. Check configuration, Keychain access, and the admin queue.');
  process.exitCode = 1;
});
