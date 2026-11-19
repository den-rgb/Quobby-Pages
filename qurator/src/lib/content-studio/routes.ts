// Framework-independent handlers keep authorization and workflow rules testable.
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { assertCampaignInput, nextPublicationStatus } from './state.ts';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { ContentStudioConflictError, ContentStudioInputError, MemeGenerationError } from './errors.ts';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { MEME_TEMPLATE_ID } from './types.ts';
import type { MemeClipRow, AssetRow, AuditActor, CampaignRow, Platform, PublicationCopy, PublicationRow, PublicationStatus, RenderRow, WorkerHeartbeat } from './types';
import type * as Server from './server';

export interface RouteResult { status: number; body: unknown }
type Admin = { id: string };
type RequireAdmin = () => Promise<Admin | false | null>;
type RequireMachine = (request: Request) => boolean | Promise<boolean>;
export interface HeartbeatInput { machineId: string; version: string; currentJobId: string | null; statusMessage: string | null }
export interface StudioStore {
  createCampaign: typeof Server.createCampaign;
  generateMemeCampaign: typeof Server.generateMemeCampaign;
  listQueue: typeof Server.listQueue;
  createSignedUploadUrl: typeof Server.createSignedUploadUrl;
  createSignedDownloadUrl: typeof Server.createSignedDownloadUrl;
  createSignedRenderUploadUrl: typeof Server.createSignedRenderUploadUrl;
  createAsset: typeof Server.createAsset;
  claimJob: typeof Server.claimJob;
  transitionCampaign: typeof Server.transitionCampaign;
  transitionRender: typeof Server.transitionRender;
  completeRender: typeof Server.completeRender;
  setApprovalPolicy: typeof Server.setApprovalPolicy;
  reviewCampaign: typeof Server.reviewCampaign;
  retryPublication: typeof Server.retryPublication;
  transitionPublication: typeof Server.transitionPublication;
  getCampaign(id: string): Promise<CampaignRow | null>;
  getRender(id: string): Promise<RenderRow | null>;
  getPublication(id: string): Promise<PublicationRow | null>;
  getAsset(id: string): Promise<AssetRow | null>;
  listCampaignRenders(campaignId: string): Promise<RenderRow[]>;
  listPublications(renderId: string): Promise<PublicationRow[]>;
  listWorkerHeartbeats(): Promise<WorkerHeartbeat[]>;
  listMemeClips(): Promise<MemeClipRow[]>;
  addMemeClip(input: { provider: string; videoId: number; label: string }, createdBy: string): Promise<MemeClipRow>;
  setMemeClipActive(id: string, active: boolean): Promise<MemeClipRow>;
  generateCampaignCopy(campaignId: string, adminId: string): Promise<PublicationRow[]>;
  completeRenderAsAdmin(renderId: string, adminId: string, durationMs: number): Promise<RenderRow>;
  publishPublicationManually(publicationId: string, adminId: string, publicUrl: string | null): Promise<PublicationRow>;
  upsertHeartbeat(input: HeartbeatInput): Promise<void>;
  confirmRenderOutput(renderId: string): Promise<void>;
}
export interface RouteDependencies {
  requireAdmin: RequireAdmin;
  requireMachine: RequireMachine;
  store: StudioStore;
  now?: () => Date;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEDIA_TYPES = new Set(['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp', 'audio/wav', 'audio/mpeg', 'audio/aac']);
const EDITABLE = new Set<PublicationStatus>(['draft', 'review', 'queued', 'scheduled']);
const TERMINAL = new Set<PublicationStatus>(['published', 'failed', 'rejected']);
const MAX_JSON_BYTES = 16_384;
class RouteError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
function result(status: number, body: unknown): RouteResult { return { status, body }; }
function fail(status: number, message: string): never { throw new RouteError(status, message); }

export async function authorizeAdmin(requireAdmin: RequireAdmin): Promise<Admin | RouteResult> {
  const user = await requireAdmin();
  return user || result(403, { error: 'Forbidden' });
}
export async function authorizeMachine(request: Request, requireMachine: RequireMachine): Promise<RouteResult | null> {
  // Always invoke the real checker: an absent configured secret must fail closed.
  const allowed = await requireMachine(request);
  if (!request.headers.get('x-content-studio-machine-token')) return result(401, { error: 'Unauthorized' });
  return allowed ? null : result(403, { error: 'Forbidden' });
}
export function assertPublicationAction(action: 'approved' | 'rejected', status: PublicationStatus): void {
  if (action === 'approved' && status !== 'review') fail(409, 'Only a review publication can be approved');
}
function fields(value: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) fail(400, 'Unknown request field');
}
function text(value: unknown, name: string, max: number, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || value.length > max) fail(400, `Invalid ${name}`);
  return value;
}
function uuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) fail(400, 'A valid UUID is required');
  return value.toLowerCase();
}
function machineId(body: Record<string, unknown>): string { return text(body.machineId, 'machineId', 200); }
async function json(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') fail(415, 'Use application/json');
  if (Number(request.headers.get('content-length')) > MAX_JSON_BYTES) fail(413, 'JSON request is too large');
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'A JSON object is required');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > MAX_JSON_BYTES) { await reader.cancel(); fail(413, 'JSON request is too large'); }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail(400, 'Invalid JSON'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'A JSON object is required');
  return value as Record<string, unknown>;
}
function owns(campaign: CampaignRow | null, user: Admin): CampaignRow {
  if (!campaign) fail(404, 'Campaign not found');
  if (campaign.created_by !== user.id) fail(403, 'Forbidden');
  return campaign;
}
function found<T>(value: T | null, name: string): T { return value ?? fail(404, `${name} not found`); }
function lease(job: RenderRow | PublicationRow, id: string, activeStatus: 'rendering' | 'publishing', now: Date): void {
  if (job.status !== activeStatus || job.lease_owner !== id || !job.lease_expires_at || !(Date.parse(job.lease_expires_at) > now.getTime())) fail(403, 'Worker must own the active lease');
}
function outputPath(renderId: string): string { return `renders/${renderId}/output.mp4`; }
function rendered(render: RenderRow): boolean {
  return render.output_path === outputPath(render.id) && !['draft', 'queued', 'rendering', 'failed', 'rejected'].includes(render.status);
}
function publicationStatus(campaign: CampaignRow, render: RenderRow, scheduledFor: string | null): PublicationStatus {
  if (!rendered(render) && render.status !== 'failed') return 'draft';
  return nextPublicationStatus({ requiresApproval: campaign.requires_approval, approvedAt: campaign.approved_at, renderSucceeded: rendered(render), scheduledFor });
}
function copyPatch(body: Record<string, unknown>, previous: PublicationCopy): PublicationCopy {
  const copy = { ...previous };
  if (body.title !== undefined) copy.title = text(body.title, 'title', 100);
  if (body.caption !== undefined) copy.caption = text(body.caption, 'caption', 2200, true);
  if (body.hashtags !== undefined) {
    if (!Array.isArray(body.hashtags) || body.hashtags.length > 30 || !body.hashtags.every((tag) => typeof tag === 'string' && tag.trim() && tag.length <= 100)) fail(400, 'Invalid hashtags');
    copy.hashtags = body.hashtags;
  }
  if (body.privacy !== undefined) {
    if (typeof body.privacy !== 'string' || !['public', 'private', 'unlisted', 'PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'].includes(body.privacy)) fail(400, 'Invalid privacy');
    copy.privacy = body.privacy;
  }
  return copy;
}
function errorFields(body: Record<string, unknown>): { errorCode?: string | null; errorMessage?: string | null } {
  const output: { errorCode?: string | null; errorMessage?: string | null } = {};
  for (const field of ['errorCode', 'errorMessage'] as const) {
    if (body[field] !== undefined) output[field] = body[field] === null ? null : text(body[field], field, field === 'errorCode' ? 100 : 2000);
  }
  return output;
}

