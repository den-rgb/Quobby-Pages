import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { Keychain } from '../src/keychain.ts';

export type OAuthPlatform = 'instagram' | 'tiktok' | 'youtube';
export interface OAuthConfig {
  platform: OAuthPlatform;
  clientId: string;
  clientSecret?: string;
  redirectUri: URL;
  authorizeUrl: URL;
  tokenUrl: URL;
  scopes: string;
  usePkce: boolean;
}

export interface ManualTokenPrompt {
  isInteractive(): boolean;
  readHidden(prompt: string): Promise<string>;
}

interface KeychainWriter {
  set(account: string, token: string): Promise<void>;
}

const PLATFORMS = ['instagram', 'tiktok', 'youtube'] as const;
const PREFIX: Record<OAuthPlatform, string> = { instagram: 'INSTAGRAM', tiktok: 'TIKTOK', youtube: 'YOUTUBE' };

export function parsePlatform(value: string | undefined): OAuthPlatform {
  if (PLATFORMS.includes(value as OAuthPlatform)) return value as OAuthPlatform;
  throw new Error('Use exactly one platform: instagram, tiktok, or youtube.');
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value || value.length > 4096 || /[\r\n\0]/.test(value)) throw new Error(`Set ${name} before connecting this platform.`);
  return value;
}

function httpsUrl(value: string, name: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`Set a valid ${name}.`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error(`Set a valid HTTPS ${name}.`);
  return url;
}

function loopbackUrl(value: string, name: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`Set a valid ${name}.`); }
  if (url.protocol !== 'http:' || !['127.0.0.1', '::1', '[::1]'].includes(url.hostname) || !url.port || url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must be a registered http://127.0.0.1:<port>/callback loopback URI. Public HTTPS callbacks require a paired handoff and are not handled by this local worker.`);
  }
  return url;
}

export function loopbackListenHost(url: URL): '127.0.0.1' | '::1' {
  if (url.hostname === '127.0.0.1') return '127.0.0.1';
  if (url.hostname === '::1' || url.hostname === '[::1]') return '::1';
  throw new Error('OAuth callback must use a loopback host.');
}

export function loadOAuthConfig(platform: OAuthPlatform, env: NodeJS.ProcessEnv = process.env): OAuthConfig {
  const prefix = PREFIX[platform];
  const clientId = required(env, `${prefix}_OAUTH_CLIENT_ID`);
  const redirectUri = loopbackUrl(required(env, `${prefix}_OAUTH_REDIRECT_URI`), `${prefix}_OAUTH_REDIRECT_URI`);
  const authorizeUrl = httpsUrl(required(env, `${prefix}_OAUTH_AUTHORIZE_URL`), `${prefix}_OAUTH_AUTHORIZE_URL`);
  const tokenUrl = httpsUrl(required(env, `${prefix}_OAUTH_TOKEN_URL`), `${prefix}_OAUTH_TOKEN_URL`);
  const scopes = required(env, `${prefix}_OAUTH_SCOPES`);
  const clientSecret = env[`${prefix}_OAUTH_CLIENT_SECRET`]?.trim() || undefined;
  if (clientSecret && (clientSecret.length > 4096 || /[\r\n\0]/.test(clientSecret))) throw new Error(`Set a valid ${prefix}_OAUTH_CLIENT_SECRET.`);
  return { platform, clientId, clientSecret, redirectUri, authorizeUrl, tokenUrl, scopes, usePkce: platform === 'youtube' };
}

export function authorizationUrl(config: OAuthConfig, state: string, challenge?: string): URL {
  const url = new URL(config.authorizeUrl);
  if (config.platform === 'tiktok') url.searchParams.set('client_key', config.clientId);
  else url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', config.redirectUri.href);
  url.searchParams.set('scope', config.scopes);
  url.searchParams.set('state', state);
  if (config.usePkce) {
    if (!challenge) throw new Error('PKCE challenge is required.');
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    if (config.platform === 'youtube') {
      url.searchParams.set('access_type', 'offline');
      // Google omits refresh_token on repeat consent unless consent is forced.
      url.searchParams.set('prompt', 'consent');
    }
  }
  return url;
}

