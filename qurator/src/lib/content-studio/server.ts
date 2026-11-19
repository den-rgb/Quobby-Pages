import 'server-only';

import { randomUUID } from 'node:crypto';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { supabaseAdmin } from '../supabase/admin.ts';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { assertCampaignInput } from './state.ts';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { CONTENT_STUDIO_STATUSES } from './types.ts';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { ContentStudioConflictError, ContentStudioInputError, MemeGenerationError } from './errors.ts';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { validateSourceFiles } from './media.ts';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { FUNNY_CLIP_QUERIES, MAX_CLIP_BYTES, generateMeme, generatePlatformCopy, memeModels, pexelsCandidates, pixabayCandidates, readCapped, scoreClipForLibrary, searchRequest, stockUsageKey, type MemeRequest, type StockClip } from './meme.ts';
import type { AssetRow, AuditActor, CampaignRow, CampaignStatus, ClaimedJob, MemeClipRow, PublicationCopy, PublicationRow, PublicationStatus, QueueCampaign, RenderRow, RenderSpec, RenderStatus, StockCredit } from './types';

const BUCKET = 'content-studio';
const MEDIA_TYPES = new Set(['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp', 'audio/wav', 'audio/mpeg', 'audio/aac']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function checked<T>(result: { data: T; error: { message: string } | null }, operation: string): NonNullable<T> {
  if (result.error) throw new Error(`Content Studio could not ${operation}: ${result.error.message}`);
  if (result.data === null || result.data === undefined) throw new Error(`Content Studio could not ${operation}: empty response.`);
  return result.data as NonNullable<T>;
}

export interface TransitionEvent {
  campaignId?: string;
  renderId?: string;
  publicationId?: string;
  actor: AuditActor;
  eventName?: string;
  oldStatus: CampaignStatus | null;
  newStatus: CampaignStatus;
  details?: Record<string, unknown>;
}

// Authorization belongs to the calling route. No browser imports this module.
// Admin mutations and claims audit separately; worker transitions audit in SQL.
export async function recordTransition(event: TransitionEvent): Promise<string> {
  return checked(await supabaseAdmin().rpc('content_studio_record_transition', {
    p_campaign_id: event.campaignId ?? null,
    p_render_id: event.renderId ?? null,
    p_publication_id: event.publicationId ?? null,
    p_actor_type: event.actor.type,
    p_actor_id: event.actor.id,
    p_event_name: event.eventName ?? 'status_changed',
    p_old_status: event.oldStatus,
    p_new_status: event.newStatus,
    p_details: event.details ?? {},
  }), 'record transition') as string;
}

// `extras` is server-internal (meme generation); the public campaign route never passes it.
export async function createCampaign(value: unknown, createdBy: string, extras?: { copy?: Pick<PublicationCopy, 'caption' | 'hashtags'>; stock?: StockCredit }): Promise<{ campaign: CampaignRow; render: RenderRow; publications: PublicationRow[] }> {
  assertCampaignInput(value);
  const admin = supabaseAdmin();
  const actor: AuditActor = { type: 'admin', id: createdBy };
  const sourceAssetIds = [...new Set(value.sourceAssetIds.map((id) => id.toLowerCase()))];
  const assets = checked(await admin.from('content_studio_assets').select('id,campaign_id,mime_type,size_bytes').in('id', sourceAssetIds).is('campaign_id', null), 'look up source assets');
  if (assets.length !== sourceAssetIds.length) throw new ContentStudioInputError('Source assets must exist and be unassigned.');
  // Storage queries need not preserve input order: the snapshot's first ID is the recording.
  const sources = sourceAssetIds.map((id) => {
    const asset = assets.find((asset) => asset.id.toLowerCase() === id);
    if (!asset) throw new ContentStudioInputError('Source assets must exist and be unassigned.');
    return asset;
  });
  const files = sources.map((asset) => ({ type: asset.mime_type, size: asset.size_bytes }));
  const mediaError = validateSourceFiles([files[0]], files.slice(1));
  if (mediaError) throw new ContentStudioInputError(mediaError);
  const renderSpec: RenderSpec = {
    templateId: value.templateId, templateVersion: 1, title: value.title,
    hook: value.hook, cta: value.cta, voiceText: value.voiceText, sourceAssetIds,
    ...(extras?.stock ? { stock: extras.stock } : {}),
  };
  const campaign = checked(await admin.from('content_studio_campaigns').insert({
    title: value.title, template_id: value.templateId, template_version: 1,
    requires_approval: value.requiresApproval, status: 'draft', render_spec: renderSpec,
    created_by: createdBy,
  }).select('*').single(), 'create campaign') as CampaignRow;
  await recordTransition({ campaignId: campaign.id, actor, oldStatus: null, newStatus: 'draft', eventName: 'campaign_created' });
  const render = checked(await admin.from('content_studio_renders').insert({
    campaign_id: campaign.id, status: 'draft', render_spec: renderSpec,
  }).select('*').single(), 'create render') as RenderRow;
  await recordTransition({ campaignId: campaign.id, renderId: render.id, actor, oldStatus: null, newStatus: 'draft', eventName: 'render_created' });
  const publications = checked(await admin.from('content_studio_publications').insert([...new Set(value.platforms)].map((platform) => ({
    render_id: render.id, platform, copy_json: {
      title: value.title, caption: extras?.copy?.caption ?? `${value.hook}\n\n${value.cta}`, hashtags: extras?.copy?.hashtags ?? [],
      ...(platform === 'tiktok' ? { privacy: 'SELF_ONLY' } : {}),
    },
    scheduled_for: value.scheduledFor ?? null, status: 'draft',
  }))).select('*'), 'create publications') as PublicationRow[];
  for (const publication of publications) {
    await recordTransition({ campaignId: campaign.id, renderId: render.id, publicationId: publication.id, actor, oldStatus: null, newStatus: 'draft', eventName: 'publication_created' });
  }
  const assigned = checked(await admin.from('content_studio_assets').update({ campaign_id: campaign.id }).in('id', sourceAssetIds).is('campaign_id', null).select('id'), 'assign source assets');
  if (assigned.length !== sourceAssetIds.length) throw new Error('Source assets were assigned by another campaign.');
  // Draft jobs cannot be claimed while the remaining rows are being assembled.
  const queuedCampaign = await transitionCampaign(campaign.id, { status: 'queued', actor, eventName: 'campaign_queued' });
  const queuedRender = await transitionRender(render.id, { status: 'queued', actor, eventName: 'render_queued' });
  return { campaign: queuedCampaign, render: queuedRender, publications };
}

export async function listQueue(): Promise<QueueCampaign[]> {
  return checked(await supabaseAdmin().from('content_studio_campaigns')
    .select('*,content_studio_renders(*,content_studio_publications(*))')
    .order('created_at', { ascending: false }).limit(100), 'list queue') as QueueCampaign[];
}

export async function claimJob(machineId: string): Promise<ClaimedJob | null> {
  if (!machineId.trim()) throw new Error('Machine ID is required.');
  const result = await supabaseAdmin().rpc('content_studio_claim_job', { p_machine_id: machineId });
  if (result.error) throw new Error(`Content Studio could not claim job: ${result.error.message}`);
  const job = result.data as ClaimedJob | null;
  if (!job) return null;
  await recordTransition({
    campaignId: job.campaign_id, renderId: job.render_id,
    publicationId: job.kind === 'publication' ? job.id : undefined,
    actor: { type: 'worker', id: machineId }, eventName: 'job_claimed',
    // The RPC does not expose whether a publication was queued or scheduled.
    oldStatus: job.kind === 'render' ? 'queued' : null,
    newStatus: job.kind === 'render' ? 'rendering' : 'publishing',
  });
  return job;
}

interface BaseTransition {
  actor: AuditActor;
  eventName?: string;
  details?: Record<string, unknown>;
  expectedStatuses?: CampaignStatus[];
}
export interface CampaignTransition extends BaseTransition {
  status: CampaignStatus;
  approvedAt?: string | null;
  requiresApproval?: boolean;
}
export interface RenderTransition extends BaseTransition {
  status: RenderStatus;
  outputPath?: string;
  durationMs?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
}
export interface PublicationTransition extends BaseTransition {
  status: PublicationStatus;
  scheduledFor?: string | null;
  copy?: PublicationCopy;
  externalPostId?: string;
  publicUrl?: string;
  publishedAt?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
}

type Entity = 'campaign' | 'render' | 'publication';
const TABLES = { campaign: 'content_studio_campaigns', render: 'content_studio_renders', publication: 'content_studio_publications' } as const;

async function transition(entity: Entity, id: string, input: BaseTransition & { status: CampaignStatus }, fields: Record<string, unknown>): Promise<CampaignRow | RenderRow | PublicationRow> {
  if (!CONTENT_STUDIO_STATUSES.includes(input.status)) throw new Error('Choose a supported status.');
  if (input.expectedStatuses !== undefined && (!Array.isArray(input.expectedStatuses) || !input.expectedStatuses.length || !input.expectedStatuses.every((status) => CONTENT_STUDIO_STATUSES.includes(status)))) throw new Error('Expected statuses must be a nonempty set of supported statuses.');
  const admin = supabaseAdmin();
  const table = TABLES[entity];
  const previous = checked(await admin.from(table).select('*').eq('id', id).single(), `look up ${entity}`) as CampaignRow & RenderRow & PublicationRow;
  if (input.expectedStatuses && !input.expectedStatuses.includes(previous.status)) throw new ContentStudioConflictError();
  const now = new Date().toISOString();
  const activeStatus = entity === 'render' ? 'rendering' : 'publishing';
  if (input.actor.type === 'worker') {
    if (entity === 'campaign' || !input.actor.id || previous.lease_owner !== input.actor.id || !previous.lease_expires_at || !(Date.parse(previous.lease_expires_at) > Date.parse(now)) || previous.status !== activeStatus) {
      throw new Error('Worker must own the active lease.');
    }
  }
  if (entity === 'publication' && input.status === 'published') {
    const externalPostId = fields.external_post_id ?? previous.external_post_id;
    if (typeof externalPostId !== 'string' || !externalPostId.trim()) throw new Error('A published publication requires an external post ID.');
  }
  if (input.actor.type === 'worker') {
    // SQL checks the lease against database time after transport/lock delays and
    // commits the mutation and content_studio_record_transition together.
    return checked(await admin.rpc('content_studio_transition_job', {
      p_job_kind: entity,
      p_job_id: id,
      p_machine_id: input.actor.id,
      p_status: input.status,
      p_patch: fields,
      p_event_name: input.eventName ?? 'status_changed',
      p_details: input.details ?? {},
    }), `update ${entity}`) as RenderRow | PublicationRow;
  }
  const patch: Record<string, unknown> = { ...fields, status: input.status, updated_at: now };
  if (entity !== 'campaign' && input.status !== activeStatus) {
    patch.lease_owner = null;
    patch.lease_expires_at = null;
  }
  const update = admin.from(table).update(patch).eq('id', id).eq('status', previous.status);
  if (input.expectedStatuses) update.in('status', input.expectedStatuses);
  const response = await update.select('*').single();
  if (input.expectedStatuses && (response.error?.code === 'PGRST116' || (!response.error && !response.data))) throw new ContentStudioConflictError();
  const updated = checked(response, `update ${entity}`) as CampaignRow | RenderRow | PublicationRow;
  await recordTransition({
    campaignId: entity === 'campaign' ? id : entity === 'render' ? previous.campaign_id : undefined,
    renderId: entity === 'render' ? id : entity === 'publication' ? previous.render_id : undefined,
    publicationId: entity === 'publication' ? id : undefined,
    actor: input.actor, eventName: input.eventName,
    oldStatus: previous.status, newStatus: input.status, details: input.details,
  });
  return updated;
}

function definedFields(input: object, fields: Record<string, string>): Record<string, unknown> {
  const values = input as Record<string, unknown>;
  return Object.fromEntries(Object.entries(fields).filter(([key]) => values[key] !== undefined).map(([key, column]) => [column, values[key]]));
}

export async function transitionCampaign(id: string, input: CampaignTransition): Promise<CampaignRow> {
  return await transition('campaign', id, input, definedFields(input, { approvedAt: 'approved_at', requiresApproval: 'requires_approval' })) as CampaignRow;
}

export async function transitionRender(id: string, input: RenderTransition): Promise<RenderRow> {
  if (input.outputPath !== undefined && input.outputPath !== renderOutputPath(id)) throw new Error('Use the generated render output path.');
  return await transition('render', id, input, definedFields(input, { outputPath: 'output_path', durationMs: 'duration_ms', errorCode: 'error_code', errorMessage: 'error_message' })) as RenderRow;
}

export interface RenderCompletion {
  machineId: string;
  status: 'review' | 'failed';
  outputPath?: string;
  durationMs?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export async function completeRender(id: string, input: RenderCompletion): Promise<RenderRow> {
  const path = renderOutputPath(id);
  if (!input.machineId.trim()) throw new Error('Machine ID is required.');
  if (input.status !== 'review' && input.status !== 'failed') throw new Error('Choose review or failed.');
  if (input.outputPath !== undefined && input.outputPath !== path) throw new Error('Use the generated render output path.');
  if (input.status === 'review' && (input.outputPath !== path || !Number.isSafeInteger(input.durationMs) || input.durationMs! < 0)) throw new Error('Completed renders require their generated output path and duration.');
  return checked(await supabaseAdmin().rpc('content_studio_complete_render', {
    p_render_id: id, p_machine_id: input.machineId, p_status: input.status,
    p_patch: definedFields(input, { outputPath: 'output_path', durationMs: 'duration_ms', errorCode: 'error_code', errorMessage: 'error_message' }),
  }), 'complete render') as RenderRow;
}

export async function setApprovalPolicy(id: string, input: { adminId: string; requiresApproval: boolean; expectedStatuses: CampaignStatus[] }): Promise<CampaignRow> {
  if (!UUID.test(id) || !input.adminId.trim() || typeof input.requiresApproval !== 'boolean') throw new Error('A campaign, admin, and boolean approval policy are required.');
  if (!input.expectedStatuses.length || !input.expectedStatuses.every((status) => CONTENT_STUDIO_STATUSES.includes(status))) throw new Error('Expected statuses must be a nonempty set of supported statuses.');
  const response = await supabaseAdmin().rpc('content_studio_set_approval_policy', {
    p_campaign_id: id, p_admin_id: input.adminId,
    p_requires_approval: input.requiresApproval, p_expected_statuses: input.expectedStatuses,
  });
  if (response.error?.code === '40001') throw new ContentStudioConflictError();
  return checked(response, 'set approval policy') as CampaignRow;
}

export async function reviewCampaign(id: string, input: { adminId: string; action: 'approve' | 'reject' }): Promise<CampaignRow> {
  if (!UUID.test(id) || !input.adminId.trim() || (input.action !== 'approve' && input.action !== 'reject')) {
    throw new Error('A campaign, admin, and review action are required.');
  }
  const response = await supabaseAdmin().rpc('content_studio_review_campaign', {
    p_campaign_id: id,
    p_admin_id: input.adminId,
    p_action: input.action,
  });
  if (response.error?.code === '40001') throw new ContentStudioConflictError();
  return checked(response, 'review campaign') as CampaignRow;
}

// The database locks campaign -> render -> publication before deciding whether
// this existing failed row may return to review/queued/scheduled. Keeping that
// decision in SQL prevents an approval-policy edit from racing a retry.
export async function retryPublication(id: string, input: { adminId: string }): Promise<PublicationRow> {
  if (!UUID.test(id) || !input.adminId.trim()) throw new Error('A publication and admin ID are required.');
  const response = await supabaseAdmin().rpc('content_studio_retry_publication', {
    p_publication_id: id, p_admin_id: input.adminId,
  });
  if (response.error?.code === '40001') throw new ContentStudioConflictError();
  return checked(response, 'retry publication') as PublicationRow;
}

export async function transitionPublication(id: string, input: PublicationTransition): Promise<PublicationRow> {
  return await transition('publication', id, input, definedFields(input, { scheduledFor: 'scheduled_for', copy: 'copy_json', externalPostId: 'external_post_id', publicUrl: 'public_url', publishedAt: 'published_at', errorCode: 'error_code', errorMessage: 'error_message' })) as PublicationRow;
}

function assertPrivateStoragePath(path: string): void {
  if (!path || !/^[a-zA-Z0-9._/-]+$/.test(path) || path.startsWith('/') || path.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('A private Storage path is required.');
  }
}

export async function createSignedUploadUrl(filename: string): Promise<{ path: string; signedUrl: string; token: string }> {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!safeFilename || safeFilename === '.' || safeFilename === '..') throw new Error('A filename is required.');
  const path = `uploads/${randomUUID()}/${safeFilename}`;
  const data = checked(await supabaseAdmin().storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false }), 'sign upload');
  return { path, signedUrl: data.signedUrl, token: data.token };
}

