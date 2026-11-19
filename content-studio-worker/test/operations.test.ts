import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { authorizationUrl, connectPlatform, loadOAuthConfig, loopbackListenHost, parsePlatform, type ManualTokenPrompt } from '../scripts/connect-platform.ts';

const exec = promisify(execFile);

test('launchd worker restarts and logs outside the repository', async () => {
  const plist = await readFile(new URL('../com.quobby.content-studio-worker.plist', import.meta.url), 'utf8');
  assert.match(plist, /<key>KeepAlive<\/key>\s*<true\/>/);
  assert.match(plist, /Library\/Logs\/QuobbyContentStudio/);
  assert.match(plist, /__NODE_BINARY__/);
  assert.match(plist, /--experimental-strip-types/);
  assert.match(plist, /__WORKER_DIRECTORY__\/src\/index\.ts/);
});

test('installer replaces the whole ProgramArguments array and dictionary values, building outside LaunchAgents', async () => {
  const installer = await readFile(new URL('../scripts/install-launchd.sh', import.meta.url), 'utf8');
  // Index keypaths insert rather than replace on current macOS.
  assert.doesNotMatch(installer, /ProgramArguments\.\d/);
  assert.match(installer, /-replace 'ProgramArguments' -json/);
  assert.match(installer, /-replace 'EnvironmentVariables\.CONTENT_STUDIO_BASE_URL'/);
  // macOS kills plutil editing in place inside ~/Library/LaunchAgents.
  assert.match(installer, /mktemp "\$\{TMPDIR:-\/tmp\}\//);
  assert.match(installer, /trap .* ZERR/);

  const directory = await mkdtemp(join(tmpdir(), 'quobby-plist-test-'));
  const output = join(directory, 'worker.plist');
  try {
    await cp(new URL('../com.quobby.content-studio-worker.plist', import.meta.url), output);
    const args = ['/opt/node', '--experimental-strip-types', "/tmp/a \"quoted\" path/src/index.ts"];
    await exec('/usr/bin/plutil', ['-replace', 'ProgramArguments', '-json', JSON.stringify(args), output]);
    await exec('/usr/bin/plutil', ['-replace', 'EnvironmentVariables.CONTENT_STUDIO_BASE_URL', '-string', 'https://qurator.test', output]);
    const { stdout } = await exec('/usr/bin/plutil', ['-convert', 'json', '-o', '-', output]);
    const plist = JSON.parse(stdout) as { ProgramArguments: string[]; EnvironmentVariables: Record<string, string> };
    assert.deepEqual(plist.ProgramArguments, args);
    assert.equal(plist.EnvironmentVariables.CONTENT_STUDIO_BASE_URL, 'https://qurator.test');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('OAuth setup only accepts supported platforms and uses state plus S256 PKCE', () => {
  assert.equal(parsePlatform('youtube'), 'youtube');
  assert.throws(() => parsePlatform('mastodon'), /instagram, tiktok, or youtube/);
  const config = loadOAuthConfig('youtube', {
    YOUTUBE_OAUTH_CLIENT_ID: 'client-id',
    YOUTUBE_OAUTH_REDIRECT_URI: 'http://127.0.0.1:43123/callback',
    YOUTUBE_OAUTH_AUTHORIZE_URL: 'https://accounts.google.com/o/oauth2/v2/auth',
    YOUTUBE_OAUTH_TOKEN_URL: 'https://oauth2.googleapis.com/token',
    YOUTUBE_OAUTH_SCOPES: 'https://www.googleapis.com/auth/youtube.upload',
  });
  const url = authorizationUrl(config, 'csrf-state', 'challenge');
  assert.equal(url.searchParams.get('state'), 'csrf-state');
  assert.equal(url.searchParams.get('code_challenge'), 'challenge');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://127.0.0.1:43123/callback');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('prompt'), 'consent');
});

test('installer persists optional non-secret provider and voice settings and resolves binaries after checks', async () => {
  const installer = await readFile(new URL('../scripts/install-launchd.sh', import.meta.url), 'utf8');
  for (const name of ['INSTAGRAM_API_BASE_URL', 'INSTAGRAM_API_VERSION', 'INSTAGRAM_USER_ID', 'VOICE_NAME', 'VOICE_COMMAND']) assert.match(installer, new RegExp(`\\b${name}\\b`));
  assert.doesNotMatch(installer, /TOKEN|SECRET/);
  assert.ok(installer.indexOf('Missing required command') < installer.indexOf('ffmpeg_binary="$(command -v ffmpeg)"'));

  const directory = await mkdtemp(join(tmpdir(), 'quobby-plist-test-'));
  const output = join(directory, 'worker.plist');
  try {
    await cp(new URL('../com.quobby.content-studio-worker.plist', import.meta.url), output);
    await exec('/usr/bin/plutil', ['-replace', 'EnvironmentVariables.INSTAGRAM_USER_ID', '-string', '1789', output]);
    await exec('/usr/bin/plutil', ['-replace', 'EnvironmentVariables.VOICE_COMMAND', '-string', '["/opt/voice","{text}","{output}"]', output]);
    const { stdout } = await exec('/usr/bin/plutil', ['-convert', 'json', '-o', '-', output]);
    const plist = JSON.parse(stdout) as { EnvironmentVariables: Record<string, string> };
    assert.equal(plist.EnvironmentVariables.INSTAGRAM_USER_ID, '1789');
    assert.equal(plist.EnvironmentVariables.VOICE_COMMAND, '["/opt/voice","{text}","{output}"]');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('OAuth setup names each missing configuration value and rejects non-loopback callbacks', () => {
  assert.throws(() => loadOAuthConfig('instagram', {}), /INSTAGRAM_OAUTH_CLIENT_ID/);
  assert.throws(() => loadOAuthConfig('tiktok', {
    TIKTOK_OAUTH_CLIENT_ID: 'client-key',
    TIKTOK_OAUTH_REDIRECT_URI: 'https://qurator.example/callback',
    TIKTOK_OAUTH_AUTHORIZE_URL: 'https://www.tiktok.com/v2/auth/authorize/',
    TIKTOK_OAUTH_TOKEN_URL: 'https://open.tiktokapis.com/v2/oauth/token/',
    TIKTOK_OAUTH_SCOPES: 'video.publish',
  }), /loopback/);
});

test('manual Instagram and TikTok provisioning reads a token only from a hidden interactive prompt', async () => {
  const writes: string[] = [];
  const prompt: ManualTokenPrompt = {
    isInteractive: () => true,
    readHidden: async () => 'manual-token-that-never-appears-in-output',
  };
  const keychain = { set: async (account: string, value: string): Promise<void> => { writes.push(`${account}:${value}`); } };
  const result = await connectPlatform('instagram', { INSTAGRAM_MANUAL_TOKEN_PROVISIONING: 'true' }, keychain, prompt);
  assert.equal(result.expiresAt, 'provider did not provide an expiry');
  assert.equal(JSON.parse(writes[0].slice('instagram:'.length)).access_token, 'manual-token-that-never-appears-in-output');
  await assert.rejects(connectPlatform('tiktok', { TIKTOK_MANUAL_TOKEN_PROVISIONING: 'true' }, keychain, { isInteractive: () => false, readHidden: async () => 'never-used-token' }), /interactive TTY/);
  await assert.rejects(connectPlatform('instagram', { INSTAGRAM_MANUAL_TOKEN_PROVISIONING: 'false' }, keychain, prompt), /MANUAL_TOKEN_PROVISIONING=true/);
  await assert.rejects(connectPlatform('instagram', { INSTAGRAM_MANUAL_TOKEN_PROVISIONING: 'true' }, keychain, { isInteractive: () => true, readHidden: async () => 'too-short' }), /valid provider token/);
});

test('IPv6 loopback callback binds without URL brackets', () => {
  const config = loadOAuthConfig('youtube', {
    YOUTUBE_OAUTH_CLIENT_ID: 'client-id',
    YOUTUBE_OAUTH_REDIRECT_URI: 'http://[::1]:43123/callback',
    YOUTUBE_OAUTH_AUTHORIZE_URL: 'https://accounts.google.com/o/oauth2/v2/auth',
    YOUTUBE_OAUTH_TOKEN_URL: 'https://oauth2.googleapis.com/token',
    YOUTUBE_OAUTH_SCOPES: 'https://www.googleapis.com/auth/youtube.upload',
  });
  assert.equal(loopbackListenHost(config.redirectUri), '::1');
});
