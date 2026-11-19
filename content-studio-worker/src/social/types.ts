import { setTimeout as wait } from 'node:timers/promises';
import { Keychain } from '../keychain.ts';
import type { Platform, PublicationResult } from '../client.ts';
import type { PublicationRequest } from '../worker.ts';

export type FailureKind = 'retryable' | 'action-required' | 'uncertain';
export function classifyPlatformError(status: number): Exclude<FailureKind, 'uncertain'> {
  return [408, 425, 429].includes(status) || (status >= 500 && status <= 599) ? 'retryable' : 'action-required';
}
export class SocialError extends Error {
  readonly kind: FailureKind;
  constructor(kind: FailureKind, message = 'The provider rejected this publication. Check its account, permissions, and publication settings.') {
    super(message); this.name = 'SocialError'; this.kind = kind;
  }
}
export const uncertain = () => new SocialError('uncertain', 'The provider submission outcome is uncertain. Inspect the provider account before retrying; this publication will not be submitted again automatically.');
export interface SocialDependencies {
  env?: NodeJS.ProcessEnv;
  keychain?: Pick<Keychain, 'get' | 'set'>;
  fetcher?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
  probeDuration?: (path: string) => Promise<number>;
}
type Phase = 'instagram-creating' | 'instagram-container' | 'instagram-publishing' | 'instagram-media' | 'tiktok-initializing' | 'tiktok-upload' | 'tiktok-post' | 'youtube-starting' | 'youtube-session' | 'youtube-video' | 'done';
export interface Checkpoint { version: 1; platform: Platform; phase: Phase; operationId?: string; uploadUrl?: string; size?: number; result?: PublicationResult }
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SocialError('action-required', 'The provider returned an invalid response.');
  return value as Record<string, unknown>;
}
export function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new SocialError('action-required', 'The provider returned an invalid operation identifier.');
  return value;
}
// TikTok documents opaque IDs such as `v_pub_file~v2-1.123456789`. Keep this
// provider-specific: these values are sent only in JSON request bodies, never
// interpolated into paths or shell commands.
export function tiktokPublishId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9._~-]{1,256}$/.test(value)) throw new SocialError('action-required', 'TikTok returned an invalid publish identifier.');
  return value;
}
export function httpsUrl(raw: unknown, hosts?: readonly string[]): URL {
  if (typeof raw !== 'string') throw new SocialError('action-required', 'Set a valid provider HTTPS URL.');
  let url: URL;
  try { url = new URL(raw); } catch { throw new SocialError('action-required', 'Set a valid provider HTTPS URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || (url.port && url.port !== '443') || (hosts && !hosts.includes(url.hostname))) throw new SocialError('action-required', 'Set a valid provider HTTPS URL.');
  return url;
}
export function providerOrigin(raw: string, hosts: readonly string[]): string {
  const url = httpsUrl(raw, hosts);
  if (url.pathname !== '/' || url.search) throw new SocialError('action-required', 'Set a provider API origin without a path or query.');
  return url.origin;
}
export function caption(request: PublicationRequest, max: number): string {
  const copy = request.job.copy_json;
  if (typeof copy.title !== 'string' || !copy.title.trim() || typeof copy.caption !== 'string' || !copy.caption.trim() || !Array.isArray(copy.hashtags) || !copy.hashtags.every((tag) => typeof tag === 'string' && /^#?[\p{L}\p{N}_]{1,100}$/u.test(tag))) throw new SocialError('action-required', 'Review the publication copy and hashtags.');
  const text = [copy.caption, copy.hashtags.map((tag) => tag.startsWith('#') ? tag : `#${tag}`).join(' ')].filter(Boolean).join('\n');
  if (text.length > max) throw new SocialError('action-required', 'The caption is too long for this provider.');
  return text;
}

export class SocialContext {
  readonly env: NodeJS.ProcessEnv;
  readonly deps: SocialDependencies;
  readonly platform: Platform;
  private store: Pick<Keychain, 'get' | 'set'>;
  private account: string;
  private deadline: number;
  checkpoint: Checkpoint | null = null;
  constructor(request: PublicationRequest, deps: SocialDependencies) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(request.job.id) || !['instagram', 'tiktok', 'youtube'].includes(request.job.platform)) throw new SocialError('action-required', 'Invalid publication.');
    this.platform = request.job.platform; this.env = deps.env ?? process.env; this.deps = deps; this.store = deps.keychain ?? new Keychain(); this.account = `publication-${request.job.id}`;
    // Stay within the database's 15 minute lease, including downloads and reports.
    this.deadline = this.now() + 10 * 60_000;
  }
  private now(): number { return (this.deps.now ?? Date.now)(); }
  async load(): Promise<void> {
    let raw: string | null;
    try { raw = await this.store.get(this.account); } catch { throw new SocialError('action-required', 'Could not read the local publication recovery record.'); }
    if (!raw) return;
    try {
      const saved = object(JSON.parse(raw));
      if (saved.version !== 1 || saved.platform !== this.platform || typeof saved.phase !== 'string' || !(saved.phase === 'done' || saved.phase.startsWith(`${this.platform}-`))) throw new Error();
      const phases: Phase[] = ['instagram-creating', 'instagram-container', 'instagram-publishing', 'instagram-media', 'tiktok-initializing', 'tiktok-upload', 'tiktok-post', 'youtube-starting', 'youtube-session', 'youtube-video', 'done'];
      if (!phases.includes(saved.phase as Phase)) throw new Error();
      if (saved.operationId !== undefined) (this.platform === 'tiktok' ? tiktokPublishId : identifier)(saved.operationId);
      if (saved.phase === 'done') {
        const result = object(saved.result);
        (this.platform === 'tiktok' ? tiktokPublishId : identifier)(result.externalId);
        if (typeof result.published !== 'boolean' || (result.publicUrl !== undefined && typeof result.publicUrl !== 'string') || (result.visibility !== undefined && typeof result.visibility !== 'string')) throw new Error();
      }
      this.checkpoint = saved as unknown as Checkpoint;
    } catch { throw uncertain(); }
  }
  async save(update: Omit<Checkpoint, 'version' | 'platform'>): Promise<void> {
    const value: Checkpoint = { version: 1, platform: this.platform, ...update };
    try { await this.store.set(this.account, JSON.stringify(value)); } catch { throw uncertain(); }
    this.checkpoint = value;
  }
  async token(): Promise<string> {
    let token: string | null;
    try { token = await this.store.get(this.platform); } catch { throw new SocialError('action-required', 'Could not read the connected account from macOS Keychain.'); }
    // The connection utility may persist the OAuth response in Keychain.
    if (token?.startsWith('{')) {
      let saved: Record<string, unknown> | null = null;
      try { saved = object(JSON.parse(token)); } catch { token = null; }
      if (saved) {
        // Refresh well before expiry so a long upload/poll keeps a valid token.
        if (typeof saved.expires_at === 'string' && !(Date.parse(saved.expires_at) - this.now() > 15 * 60_000)) return this.refresh(saved);
        token = typeof saved.access_token === 'string' ? saved.access_token : null;
      }
    }
    return this.validToken(token);
  }
  private validToken(token: unknown): string {
    if (typeof token !== 'string' || !token.trim() || token.length > 16384 || /[\r\n\0]/.test(token)) throw new SocialError('action-required', `Connect the ${this.platform} account in macOS Keychain.`);
    return token;
  }
  private async refresh(saved: Record<string, unknown>): Promise<string> {
    const reconnect = () => new SocialError('action-required', `The ${this.platform} access token expired. Reconnect the account with scripts/connect-platform.ts.`);
    // Only YouTube's loopback OAuth flow stores a refresh token and its endpoint.
    if (this.platform !== 'youtube' || typeof saved.refresh_token !== 'string' || !saved.refresh_token || typeof saved.client_id !== 'string' || !saved.client_id) throw reconnect();
    let url: URL;
    try { url = httpsUrl(saved.token_url, ['oauth2.googleapis.com']); } catch { throw reconnect(); }
    const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: saved.refresh_token, client_id: saved.client_id });
    if (typeof saved.client_secret === 'string' && saved.client_secret) body.set('client_secret', saved.client_secret);
    let response: Response;
    try { response = await (this.deps.fetcher ?? fetch)(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, redirect: 'error', signal: this.timeout() }); }
    catch (error) { if (error instanceof SocialError) throw error; throw new SocialError('retryable', 'Could not reach the provider to refresh its access token.'); }
    if (!response.ok) {
      if (classifyPlatformError(response.status) === 'retryable') throw new SocialError('retryable', 'The provider could not refresh its access token. Retry later.');
      throw reconnect();
    }
    let data: Record<string, unknown>;
    try { data = object(await response.json()); } catch { throw reconnect(); }
    const accessToken = this.validToken(data.access_token);
    const expiresIn = typeof data.expires_in === 'number' && Number.isSafeInteger(data.expires_in) && data.expires_in > 0 ? data.expires_in : 3600;
    const updated = { ...saved, access_token: accessToken, expires_at: new Date(this.now() + expiresIn * 1000).toISOString(), ...(typeof data.refresh_token === 'string' && data.refresh_token ? { refresh_token: data.refresh_token } : {}) };
    // A failed write only means the next job refreshes again; Google keeps the refresh token valid.
    try { await this.store.set(this.platform, JSON.stringify(updated)); } catch { /* keep the fresh token for this job */ }
    return accessToken;
  }
  private timeout(): AbortSignal {
    const remaining = this.deadline - this.now();
    if (remaining <= 0) throw new SocialError('retryable', 'The provider is still processing this publication. Retry to check the existing operation.');
    return AbortSignal.timeout(Math.max(1, Math.min(30_000, remaining)));
  }
  async pause(milliseconds: number): Promise<void> {
    if (this.deadline - this.now() <= milliseconds) throw new SocialError('retryable', 'The provider is still processing this publication. Retry to check the existing operation.');
    await (this.deps.sleep ?? (async (ms) => { await wait(ms); }))(milliseconds);
  }
  async request(url: URL, token: string | null, init: RequestInit = {}, mutation = false): Promise<Response> {
    const headers = new Headers(init.headers); if (token !== null) headers.set('authorization', `Bearer ${token}`);
    let response: Response;
    try { response = await (this.deps.fetcher ?? fetch)(url, { ...init, headers, redirect: 'error', signal: this.timeout() }); }
    catch (error) { if (error instanceof SocialError) throw error; if (mutation) throw uncertain(); throw new SocialError('retryable', 'Could not reach the provider. Retry to check the existing operation.'); }
    if (!response.ok && response.status !== 308) {
      const kind = classifyPlatformError(response.status);
      if (mutation && kind === 'retryable') throw uncertain();
      throw new SocialError(kind);
    }
    return response;
  }
  async json(url: URL, token: string, init: RequestInit = {}, mutation = false): Promise<Record<string, unknown>> {
    const response = await this.request(url, token, init, mutation);
    let body: Record<string, unknown>;
    try { body = object(await response.json()); } catch { if (mutation) throw uncertain(); throw new SocialError('action-required', 'The provider returned an invalid response.'); }
    if (body.error) {
      const error = object(body.error);
      if (error.code !== 'ok') {
        const transient = error.is_transient === true || ['rate_limit_exceeded', 'internal_error'].includes(String(error.code));
        if (mutation && transient) throw uncertain();
        throw new SocialError(transient ? 'retryable' : 'action-required');
      }
    }
    return body;
  }
  async read(url: URL, token: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.json(url, token, init); }
      catch (error) { if (!(error instanceof SocialError) || error.kind !== 'retryable' || attempt === 3) throw error; await this.pause(1000 * 2 ** attempt); }
    }
  }
  async done(result: PublicationResult): Promise<PublicationResult> { await this.save({ phase: 'done', result }); return result; }
}

export const jsonPost = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json; charset=UTF-8' }, body: JSON.stringify(body) });
export const pending = () => new SocialError('retryable', 'The provider is still processing this publication. Retry to check the existing operation.');