export async function createSignedDownloadUrl(path: string, downloadName?: string): Promise<string> {
  assertPrivateStoragePath(path);
  const options = downloadName ? { download: downloadName } : undefined;
  return checked(await supabaseAdmin().storage.from(BUCKET).createSignedUrl(path, 300, options), 'sign download').signedUrl;
}

// The admin's browser rendered the meme and uploaded it to the canonical path;
// no worker lease exists, so the SQL function verifies ownership instead.
export async function completeRenderAsAdmin(renderId: string, adminId: string, durationMs: number): Promise<RenderRow> {
  if (!UUID.test(renderId)) throw new Error('A valid render UUID is required.');
  if (!Number.isSafeInteger(durationMs) || durationMs < 0) throw new Error('A render duration is required.');
  const response = await supabaseAdmin().rpc('content_studio_complete_render_admin', {
    p_render_id: renderId, p_admin_id: adminId, p_duration_ms: durationMs,
  });
  if (response.error?.code === '40001') throw new ContentStudioConflictError();
  return checked(response, 'complete render') as RenderRow;
}

// Manual publishing: the admin posted the approved video themselves.
export async function publishPublicationManually(publicationId: string, adminId: string, publicUrl: string | null): Promise<PublicationRow> {
  if (!UUID.test(publicationId)) throw new Error('A valid publication UUID is required.');
  const response = await supabaseAdmin().rpc('content_studio_publish_manual', {
    p_publication_id: publicationId, p_admin_id: adminId, p_public_url: publicUrl,
  });
  if (response.error?.code === '40001') throw new ContentStudioConflictError();
  return checked(response, 'publish publication') as PublicationRow;
}

