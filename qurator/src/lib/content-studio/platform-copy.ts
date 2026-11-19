// Platform-specific social copy: a description and tag list per platform. Used
// for brand-new campaigns and to backfill campaigns that already exist.

import type { Platform } from './types';

export interface PlatformCopy { description: string; hashtags: string[] }

export const PLATFORM_COPY_MAX_DESCRIPTION = 2200;
const MAX_HASHTAGS = 12;

export const PLATFORM_COPY_SCHEMA = {
  type: 'object',
  properties: {
    instagram: { type: 'object', properties: { description: { type: 'string' }, hashtags: { type: 'array', items: { type: 'string' } } }, required: ['description', 'hashtags'] },
    tiktok: { type: 'object', properties: { description: { type: 'string' }, hashtags: { type: 'array', items: { type: 'string' } } }, required: ['description', 'hashtags'] },
    youtube: { type: 'object', properties: { description: { type: 'string' }, hashtags: { type: 'array', items: { type: 'string' } } }, required: ['description', 'hashtags'] },
  },
  required: ['instagram', 'tiktok', 'youtube'],
};

export function platformCopyPrompt(input: { title: string; hook: string; cta: string }): string {
  return [
    'You write social copy for short vertical videos from Quobby, a study app for iOS and Android.',
    `Video title: ${input.title}`,
    `On-screen hook: ${input.hook}`,
    `End-card line: ${input.cta}`,
    'Quobby features you may mention (never invent others): a focus blocker that blocks distracting apps during study sessions; flashcards; study streaks; study points, challenges and prize boxes that reward studying; studying alongside friends.',
    'Write a separate description and tag list for each platform:',
    '- instagram: 1-2 warm, relatable sentences for Instagram Reels, then 3-8 tags.',
    '- tiktok: one punchy casual sentence for TikTok, then 4-8 tags including studytok and fyp.',
    '- youtube: a keyword-rich 1-2 sentence description for YouTube Shorts, then 5-10 search keywords as tags.',
    `Descriptions: plain prose, no emoji, no links, no hashtag text inside the sentence, max ${PLATFORM_COPY_MAX_DESCRIPTION} characters.`,
    'Tags: letters, numbers and underscores only, no # prefix, no spaces.',
  ].join('\n');
}

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
  return text && text.length <= PLATFORM_COPY_MAX_DESCRIPTION ? text : null;
}

function tags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim().replace(/^#/, '').replace(/\s+/g, ''))
    .filter((tag) => /^[\p{L}\p{N}_]{1,50}$/u.test(tag)))].slice(0, MAX_HASHTAGS);
}

// Returns only the platforms that produced usable copy; callers decide whether
// an empty result is an error worth retrying.
export function parsePlatformCopy(raw: string): Partial<Record<Platform, PlatformCopy>> {
  let parsed: unknown = null;
  try { parsed = JSON.parse(raw); } catch { parsed = null; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const value = parsed as Record<string, unknown>;
  const out: Partial<Record<Platform, PlatformCopy>> = {};
  for (const platform of ['instagram', 'tiktok', 'youtube'] as const) {
    const entry = value[platform];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const description = clean((entry as Record<string, unknown>).description);
    const hashtags = tags((entry as Record<string, unknown>).hashtags);
    if (description && hashtags.length) out[platform] = { description, hashtags };
  }
  return out;
}