function base64url(value: Buffer): string { return value.toString('base64url'); }
function verifier(): string { return base64url(randomBytes(48)); }
function challenge(value: string): string { return base64url(createHash('sha256').update(value).digest()); }

function openBrowser(url: URL): void {
  const child = spawn('/usr/bin/open', [url.href], { detached: true, stdio: 'ignore', shell: false });
  child.unref();
}

async function receiveCallback(config: OAuthConfig, state: string, authorization: URL): Promise<string> {
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const callback = new URL(request.url ?? '/', config.redirectUri);
    if (request.method !== 'GET' || callback.pathname !== config.redirectUri.pathname || callback.searchParams.get('state') !== state) {
      response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }); response.end('Invalid OAuth callback.'); return;
    }
    const code = callback.searchParams.get('code');
    if (!code || code.length > 4096 || callback.searchParams.get('error')) {
      response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }); response.end('Authorization was not completed. Return to the terminal.');
      server.emit('oauth-error'); return;
    }
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }); response.end('Quobby Content Studio is connected. You can close this tab.');
    server.emit('oauth-code', code);
  });
  const timeout = setTimeout(() => server.emit('oauth-timeout'), 5 * 60_000);
  try {
    await new Promise<void>((resolve, reject) => {
      const failed = () => reject(new Error('Could not start the local OAuth callback. Check that the registered loopback port is available.'));
      server.once('error', failed);
      server.listen(Number(config.redirectUri.port), loopbackListenHost(config.redirectUri), () => {
        server.removeListener('error', failed);
        resolve();
      });
    });
    const callbackResult = Promise.race([
      once(server, 'oauth-code').then(([code]) => ({ kind: 'code' as const, code: String(code) })),
      once(server, 'oauth-error').then(() => ({ kind: 'error' as const })),
      once(server, 'oauth-timeout').then(() => ({ kind: 'timeout' as const })),
    ]);
    openBrowser(authorization);
    const event = await callbackResult;
    if (event.kind !== 'code') throw new Error(event.kind === 'timeout' ? 'OAuth authorization timed out.' : 'OAuth authorization was not completed.');
    return event.code;
  } finally {
    clearTimeout(timeout);
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

// token_url/client_id/client_secret let the worker refresh YouTube tokens without
// launchd environment values. Google treats installed-app client secrets as non-confidential.
interface StoredToken { access_token: string; refresh_token?: string; expires_at?: string; token_url?: string; client_id?: string; client_secret?: string }
async function exchangeCode(config: OAuthConfig, code: string, codeVerifier?: string): Promise<StoredToken> {
  const body = new URLSearchParams({ grant_type: 'authorization_code', redirect_uri: config.redirectUri.href, code });
  if (config.platform === 'tiktok') body.set('client_key', config.clientId);
  else body.set('client_id', config.clientId);
  if (config.clientSecret) body.set('client_secret', config.clientSecret);
  if (config.usePkce && codeVerifier) body.set('code_verifier', codeVerifier);
  let response: Response;
  try { response = await fetch(config.tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, redirect: 'error', signal: AbortSignal.timeout(30_000) }); }
  catch { throw new Error('Could not exchange the OAuth code. Check the connection and provider configuration.'); }
  let data: unknown;
  try { data = await response.json(); } catch { throw new Error('The provider returned an invalid OAuth token response.'); }
  if (!response.ok || !data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The provider rejected the OAuth code. Check the registered redirect URI and permissions.');
  const token = data as Record<string, unknown>;
  if (typeof token.access_token !== 'string' || !token.access_token || token.access_token.length > 16384 || /[\r\n\0]/.test(token.access_token)) throw new Error('The provider returned an invalid OAuth access token.');
  const saved: StoredToken = { access_token: token.access_token };
  if (typeof token.refresh_token === 'string' && token.refresh_token && token.refresh_token.length <= 16384 && !/[\r\n\0]/.test(token.refresh_token)) saved.refresh_token = token.refresh_token;
  if (typeof token.expires_in === 'number' && Number.isSafeInteger(token.expires_in) && token.expires_in > 0 && token.expires_in <= 31_536_000) saved.expires_at = new Date(Date.now() + token.expires_in * 1000).toISOString();
  return saved;
}

function terminalPrompt(): ManualTokenPrompt {
  return {
    isInteractive: () => Boolean(process.stdin.isTTY && process.stdout.isTTY && process.stdin.setRawMode),
    readHidden: (prompt) => new Promise<string>((resolve, reject) => {
      const input = process.stdin;
      if (!input.isTTY || !input.setRawMode) { reject(new Error('Manual token provisioning requires an interactive TTY.')); return; }
      let value = '';
      const finish = (error?: Error) => {
        input.off('data', onData);
        input.setRawMode(false);
        input.pause();
        process.stdout.write('\n');
        if (error) reject(error); else resolve(value);
      };
      const onData = (chunk: Buffer) => {
        for (const byte of chunk) {
          if (byte === 3) { finish(new Error('Manual token provisioning cancelled.')); return; }
          if (byte === 13 || byte === 10) { finish(); return; }
          if (byte === 8 || byte === 127) { value = value.slice(0, -1); continue; }
          if (byte < 32 || byte === 127) { finish(new Error('Use a valid provider token.')); return; }
          value += String.fromCharCode(byte);
          if (value.length > 16384) { finish(new Error('Use a valid provider token.')); return; }
        }
      };
      process.stdout.write(prompt);
      input.setRawMode(true);
      input.resume();
      input.on('data', onData);
    }),
  };
}

function manualToken(env: NodeJS.ProcessEnv, platform: Exclude<OAuthPlatform, 'youtube'>, prompt: ManualTokenPrompt): Promise<string> {
  const prefix = PREFIX[platform];
  if (env[`${prefix}_MANUAL_TOKEN_PROVISIONING`] !== 'true') {
    throw new Error(`Set ${prefix}_MANUAL_TOKEN_PROVISIONING=true only after completing that provider's registered HTTPS OAuth flow.`);
  }
  if (!prompt.isInteractive()) throw new Error('Manual token provisioning requires an interactive TTY.');
  return prompt.readHidden(`Paste the ${platform} access token (input is hidden; press Return): `).then((value) => {
    const token = value.trim();
    if (token.length < 16 || token.length > 16384 || /[\u0000-\u001f\u007f]/.test(token)) throw new Error('Use a valid provider token.');
    return token;
  });
}

export async function connectPlatform(platform: OAuthPlatform, env: NodeJS.ProcessEnv = process.env, keychain: KeychainWriter = new Keychain(), prompt: ManualTokenPrompt = terminalPrompt()): Promise<{ expiresAt: string }> {
  if (platform !== 'youtube') {
    const accessToken = await manualToken(env, platform, prompt);
    await keychain.set(platform, JSON.stringify({ access_token: accessToken } satisfies StoredToken));
    return { expiresAt: 'provider did not provide an expiry' };
  }
  const config = loadOAuthConfig(platform, env);
  const csrf = base64url(randomBytes(32));
  const codeVerifier = config.usePkce ? verifier() : undefined;
  const auth = authorizationUrl(config, csrf, codeVerifier ? challenge(codeVerifier) : undefined);
  // The listener starts before the browser opens, closing the callback race.
  const code = await receiveCallback(config, csrf, auth);
  const token = await exchangeCode(config, code, codeVerifier);
  if (token.refresh_token) Object.assign(token, { token_url: config.tokenUrl.href, client_id: config.clientId, ...(config.clientSecret ? { client_secret: config.clientSecret } : {}) });
  await keychain.set(platform, JSON.stringify(token));
  return { expiresAt: token.expires_at ?? 'provider did not provide an expiry' };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 1) throw new Error('Usage: node --experimental-strip-types scripts/connect-platform.ts <instagram|tiktok|youtube>');
  const result = await connectPlatform(parsePlatform(args[0]));
  console.log(`Connected. Token stored in macOS Keychain. Expiry: ${result.expiresAt}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Could not connect the platform.');
    process.exitCode = 1;
  });
}