function renderOutputPath(renderId: string): string {
  if (!UUID.test(renderId)) throw new Error('A valid render UUID is required.');
  return `renders/${renderId}/output.mp4`;
}

export async function createSignedRenderUploadUrl(renderId: string): Promise<{ path: string; signedUrl: string; token: string }> {
  const path = renderOutputPath(renderId);
  // A worker can lose its completion response after Storage already accepted
  // this exact object. The machine route authorizes an active render lease
  // before calling this helper, and the path is derived from that render ID,
  // so allowing replacement only recovers this canonical output object.
  const data = checked(await supabaseAdmin().storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true }), 'sign render upload');
  return { path, signedUrl: data.signedUrl, token: data.token };
}

export interface AssetInput {
  storagePath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export async function createAsset(input: AssetInput): Promise<AssetRow> {
  assertPrivateStoragePath(input.storagePath);
  const [root, uploadId, filename, extra] = input.storagePath.split('/');
  if (root !== 'uploads' || !UUID.test(uploadId) || !filename || extra !== undefined) throw new Error('A generated upload path is required.');
  if (!input.filename.trim()) throw new Error('A filename is required.');
  if (!MEDIA_TYPES.has(input.mimeType)) throw new Error('Choose a supported media type.');
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > 262144000) throw new Error('Asset size must be between 1 byte and 250 MB.');
  const admin = supabaseAdmin();
  const files = checked(await admin.storage.from(BUCKET).list(`uploads/${uploadId}`, { search: filename, limit: 100 }), 'confirm upload');
  const file = files.find((file) => file.name === filename && file.id);
  if (!file) throw new Error('Upload has not been confirmed in Storage.');
  if (file.metadata?.size !== input.sizeBytes || file.metadata?.mimetype !== input.mimeType) throw new Error('Upload metadata does not match the declared size or media type.');
  return checked(await admin.from('content_studio_assets').insert({
    storage_path: input.storagePath, mime_type: input.mimeType,
    size_bytes: input.sizeBytes, original_filename: input.filename,
  }).select('*').single(), 'create asset') as AssetRow;
}

