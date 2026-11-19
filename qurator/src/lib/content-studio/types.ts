export const TEMPLATE_IDS = ['focus-blocker-problem-solution', 'flashcards-before-exam', 'study-streak-meme', 'meme-classic'] as const;
export type TemplateId = typeof TEMPLATE_IDS[number];
// Auto-generated stock meme: no voice-over, top text over a stock clip.
export const MEME_TEMPLATE_ID = 'meme-classic' satisfies TemplateId;
export const PLATFORMS = ['instagram', 'tiktok', 'youtube'] as const;
export type Platform = typeof PLATFORMS[number];

// These values mirror all three status constraints in migrate-content-studio.sql.
export const CONTENT_STUDIO_STATUSES = ['draft', 'queued', 'rendering', 'review', 'scheduled', 'publishing', 'published', 'failed', 'rejected'] as const;
export type CampaignStatus = typeof CONTENT_STUDIO_STATUSES[number];
export type RenderStatus = CampaignStatus;
export type PublicationStatus = CampaignStatus;

export interface CampaignInput {
  templateId: TemplateId;
  title: string;
  hook: string;
  cta: string;
  voiceText: string;
  sourceAssetIds: string[];
  platforms: Platform[];
  // TikTok is limited to an acknowledged SELF_ONLY integration test for this
  // internal tool; it is never a public-publishing preference.
  tiktokPrivateTest?: boolean;
  requiresApproval: boolean;
  scheduledFor?: string | null;
}

export interface RenderSpec {
  templateId: TemplateId;
  templateVersion: number;
  title: string;
  hook: string;
  cta: string;
  voiceText: string;
  sourceAssetIds: string[];
  // Present only for auto-generated stock memes; shown as attribution in the dashboard.
  stock?: StockCredit;
}

export interface StockCredit {
  provider: 'pixabay' | 'pexels';
  videoId: number;
  pageUrl: string;
  author: string;
  authorUrl: string;
}

// A clip the team has watched and kept because it is actually funny. Generated
// memes draw from this list first; stock search is only the empty-library fallback.
export interface MemeClipRow {
  id: string;
  provider: 'pixabay' | 'pexels';
  video_id: number;
  label: string;
  page_url: string;
  author: string;
  author_url: string;
  file_url: string;
  portrait: boolean;
  active: boolean;
  // manual = added by an admin, auto = vetted by the curation job.
  source: 'manual' | 'auto';
  created_at: string;
}

export interface PublicationCopy {
  title: string;
  caption: string;
  hashtags: string[];
  privacy?: string;
}

export interface CampaignRow {
  id: string;
  title: string;
  template_id: TemplateId;
  template_version: number;
  requires_approval: boolean;
  approved_at: string | null;
  status: CampaignStatus;
  render_spec: RenderSpec;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetRow {
  id: string;
  campaign_id: string | null;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  original_filename: string;
  created_at: string;
}

interface JobLease {
  lease_owner: string | null;
  lease_expires_at: string | null;
  attempt_count: number;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface RenderRow extends JobLease {
  id: string;
  campaign_id: string;
  render_spec: RenderSpec;
  status: RenderStatus;
  output_path: string | null;
  duration_ms: number | null;
}

export interface PublicationRow extends JobLease {
  id: string;
  render_id: string;
  platform: Platform;
  copy_json: PublicationCopy;
  scheduled_for: string | null;
  status: PublicationStatus;
  external_post_id: string | null;
  public_url: string | null;
  published_at: string | null;
}

export interface QueueCampaign extends CampaignRow {
  content_studio_renders: (RenderRow & { content_studio_publications: PublicationRow[] })[];
}

export interface WorkerHeartbeat {
  machine_id: string;
  last_seen_at: string;
}

export interface ClaimedJob {
  kind: 'render' | 'publication';
  id: string;
  render_id: string;
  campaign_id: string;
  render_spec: RenderSpec;
  output_path: string | null;
  platform: Platform | null;
  copy_json: PublicationCopy | null;
}

export interface AuditActor {
  type: 'admin' | 'worker' | 'system';
  id: string | null;
}
