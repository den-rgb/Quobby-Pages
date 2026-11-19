// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { MEME_TEMPLATE_ID, PLATFORMS, TEMPLATE_IDS } from './types.ts';
import type { CampaignInput, PublicationStatus } from './types';

const CAMPAIGN_FIELDS = new Set(['templateId', 'title', 'hook', 'cta', 'voiceText', 'sourceAssetIds', 'platforms', 'tiktokPrivateTest', 'requiresApproval', 'scheduledFor']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validIsoSchedule(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second, zone] = match;
  const daysInMonth = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= daysInMonth
    && Number(hour) <= 23 && Number(minute) <= 59 && Number(second) <= 59
    && (zone === 'Z' || (Number(zone.slice(1, 3)) <= 23 && Number(zone.slice(4)) <= 59));
}

export function assertCampaignInput(value: unknown, now: Date = new Date()): asserts value is CampaignInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Campaign must be an object.');
  const input = value as Record<string, unknown>;
  for (const field of Object.keys(input)) {
    if (!CAMPAIGN_FIELDS.has(field)) throw new Error(`Unknown campaign field: ${field}.`);
  }
  if (!TEMPLATE_IDS.includes(input.templateId as CampaignInput['templateId'])) throw new Error('Choose a supported template.');
  for (const [field, max, label] of [['title', 100, 'Title'], ['hook', 120, 'Hook'], ['cta', 80, 'CTA'], ['voiceText', 500, 'Voice text']] as const) {
    const text = input[field];
    // The meme template has no voice-over; the worker requires empty voice text.
    if (field === 'voiceText' && input.templateId === MEME_TEMPLATE_ID) {
      if (text !== '') throw new Error('Meme campaigns have no voice-over text.');
      continue;
    }
    if (typeof text !== 'string' || text.trim().length === 0 || text.length > max) throw new Error(`${label} must be between 1 and ${max} characters.`);
  }
  if (!Array.isArray(input.sourceAssetIds) || input.sourceAssetIds.length === 0 || !input.sourceAssetIds.every((id) => typeof id === 'string' && UUID.test(id))) throw new Error('Choose at least one source asset with a valid UUID.');
  if (!Array.isArray(input.platforms) || input.platforms.length === 0 || !input.platforms.every((platform) => PLATFORMS.includes(platform))) throw new Error('Choose at least one supported platform.');
  const includesTikTok = input.platforms.includes('tiktok');
  if (includesTikTok && input.tiktokPrivateTest !== true) throw new Error('A private TikTok test must be explicitly acknowledged. Public TikTok publishing is unavailable for this internal tool.');
  if (!includesTikTok && input.tiktokPrivateTest !== undefined) throw new Error('TikTok private testing is only valid when TikTok is selected.');
  if (typeof input.requiresApproval !== 'boolean') throw new Error('Requires approval must be a boolean.');
  if (input.scheduledFor !== undefined && input.scheduledFor !== null) {
    if (typeof input.scheduledFor !== 'string' || !validIsoSchedule(input.scheduledFor)) throw new Error('Schedule must be a valid ISO date and time with a timezone.');
    if (Date.parse(input.scheduledFor) < now.getTime()) throw new Error('Schedule cannot be earlier than now.');
  }
}

export function nextPublicationStatus(input: {
  requiresApproval: boolean;
  renderSucceeded: boolean;
  approvedAt: string | null;
  scheduledFor: string | null;
}): PublicationStatus {
  if (!input.renderSucceeded) return 'failed';
  if (input.requiresApproval && !input.approvedAt) return 'review';
  return input.scheduledFor ? 'scheduled' : 'queued';
}

export function isRetryablePlatformFailure(status: number): boolean {
  return Number.isInteger(status) && ([408, 425, 429].includes(status) || (status >= 500 && status <= 599));
}