// Server-side upload of a downloaded stock clip into the private bucket.
export async function uploadStockClip(bytes: Uint8Array, filename: string): Promise<AssetRow> {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `uploads/${randomUUID()}/${safeFilename}`;
  const upload = await supabaseAdmin().storage.from(BUCKET).upload(storagePath, bytes, { contentType: 'video/mp4', upsert: false });
  if (upload.error) throw new Error(`Content Studio could not store stock clip: ${upload.error.message}`);
  return createAsset({ storagePath, filename: safeFilename, mimeType: 'video/mp4', sizeBytes: bytes.byteLength });
}

// Stock clips already used by recent memes, so new memes do not repeat footage.
export async function recentStockVideoIds(): Promise<Set<string>> {
  const rows = checked(await supabaseAdmin().from('content_studio_campaigns').select('render_spec')
    .eq('template_id', 'meme-classic').order('created_at', { ascending: false }).limit(500), 'list recent memes') as { render_spec: RenderSpec }[];
  return new Set(rows.map((row) => row.render_spec?.stock).filter((stock): stock is StockCredit => !!stock && Number.isSafeInteger(stock.videoId)).map(stockUsageKey));
}

const MEME_CLIP_PROVIDERS = ['pixabay', 'pexels'] as const;
type MemeClipProvider = typeof MEME_CLIP_PROVIDERS[number];
// The library table arrives with its own migration; until it is applied the
// feature degrades to stock search instead of breaking meme generation.
const MISSING_TABLE = new Set(['42P01', 'PGRST205']);
const tableMissing = (error: { code?: string } | null): boolean => !!error && MISSING_TABLE.has(error.code ?? '');

