import 'server-only';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { supabaseAdmin } from '../supabase/admin.ts';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import * as server from './server.ts';
import type { StudioStore } from './routes';
import type { AssetRow, CampaignRow, PublicationRow, RenderRow, WorkerHeartbeat } from './types';

function checked<T>(response: { data: T; error: { message: string } | null }): T {
  if (response.error) throw new Error('Content Studio data operation failed');
  return response.data;
}

// Instantiating the adapter does not instantiate a Supabase client or perform IO.
// Handlers authenticate before invoking any of these functions.
export const studioStore: StudioStore = {
  ...server,
  async getCampaign(id) {
    return checked(await supabaseAdmin().from('content_studio_campaigns').select('*').eq('id', id).maybeSingle()) as CampaignRow | null;
  },
  async getRender(id) {
    return checked(await supabaseAdmin().from('content_studio_renders').select('*').eq('id', id).maybeSingle()) as RenderRow | null;
  },
  async getPublication(id) {
    return checked(await supabaseAdmin().from('content_studio_publications').select('*').eq('id', id).maybeSingle()) as PublicationRow | null;
  },
  async getAsset(id) {
    return checked(await supabaseAdmin().from('content_studio_assets').select('*').eq('id', id).maybeSingle()) as AssetRow | null;
  },
  async listCampaignRenders(campaignId) {
    return checked(await supabaseAdmin().from('content_studio_renders').select('*').eq('campaign_id', campaignId)) as RenderRow[];
  },
  async listPublications(renderId) {
    return checked(await supabaseAdmin().from('content_studio_publications').select('*').eq('render_id', renderId)) as PublicationRow[];
  },
  async listWorkerHeartbeats() {
    return checked(await supabaseAdmin().from('content_studio_worker_heartbeats')
      .select('machine_id,last_seen_at').order('last_seen_at', { ascending: false }).limit(10)) as WorkerHeartbeat[];
  },
  async upsertHeartbeat(input) {
    checked(await supabaseAdmin().from('content_studio_worker_heartbeats').upsert({
      machine_id: input.machineId, version: input.version, current_job_id: input.currentJobId,
      status_message: input.statusMessage, last_seen_at: new Date().toISOString(),
    }, { onConflict: 'machine_id' }));
  },
  async confirmRenderOutput(renderId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(renderId)) throw new Error('A valid render UUID is required');
    const files = checked(await supabaseAdmin().storage.from('content-studio').list(`renders/${renderId}`, { search: 'output.mp4', limit: 100 }));
    const file = files?.find((file) => file.name === 'output.mp4' && file.id);
    if (!file) throw new Error('Render output has not been confirmed in Storage');
    if (file.metadata?.mimetype !== 'video/mp4' || !Number.isSafeInteger(file.metadata?.size) || file.metadata.size <= 0 || file.metadata.size > 262144000) throw new Error('Render output metadata is invalid');
  },
};