export function createContentStudioHandlers(deps: RouteDependencies) {
  const { store } = deps;
  const now = deps.now ?? (() => new Date());
  type Handler = (request: Request, id?: string) => Promise<RouteResult>;
  function admin(work: (request: Request, user: Admin, id?: string) => Promise<RouteResult>): Handler {
    return async (request, id) => safely(async () => {
      const auth = await authorizeAdmin(deps.requireAdmin);
      if ('status' in auth) return auth;
      return work(request, auth, id);
    });
  }
  function machine(work: Handler): Handler {
    return async (request, id) => safely(async () => {
      const denied = await authorizeMachine(request, deps.requireMachine);
      return denied ?? work(request, id);
    });
  }
  async function safely(work: () => Promise<RouteResult>): Promise<RouteResult> {
    try { return await work(); } catch (error) {
      if (error instanceof RouteError) return result(error.status, { error: error.message });
      if (error instanceof ContentStudioConflictError) return result(409, { error: error.message });
      if (error instanceof ContentStudioInputError) return result(400, { error: error.message });
      if (error instanceof MemeGenerationError) return result(502, { error: error.message });
      // Database and Storage errors may contain credentials, URLs, or internals.
      return result(500, { error: 'Content Studio request failed' });
    }
  }
  return {
    listCampaigns: admin(async () => {
      const [campaigns, workers] = await Promise.all([store.listQueue(), store.listWorkerHeartbeats()]);
      return result(200, { campaigns, workers });
    }),
    // The admin's browser renders memes: sign the canonical output, verify it
    // landed, then complete the render without any worker lease.
    // Everything the browser renderer needs: the immutable spec and signed
    // source files (recording, images, music). Voice is synthesized separately.
    renderSource: admin(async (_request, user, id) => {
      const render = found(await store.getRender(uuid(id)), 'Render');
      const campaign = owns(await store.getCampaign(render.campaign_id), user);
      const assets = [];
      for (const assetId of render.render_spec.sourceAssetIds) {
        const asset = found(await store.getAsset(assetId), 'Asset');
        if (asset.campaign_id !== render.campaign_id) fail(403, 'Forbidden');
        assets.push({ id: asset.id, mimeType: asset.mime_type, url: await store.createSignedDownloadUrl(asset.storage_path) });
      }
      return result(200, { campaignId: campaign.id, spec: render.render_spec, assets });
    }),
    renderUpload: admin(async (_request, user, id) => {
      const render = found(await store.getRender(uuid(id)), 'Render');
      owns(await store.getCampaign(render.campaign_id), user);
      if (!['draft', 'queued', 'rendering', 'failed'].includes(render.status)) fail(409, 'Render output is already finalised');
      return result(200, await store.createSignedRenderUploadUrl(render.id));
    }),
    completeBrowserRender: admin(async (request, user, id) => {
      const body = await json(request);
      fields(body, ['durationMs']);
      if (!Number.isSafeInteger(body.durationMs) || Number(body.durationMs) < 0 || Number(body.durationMs) > 3_600_000) fail(400, 'A render duration is required');
      const render = found(await store.getRender(uuid(id)), 'Render');
      owns(await store.getCampaign(render.campaign_id), user);
      await store.confirmRenderOutput(render.id);
      return result(200, { render: await store.completeRenderAsAdmin(render.id, user.id, Number(body.durationMs)) });
    }),
    publishManual: admin(async (request, user, id) => {
      const body = await json(request);
      fields(body, ['publicUrl']);
      let publicUrl: string | null = null;
      if (body.publicUrl !== undefined && body.publicUrl !== '') {
        if (typeof body.publicUrl !== 'string') fail(400, 'Invalid publicUrl');
        try { const url = new URL(body.publicUrl); if (url.protocol !== 'https:' || url.username || url.password) fail(400, 'Only https post links can be saved'); } catch { fail(400, 'Invalid publicUrl'); }
        publicUrl = body.publicUrl;
      }
      const publication = found(await store.getPublication(uuid(id)), 'Publication');
      const render = found(await store.getRender(publication.render_id), 'Render');
      owns(await store.getCampaign(render.campaign_id), user);
      return result(200, { publication: await store.publishPublicationManually(publication.id, user.id, publicUrl) });
    }),
    listMemeClips: admin(async () => result(200, { clips: await store.listMemeClips() })),
    addMemeClip: admin(async (request, user) => {
      const body = await json(request);
      fields(body, ['provider', 'videoId', 'label']);
      if (body.provider !== 'pixabay' && body.provider !== 'pexels') fail(400, 'Choose Pixabay or Pexels');
      if (!Number.isSafeInteger(body.videoId) || Number(body.videoId) <= 0 || Number(body.videoId) > Number.MAX_SAFE_INTEGER) fail(400, 'Enter a valid video ID');
      const label = text(body.label, 'label', 80);
      const clip = await store.addMemeClip({ provider: body.provider, videoId: Number(body.videoId), label }, user.id);
      return result(201, { clip });
    }),
    setMemeClipActive: admin(async (request, _user, id) => {
      const body = await json(request);
      fields(body, ['active']);
      const clipId = uuid(id);
      if (typeof body.active !== 'boolean') fail(400, 'Choose activate or deactivate');
      return result(200, { clip: await store.setMemeClipActive(clipId, body.active) });
    }),
    // Admins re-render or download the source clip; the browser does the work.
    assetDownload: admin(async (_request, user, id) => {
      const asset = found(await store.getAsset(uuid(id)), 'Asset');
      if (!asset.campaign_id) fail(404, 'Asset not found');
      owns(await store.getCampaign(asset.campaign_id), user);
      return result(200, { signedUrl: await store.createSignedDownloadUrl(asset.storage_path) });
    }),
    generateCopy: admin(async (_request, user, id) => {
      const campaign = owns(await store.getCampaign(uuid(id)), user);
      if (['published', 'rejected'].includes(campaign.status)) fail(409, 'Campaign copy can no longer be generated');
      // Loads the publications, asks the model, and rewrites unpublished copies.
      return result(200, { publications: await store.generateCampaignCopy(campaign.id, user.id) });
    }),
    previewRender: admin(async (request, user, id) => {
      const render = found(await store.getRender(uuid(id)), 'Render');
      owns(await store.getCampaign(render.campaign_id), user);
      if (!rendered(render)) fail(409, 'Render output is unavailable');
      const download = new URL(request.url).searchParams.get('download');
      const name = download ? `${download.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 60) || 'quobby'}.mp4` : undefined;
      return result(200, { signedUrl: await store.createSignedDownloadUrl(outputPath(render.id), name), expiresIn: 300 });
    }),
    createCampaign: admin(async (request, user) => {
      const body = await json(request);
      try { assertCampaignInput(body, now()); } catch (error) { fail(400, error instanceof Error ? error.message : 'Invalid campaign'); }
      const created = await store.createCampaign(body, user.id);
      return result(201, { campaignId: created.campaign.id, renderId: created.render.id, publicationIds: created.publications.map((row) => row.id) });
    }),
    generateMeme: admin(async (request, user) => {
      const body = await json(request);
      fields(body, ['theme', 'platforms', 'tiktokPrivateTest', 'requiresApproval', 'scheduledFor']);
      const theme = body.theme === undefined || body.theme === '' ? undefined : text(body.theme, 'theme', 60);
      const targeting = { ...body };
      delete targeting.theme;
      // Validate targeting with placeholder copy before spending stock or AI API calls.
      try { assertCampaignInput({ templateId: MEME_TEMPLATE_ID, title: 'Meme', hook: 'Meme', cta: 'Quobby', voiceText: '', sourceAssetIds: ['00000000-0000-4000-8000-000000000000'], ...targeting }, now()); }
      catch (error) { fail(400, error instanceof Error ? error.message : 'Invalid meme request'); }
      const created = await store.generateMemeCampaign({
        theme, platforms: body.platforms as Platform[], requiresApproval: body.requiresApproval as boolean,
        ...(body.tiktokPrivateTest !== undefined ? { tiktokPrivateTest: body.tiktokPrivateTest as boolean } : {}),
        scheduledFor: (body.scheduledFor as string | null | undefined) ?? null,
      }, user.id);
      // The browser renders the returned clip with the returned copy.
      return result(201, created);
    }),
    adminAsset: admin(async (request) => {
      const body = await json(request);
      fields(body, ['action', 'filename', 'mimeType', 'sizeBytes', 'storagePath']);
      const action = body.action ?? 'upload';
      if (action !== 'upload' && action !== 'confirm') fail(400, 'Choose upload or confirm');
      const filename = text(body.filename, 'filename', 255);
      const mimeType = text(body.mimeType, 'mimeType', 100);
      if (!MEDIA_TYPES.has(mimeType)) fail(400, 'Choose a supported media type');
      if (!Number.isSafeInteger(body.sizeBytes) || Number(body.sizeBytes) <= 0 || Number(body.sizeBytes) > 262144000) fail(400, 'Asset size must be between 1 byte and 250 MB');
      if (action === 'upload') {
        if (body.storagePath !== undefined) fail(400, 'Upload paths are generated by the server');
        return result(201, await store.createSignedUploadUrl(filename));
      }
      const storagePath = text(body.storagePath, 'storagePath', 512);
      if (!/^uploads\/[0-9a-f-]{36}\/[a-zA-Z0-9._-]+$/.test(storagePath)) fail(400, 'Use a generated upload path');
      const asset = await store.createAsset({ filename, mimeType, sizeBytes: Number(body.sizeBytes), storagePath });
      return result(201, { asset });
    }),
    reviewCampaign: admin(async (request, user, id) => {
      const body = await json(request);
      fields(body, ['action']);
      if (body.action !== 'approve' && body.action !== 'reject') fail(400, 'Choose approve or reject');
      const campaign = owns(await store.getCampaign(uuid(id)), user);
      if (campaign.status !== 'review') fail(409, 'Only a review campaign can be reviewed');
      // SQL locks campaign -> render -> publication and updates every status
      // plus its audits in one transaction; a partial approval is unrecoverable.
      const updated = await store.reviewCampaign(campaign.id, { adminId: user.id, action: body.action });
      return result(200, { campaign: updated });
    }),
    patchPublication: admin(async (request, user, id) => {
      const body = await json(request);
      fields(body, ['scheduledFor', 'title', 'caption', 'hashtags', 'privacy', 'requiresApproval']);
      if (Object.keys(body).length === 0) fail(400, 'Choose fields to update');
      let publication = found(await store.getPublication(uuid(id)), 'Publication');
      if (!EDITABLE.has(publication.status)) fail(409, 'Publication cannot be edited in its current state');
      let render = found(await store.getRender(publication.render_id), 'Render');
      let campaign = owns(await store.getCampaign(render.campaign_id), user);
      if (TERMINAL.has(campaign.status)) fail(409, 'Campaign cannot be edited in its current state');
      let copy = copyPatch(body, publication.copy_json);
      if (publication.platform === 'tiktok' && copy.privacy !== 'SELF_ONLY') fail(400, 'TikTok is limited to the acknowledged SELF_ONLY private test.');
      const requiresApproval = body.requiresApproval === undefined ? campaign.requires_approval : body.requiresApproval;
      if (typeof requiresApproval !== 'boolean') fail(400, 'Invalid requiresApproval');
      let scheduledFor = body.scheduledFor === undefined ? publication.scheduled_for : body.scheduledFor;
      // Reuse domain schedule validation, including timezone and calendar rules.
      const { templateId, title, hook, cta, voiceText, sourceAssetIds } = campaign.render_spec;
      try { assertCampaignInput({ templateId, title, hook, cta, voiceText, sourceAssetIds, platforms: [publication.platform], ...(publication.platform === 'tiktok' ? { tiktokPrivateTest: publication.copy_json.privacy === 'SELF_ONLY' } : {}), requiresApproval, scheduledFor: body.scheduledFor === undefined ? undefined : scheduledFor }, now()); }
      catch (error) { fail(400, error instanceof Error ? error.message : 'Invalid schedule'); }
      const actor: AuditActor = { type: 'admin', id: user.id };
      if (body.requiresApproval !== undefined) {
        campaign = await store.setApprovalPolicy(campaign.id, { adminId: user.id, requiresApproval, expectedStatuses: [campaign.status] });
        // The transaction may have observed a render completion and changed the
        // publication state. Refresh before applying any separate copy edit.
        publication = found(await store.getPublication(publication.id), 'Publication');
        if (!EDITABLE.has(publication.status)) fail(409, 'Publication cannot be edited in its current state');
        if (Object.keys(body).length === 1) return result(200, { publication });
        render = found(await store.getRender(publication.render_id), 'Render');
        copy = copyPatch(body, publication.copy_json);
        if (publication.platform === 'tiktok' && copy.privacy !== 'SELF_ONLY') fail(400, 'TikTok is limited to the acknowledged SELF_ONLY private test.');
        scheduledFor = body.scheduledFor === undefined ? publication.scheduled_for : body.scheduledFor;
      }
      const status = publicationStatus(campaign, render, scheduledFor as string | null);
      const updated = await store.transitionPublication(publication.id, { status, expectedStatuses: [publication.status], scheduledFor: scheduledFor as string | null, copy, actor, eventName: 'publication_edited' });
      return result(200, { publication: updated });
    }),
    retryPublication: admin(async (_request, user, id) => {
      const publication = found(await store.getPublication(uuid(id)), 'Publication');
      const render = found(await store.getRender(publication.render_id), 'Render');
      owns(await store.getCampaign(render.campaign_id), user);
      const updated = await store.retryPublication(publication.id, { adminId: user.id });
      return result(200, { publication: updated });
    }),
    heartbeat: machine(async (request) => {
      const body = await json(request);
      fields(body, ['machineId', 'version', 'currentJobId', 'statusMessage']);
      const input: HeartbeatInput = { machineId: machineId(body), version: text(body.version, 'version', 100), currentJobId: body.currentJobId == null ? null : uuid(body.currentJobId), statusMessage: body.statusMessage == null ? null : text(body.statusMessage, 'statusMessage', 1000, true) };
      await store.upsertHeartbeat(input);
      return result(200, { ok: true });
    }),
    claim: machine(async (request) => {
      const body = await json(request);
      fields(body, ['machineId']);
      return result(200, { job: await store.claimJob(machineId(body)) });
    }),
    machineAsset: machine(async (request) => {
      const body = await json(request);
      fields(body, ['action', 'machineId', 'jobKind', 'jobId', 'assetId']);
      if (body.action !== 'download' && body.action !== 'upload') fail(400, 'Choose download or upload');
      if (body.jobKind !== 'render' && body.jobKind !== 'publication') fail(400, 'Choose a job kind');
      const id = uuid(body.jobId);
      const worker = machineId(body);
      if (body.jobKind === 'publication') {
        if (body.action !== 'download' || body.assetId !== undefined) fail(400, 'Publications may only download their rendered output');
        const publication = found(await store.getPublication(id), 'Publication');
        lease(publication, worker, 'publishing', now());
        const render = found(await store.getRender(publication.render_id), 'Render');
        if (render.output_path !== outputPath(render.id)) fail(409, 'Render output is unavailable');
        return result(200, { signedUrl: await store.createSignedDownloadUrl(render.output_path) });
      }
      const render = found(await store.getRender(id), 'Render');
      lease(render, worker, 'rendering', now());
      if (body.action === 'upload') {
        if (body.assetId !== undefined) fail(400, 'Render output paths are generated by the server');
        return result(200, await store.createSignedRenderUploadUrl(render.id));
      }
      const assetId = uuid(body.assetId);
      if (!render.render_spec.sourceAssetIds.includes(assetId)) fail(403, 'Forbidden');
      const asset = found(await store.getAsset(assetId), 'Asset');
      if (asset.campaign_id !== render.campaign_id || asset.id !== assetId) fail(403, 'Forbidden');
      return result(200, { signedUrl: await store.createSignedDownloadUrl(asset.storage_path) });
    }),
    updateRender: machine(async (request, id) => {
      const body = await json(request);
      fields(body, ['machineId', 'status', 'outputPath', 'durationMs', 'errorCode', 'errorMessage']);
      const renderId = uuid(id);
      const worker = machineId(body);
      if (body.status !== 'review' && body.status !== 'failed') fail(400, 'Choose review or failed');
      const error = errorFields(body);
      if (body.outputPath !== undefined && body.outputPath !== outputPath(renderId)) fail(400, 'Use the generated render output path');
      if (body.durationMs !== undefined && (!Number.isSafeInteger(body.durationMs) || Number(body.durationMs) < 0 || Number(body.durationMs) > 2147483647)) fail(400, 'Invalid durationMs');
      if (body.status === 'review' && (body.outputPath !== outputPath(renderId) || body.durationMs === undefined)) fail(400, 'Completed renders require outputPath and durationMs');
      const render = found(await store.getRender(renderId), 'Render');
      lease(render, worker, 'rendering', now());
      if (body.status === 'review') await store.confirmRenderOutput(render.id);
      // SQL locks and reads the current campaign approval policy, completes the
      // leased render, and updates/audits its publications in one transaction.
      const updated = await store.completeRender(render.id, { machineId: worker, status: body.status, outputPath: body.outputPath as string | undefined, durationMs: body.durationMs as number | undefined, ...error });
      return result(200, { render: updated });
    }),
    updatePublication: machine(async (request, id) => {
      const body = await json(request);
      fields(body, ['machineId', 'status', 'externalPostId', 'publicUrl', 'errorCode', 'errorMessage']);
      const publicationId = uuid(id);
      const worker = machineId(body);
      if (!['publishing', 'published', 'failed'].includes(String(body.status))) fail(400, 'Choose publishing, published, or failed');
      const error = errorFields(body);
      const externalPostId = body.externalPostId === undefined ? undefined : text(body.externalPostId, 'externalPostId', 512);
      let publicUrl: string | undefined;
      if (body.publicUrl !== undefined) {
        publicUrl = text(body.publicUrl, 'publicUrl', 2048);
        try { const url = new URL(publicUrl); if (url.protocol !== 'https:' || url.username || url.password) fail(400, 'Invalid publicUrl'); } catch { fail(400, 'Invalid publicUrl'); }
      }
      const publication = found(await store.getPublication(publicationId), 'Publication');
      lease(publication, worker, 'publishing', now());
      if (body.status === 'published' && !externalPostId && !publication.external_post_id) fail(400, 'Published publications require an external post ID');
      const updated = await store.transitionPublication(publication.id, { status: body.status as 'publishing' | 'published' | 'failed', expectedStatuses: [publication.status], externalPostId, publicUrl, publishedAt: body.status === 'published' ? now().toISOString() : undefined, ...error, actor: { type: 'worker', id: worker }, eventName: `publication_${body.status}` });
      return result(200, { publication: updated });
    }),
  };
}