// Curated funny clips, newest first, for the Content Studio library panel.
export async function listMemeClips(): Promise<MemeClipRow[]> {
  const result = await supabaseAdmin().from('content_studio_meme_clips').select('*')
    .order('created_at', { ascending: false }).limit(200);
  if (tableMissing(result.error)) return [];
  return checked(result, 'list funny clips') as MemeClipRow[];
}

// Resolves the exact provider video so the stored row keeps its licence
// attribution and a CDN path that generation can download directly.
async function providerClip(provider: MemeClipProvider, videoId: number): Promise<StockClip> {
  const key = provider === 'pixabay' ? process.env.PIXABAY_API_KEY?.trim() : process.env.PEXELS_API_KEY?.trim();
  if (!key) throw new ContentStudioInputError(`Set ${provider === 'pixabay' ? 'PIXABAY_API_KEY' : 'PEXELS_API_KEY'} to add clips from that provider.`);
  let response: Response;
  try {
    if (provider === 'pixabay') {
      const url = new URL('https://pixabay.com/api/videos/');
      for (const [name, value] of [['key', key], ['id', String(videoId)], ['video_type', 'film'], ['safesearch', 'true'], ['per_page', '3']]) url.searchParams.set(name, value);
      response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
    } else {
      response = await fetch(`https://api.pexels.com/videos/videos/${videoId}`, {
        redirect: 'error', signal: AbortSignal.timeout(15_000), headers: { Authorization: key },
      });
    }
  } catch { throw new MemeGenerationError('Could not reach the stock video library. Try again.'); }
  if (response.status === 404) throw new ContentStudioInputError('That clip was not found on the provider.');
  if (response.status === 429) throw new MemeGenerationError('The stock video library rate limit was reached. Try again later.');
  if (!response.ok) throw new Error(`The stock video lookup failed (${response.status}).`);
  const body = await response.json().catch(() => null);
  const clips = provider === 'pixabay' ? pixabayCandidates(body, new Set()) : pexelsCandidates({ videos: [body] }, new Set());
  const clip = clips.find((candidate) => candidate.credit.videoId === videoId);
  if (!clip) throw new ContentStudioInputError('That clip is not a 3-20 second MP4 the worker can render.');
  // Attribution links are rendered in the dashboard; never store a non-https URL.
  if (!clip.credit.pageUrl.startsWith('https://') || !clip.credit.authorUrl.startsWith('https://')) {
    throw new ContentStudioInputError('That clip has no https attribution page.');
  }
  return clip;
}

export async function addMemeClip(input: { provider: string; videoId: number; label: string }, createdBy: string): Promise<MemeClipRow> {
  if (!MEME_CLIP_PROVIDERS.includes(input.provider as MemeClipProvider)) throw new ContentStudioInputError('Choose Pixabay or Pexels.');
  const provider = input.provider as MemeClipProvider;
  const clip = await providerClip(provider, input.videoId);
  const inserted = await supabaseAdmin().from('content_studio_meme_clips').insert({
    provider, video_id: input.videoId, label: input.label,
    page_url: clip.credit.pageUrl, author: clip.credit.author, author_url: clip.credit.authorUrl,
    file_url: clip.fileUrl, portrait: clip.portrait, created_by: createdBy,
  }).select('*').single();
  if (inserted.error) {
    if (tableMissing(inserted.error)) throw new ContentStudioInputError('Apply qurator/migrate-content-studio-meme-clips.sql in Supabase before adding clips.');
    // Postgres unique violation: the provider and video ID are already curated.
    if (inserted.error.code === '23505') throw new ContentStudioInputError('That clip is already in the library.');
    throw new Error(`Content Studio could not add the clip: ${inserted.error.message}`);
  }
  return inserted.data as MemeClipRow;
}

export async function setMemeClipActive(id: string, active: boolean): Promise<MemeClipRow> {
  const updated = await supabaseAdmin().from('content_studio_meme_clips').update({ active }).eq('id', id).select('*').maybeSingle();
  if (updated.error) throw new Error(`Content Studio could not update the clip: ${updated.error.message}`);
  if (!updated.data) throw new ContentStudioInputError('Clip not found.');
  return updated.data as MemeClipRow;
}

// Active library clips in the shape the generator already understands.
export async function memeLibraryClips(): Promise<StockClip[]> {
  const result = await supabaseAdmin().from('content_studio_meme_clips').select('*').eq('active', true).limit(500);
  if (tableMissing(result.error)) return [];
  const rows = checked(result, 'list funny clips') as MemeClipRow[];
  return rows.filter((row) => Number.isSafeInteger(Number(row.video_id)) && Number(row.video_id) > 0).map((row) => ({
    // PostgREST may serialise bigint as a string; the generator needs a number.
    credit: { provider: row.provider, videoId: Number(row.video_id), pageUrl: row.page_url, author: row.author, authorUrl: row.author_url },
    fileUrl: row.file_url, portrait: row.portrait,
  }));
}

const CURATION_TARGET = 30;
const CURATION_PER_RUN = 3;

async function downloadClip(fileUrl: string): Promise<Uint8Array> {
  const response = await fetch(fileUrl, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
  const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
  if (!response.ok || !(type.startsWith('video/') || type === 'application/octet-stream')) {
    await response.body?.cancel().catch(() => {});
    throw new Error('Could not download the stock clip.');
  }
  return readCapped(response, MAX_CLIP_BYTES);
}

// Automatic curation: search comedic footage, let the model veto anything that is
// not genuinely funny, and keep the winners. No human picks clips.
export async function curateMemeClips(): Promise<{ added: number; checked: number; library: number; skipped: string | null }> {
  const existing = await listMemeClips();
  // Only active clips count: deactivated ones must not block a top-up.
  if (existing.filter((clip) => clip.active).length >= CURATION_TARGET) return { added: 0, checked: 0, library: existing.length, skipped: 'library-full' };
  const pixabayKey = process.env.PIXABAY_API_KEY?.trim();
  const pexelsKey = process.env.PEXELS_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!pixabayKey && !pexelsKey) throw new ContentStudioInputError('Set PIXABAY_API_KEY (or PEXELS_API_KEY) to curate clips.');
  if (!geminiKey) throw new ContentStudioInputError('Set GEMINI_API_KEY to curate clips.');

  const stock = pixabayKey ? { provider: 'pixabay' as const, key: pixabayKey } : { provider: 'pexels' as const, key: pexelsKey! };
  const known = new Set(existing.map((clip) => `${clip.provider}:${clip.video_id}`));
  const query = FUNNY_CLIP_QUERIES[Math.floor(Math.random() * FUNNY_CLIP_QUERIES.length)];
  const search = searchRequest(stock, query);
  let found: Response;
  try { found = await fetch(search.url, search.init); }
  catch { throw new MemeGenerationError('Could not reach the stock video library. Try again.'); }
  if (!found.ok) throw new MemeGenerationError('The stock video search failed. Check the provider API key.');
  const results = await found.json().catch(() => null);
  const candidates = (stock.provider === 'pixabay' ? pixabayCandidates(results, new Set()) : pexelsCandidates(results, new Set()))
    .filter((clip) => !known.has(stockUsageKey(clip.credit)))
    .sort((a, b) => Number(b.portrait) - Number(a.portrait))
    .slice(0, CURATION_PER_RUN);

  const deps = { fetcher: fetch, geminiKey, geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite', now: Date.now };
  let added = 0; let checked = 0;
  for (const candidate of candidates) {
    checked++;
    try {
      const bytes = await downloadClip(candidate.fileUrl);
      const score = await scoreClipForLibrary(memeModels(deps.geminiModel), bytes, deps, Date.now() + 60_000);
      if (!score.funny || !score.suitable) continue;
      const inserted = await supabaseAdmin().from('content_studio_meme_clips').insert({
        provider: stock.provider, video_id: candidate.credit.videoId,
        label: (score.description || query).slice(0, 80),
        page_url: candidate.credit.pageUrl, author: candidate.credit.author, author_url: candidate.credit.authorUrl,
        file_url: candidate.fileUrl, portrait: candidate.portrait, active: true, source: 'auto',
      });
      if (inserted.error?.code && MISSING_TABLE.has(inserted.error.code)) throw new ContentStudioInputError('Apply qurator/migrate-content-studio-meme-clips.sql in Supabase before curating clips.');
      if (!inserted.error) added++;
    } catch (error) {
      // A missing migration is a setup error, not a bad clip: surface it.
      if (error instanceof ContentStudioInputError) throw error;
    }
  }
  return { added, checked, library: existing.length + added, skipped: null };
}

// Writes per-platform descriptions and tags onto every publication that has not
// been published yet. Shared by fresh generation and the backfill action.
export async function generateCampaignCopy(campaignId: string, adminId: string, budgetMs = 45_000): Promise<PublicationRow[]> {
  if (!UUID.test(campaignId)) throw new Error('A valid campaign UUID is required.');
  const geminiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!geminiKey) throw new ContentStudioInputError('Set GEMINI_API_KEY in the Qurator server environment to generate copy.');
  const admin = supabaseAdmin();
  const campaign = checked(await admin.from('content_studio_campaigns').select('*').eq('id', campaignId).single(), 'load campaign') as CampaignRow;
  if (campaign.created_by !== adminId) throw new ContentStudioInputError('Only the campaign owner can generate copy.');
  const renders = checked(await admin.from('content_studio_renders').select('*').eq('campaign_id', campaignId), 'load renders') as RenderRow[];
  if (!renders.length) throw new ContentStudioInputError('This campaign has no render.');
  const publications = checked(await admin.from('content_studio_publications').select('*').in('render_id', renders.map((render) => render.id)).order('created_at'), 'load publications') as PublicationRow[];
  const targets = publications.filter((publication) => !['published', 'rejected'].includes(publication.status));
  if (!targets.length) throw new ContentStudioInputError('Every publication is already published or rejected.');

  const copy = await generatePlatformCopy(
    { title: campaign.render_spec.title, hook: campaign.render_spec.hook, cta: campaign.render_spec.cta },
    { fetcher: fetch, geminiKey, geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite', now: Date.now },
    Date.now() + budgetMs,
  );
  const actor: AuditActor = { type: 'admin', id: adminId };
  const updated: PublicationRow[] = [];
  for (const publication of targets) {
    const platformCopy = copy[publication.platform];
    if (!platformCopy) continue;
    updated.push(await transitionPublication(publication.id, {
      status: publication.status, expectedStatuses: [publication.status],
      copy: { ...publication.copy_json, caption: platformCopy.description, hashtags: platformCopy.hashtags },
      actor, eventName: 'publication_copy_generated',
    }));
  }
  if (!updated.length) throw new MemeGenerationError('The AI returned no usable platform copy. Try again.');
  return updated;
}

export interface GeneratedMemeCampaign {
  campaignId: string;
  renderId: string;
  clipUrl: string;
  copy: { title: string; hook: string; cta: string; caption: string; hashtags: string[] };
}

export async function generateMemeCampaign(request: MemeRequest, createdBy: string): Promise<GeneratedMemeCampaign> {
  // Pixabay first (Pexels paused new API keys); either provider works.
  const pixabayKey = process.env.PIXABAY_API_KEY?.trim();
  const pexelsKey = process.env.PEXELS_API_KEY?.trim();
  // `||` so an empty GEMINI_API_KEY= (as in .env.local.example) still falls back.
  const geminiKey = (process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());
  if (!pixabayKey && !pexelsKey) throw new ContentStudioInputError('Set PIXABAY_API_KEY (or PEXELS_API_KEY) in the Qurator server environment to generate memes.');
  if (!geminiKey) throw new ContentStudioInputError('Set GEMINI_API_KEY in the Qurator server environment to generate memes.');
  const created = await generateMeme(request, {
    fetcher: fetch, geminiKey,
    stock: pixabayKey ? { provider: 'pixabay', key: pixabayKey } : { provider: 'pexels', key: pexelsKey! },
    // Newest lite model; an overloaded model falls back automatically in generateMeme.
    geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite',
    usedStockIds: recentStockVideoIds,
    // Curated clips replace keyword search; an empty library drives the search.
    libraryClips: memeLibraryClips,
    storeClip: async (bytes, filename) => {
      const asset = await uploadStockClip(bytes, filename);
      return { assetId: asset.id, storagePath: asset.storage_path };
    },
    createCampaign: async (input, copy, stock) => {
      const created = await createCampaign(input, createdBy, { copy, stock });
      return { campaignId: created.campaign.id, renderId: created.render.id };
    },
  });
  if (!created.renderId || !created.clipStoragePath) throw new Error('Content Studio could not prepare the browser render.');
  // Per-platform copy is best-effort: the campaign keeps its shared fallback copy
  // and the admin can regenerate from the review panel.
  await generateCampaignCopy(created.campaignId, createdBy, 20_000).catch(() => {});
  return {
    campaignId: created.campaignId, renderId: created.renderId,
    clipUrl: await createSignedDownloadUrl(created.clipStoragePath), copy: created.copy,
  };
}
