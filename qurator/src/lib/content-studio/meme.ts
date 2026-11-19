// Auto-generated stock memes: a Pixabay or Pexels clip (free commercial
// licences) plus Gemini-written top text that relates the clip to Quobby.
// Network IO is injected so selection, parsing, and orchestration are
// testable offline.
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { MemeGenerationError } from './errors.ts';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { MEME_TEMPLATE_ID } from './types.ts';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { PLATFORM_COPY_SCHEMA, parsePlatformCopy, platformCopyPrompt, type PlatformCopy } from './platform-copy.ts';
import type { CampaignInput, Platform, PublicationCopy, StockCredit } from './types';

// Relatable student-life topics for the joke; an admin-supplied theme overrides these.
export const MEME_THEMES = [
  'tired student', 'procrastination', 'scrolling phone in bed', 'exam stress', 'falling asleep at desk',
  'studying late at night', 'distracted student', 'celebrating success', 'shocked reaction', 'student panic',
  'library studying', 'yawning', 'staring at laptop', 'happy dance',
] as const;

// The clip is the joke's visual, so searches ask for expressive, comedic
// footage: generic scenery or abstract motion cannot carry a meme.
export const FUNNY_CLIP_QUERIES = [
  'funny reaction', 'shocked face', 'laughing', 'screaming', 'funny animal',
  'dramatic reaction', 'funny fail', 'dancing badly', 'confused dog', 'cat reaction',
] as const;
const FUNNY_SEARCH_SUFFIX = 'funny';

const PEXELS_SEARCH = 'https://api.pexels.com/v1/videos/search';
const PEXELS_FILE_HOSTS = ['player.vimeo.com', 'videos.pexels.com'];
const PIXABAY_SEARCH = 'https://pixabay.com/api/videos/';
const PIXABAY_FILE_HOSTS = ['cdn.pixabay.com'];
const GEMINI_INTERACTIONS = 'https://generativelanguage.googleapis.com/v1beta/interactions';
// Base64 inflates ~33%; Gemini inline requests must stay under 20 MB.
export const MAX_CLIP_BYTES = 14 * 1024 * 1024;
const MAX_ATTEMPTS = 2;
// The worker shows at most this much of the clip before the CTA card.
const SHOWN_CLIP_SECONDS = 12;
// Start a second attempt only if it can finish inside the route's 120s limit.
const SECOND_ATTEMPT_DEADLINE_MS = 45_000;
// The Interactions API answers 503 "high demand" for a single model often
// enough that one overloaded model must not fail a generation; the next model
// usually answers immediately. Models are tried in order inside one budget.
export const MEME_MODEL_FALLBACKS = ['gemini-3.1-flash-lite', 'gemini-3.1-flash-lite-preview'] as const;
const GEMINI_ATTEMPT_TIMEOUT_MS = 45_000;
// Leaves room inside the route's 120s limit for the stock download, the clip
// upload, and campaign creation after the AI phase.
const GEMINI_PHASE_DEADLINE_MS = 75_000;
// Starting an attempt with less time than this only burns the route budget.
const MIN_MODEL_ATTEMPT_MS = 8_000;
// A platform-wide spike can fail every model once; a short pause then gives a
// second round a chance to find a model that has recovered.
const MODEL_ROUNDS = 2;
const MODEL_RETRY_DELAY_MS = 1_500;

export type StockProvider = StockCredit['provider'];
export interface StockKey { provider: StockProvider; key: string }
// Provider-neutral clip: attribution, the chosen MP4 rendition, and orientation.
export interface StockClip { credit: StockCredit; fileUrl: string; portrait: boolean }

// Used-clip IDs are namespaced so Pixabay and Pexels numbers never collide.
export const stockUsageKey = (credit: Pick<StockCredit, 'provider' | 'videoId'>) => `${credit.provider}:${credit.videoId}`;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function allowedFileUrl(link: unknown, hosts: readonly string[]): link is string {
  if (typeof link !== 'string') return false;
  try { const url = new URL(link); return url.protocol === 'https:' && hosts.includes(url.hostname); } catch { return false; }
}

const usableDuration = (value: unknown): value is number => typeof value === 'number' && value >= 3 && value <= 20;
const usableWidth = (value: unknown): value is number => typeof value === 'number' && value >= 540 && value <= 1080;

// Picks 3-20 second Pexels clips with an MP4 rendition 540-1080px wide,
// preferring the smallest such file so downloads and the Gemini upload stay small.
export function pexelsCandidates(response: unknown, usedIds: ReadonlySet<string>): StockClip[] {
  const videos = record(response)?.videos;
  if (!Array.isArray(videos)) return [];
  const clips: StockClip[] = [];
  for (const raw of videos) {
    const video = record(raw);
    const user = record(video?.user);
    if (!video || !Number.isSafeInteger(video.id) || usedIds.has(stockUsageKey({ provider: 'pexels', videoId: video.id as number })) || typeof video.url !== 'string' || typeof user?.name !== 'string' || typeof user.url !== 'string') continue;
    if (!usableDuration(video.duration) || !Array.isArray(video.video_files)) continue;
    const files = (video.video_files as unknown[]).map(record).filter((file): file is Record<string, unknown> =>
      !!file && file.file_type === 'video/mp4' && usableWidth(file.width) && allowedFileUrl(file.link, PEXELS_FILE_HOSTS));
    files.sort((a, b) => (a.width as number) - (b.width as number));
    if (!files.length) continue;
    clips.push({
      credit: { provider: 'pexels', videoId: video.id as number, pageUrl: video.url, author: user.name, authorUrl: user.url },
      fileUrl: files[0].link as string, portrait: Number(files[0].height) > Number(files[0].width),
    });
  }
  return clips;
}

// Pixabay renditions (tiny/small/medium/large) carry an approximate byte size, so
// oversized files are skipped before downloading.
export function pixabayCandidates(response: unknown, usedIds: ReadonlySet<string>): StockClip[] {
  const hits = record(response)?.hits;
  if (!Array.isArray(hits)) return [];
  const clips: StockClip[] = [];
  for (const raw of hits) {
    const hit = record(raw);
    if (!hit || !Number.isSafeInteger(hit.id) || usedIds.has(stockUsageKey({ provider: 'pixabay', videoId: hit.id as number }))) continue;
    if (typeof hit.pageURL !== 'string' || !hit.pageURL.startsWith('https://pixabay.com/') || typeof hit.user !== 'string' || !hit.user || !Number.isSafeInteger(hit.user_id) || !usableDuration(hit.duration)) continue;
    const renditions = Object.values(record(hit.videos) ?? {}).map(record).filter((file): file is Record<string, unknown> =>
      !!file && usableWidth(file.width) && typeof file.size === 'number' && file.size > 0 && file.size <= MAX_CLIP_BYTES && allowedFileUrl(file.url, PIXABAY_FILE_HOSTS));
    renditions.sort((a, b) => (a.width as number) - (b.width as number));
    if (!renditions.length) continue;
    clips.push({
      credit: { provider: 'pixabay', videoId: hit.id as number, pageUrl: hit.pageURL, author: hit.user, authorUrl: `https://pixabay.com/users/${encodeURIComponent(hit.user)}-${hit.user_id}/` },
      fileUrl: renditions[0].url as string, portrait: Number(renditions[0].height) > Number(renditions[0].width),
    });
  }
  return clips;
}

export function searchRequest(stock: StockKey, query: string): { url: URL; init: RequestInit } {
  const init: RequestInit = { redirect: 'error', signal: AbortSignal.timeout(15_000) };
  if (stock.provider === 'pixabay') {
    // Pixabay only accepts its key as a query parameter; it is never logged or returned.
    const url = new URL(PIXABAY_SEARCH);
    for (const [name, value] of [['key', stock.key], ['q', query], ['video_type', 'film'], ['safesearch', 'true'], ['per_page', '80']]) url.searchParams.set(name, value);
    return { url, init };
  }
  const url = new URL(PEXELS_SEARCH);
  // Page 1 always exists when there are results; the shuffle adds variety.
  for (const [name, value] of [['query', query], ['orientation', 'portrait'], ['per_page', '80']]) url.searchParams.set(name, value);
  return { url, init: { ...init, headers: { Authorization: stock.key } } };
}

// A themed request asks for its theme made funny; an unthemed one draws comedic
// reaction footage. Later queries only run when an earlier search is empty, so a
// sparse humour search can never dead-end on "no clips found".
export function clipQueries(theme: string | undefined, random: () => number): string[] {
  if (theme) return [`${theme} ${FUNNY_SEARCH_SUFFIX}`, theme];
  const first = FUNNY_CLIP_QUERIES[Math.floor(random() * FUNNY_CLIP_QUERIES.length)];
  const second = FUNNY_CLIP_QUERIES[Math.floor(random() * FUNNY_CLIP_QUERIES.length)];
  return second === first ? [first] : [first, second];
}

export function memePrompt(theme: string): string {
  return [
    'You write short-form meme videos for Quobby, a study app for iOS and Android.',
    'Quobby features: a focus blocker that blocks distracting apps during study sessions; flashcards; study streaks; study points, challenges and prize boxes that reward studying; studying alongside friends.',
    `The attached stock clip is the meme's visual reaction. Only the first ${SHOWN_CLIP_SECONDS} seconds are shown. The text must work for someone who has never seen the clip: the joke comes from the student's situation, never from the clip's setting, props or background.`,
    '- topText: a standalone, funny student line in the style of "Me when…", "POV:…" or "Me:" that fits the energy of the reaction in the clip. It has to make sense with the sound off and with no knowledge of the clip. Max 100 characters. No hashtags, no emojis.',
    '- cta: one short end-card line tying the joke to ONE specific Quobby feature and naming Quobby. Max 80 characters. No emojis.',
    '- title: a short video title. Max 80 characters.',
    '- caption: a 1-2 sentence social post caption that lands the same joke in words, again without describing the clip. No hashtags. Max 300 characters.',
    '- hashtags: 3-6 relevant hashtags, letters/numbers/underscores only.',
    '- clipDescription: one sentence describing what happens in the clip.',
    'Never point at the video with phrases such as "like this …" or "like that …", because the viewer cannot see what you mean. Name only universal study objects (such as notes, flashcards, phone, laptop or exam) and never the clip\'s scenery or props.',
    'Write about revision, exams and procrastination; use the clip only for its expression and timing, not its subject.',
    'Set funny to false unless the clip is genuinely comedic and expressive: a clear facial reaction, a fail, a funny animal or slapstick. Slow pans, scenery, text animations and abstract footage are not funny.',
    'Set suitable to false if the clip cannot support a tasteful study meme, shows children, shows a recognisable brand logo or trademark, or the joke would mock a real person\'s appearance, ethnicity, disability, religion or similar. The humour must be self-directed ("me"), never at the person shown.',
    'Never claim features Quobby does not have. Never mention Pixabay, Pexels, stock footage or AI.',
    `Theme hint: ${theme}`,
  ].join('\n');
}

export const MEME_COPY_SCHEMA = {
  type: 'object',
  properties: {
    suitable: { type: 'boolean' },
    funny: { type: 'boolean' },
    clipDescription: { type: 'string' },
    topText: { type: 'string' },
    cta: { type: 'string' },
    title: { type: 'string' },
    caption: { type: 'string' },
    hashtags: { type: 'array', items: { type: 'string' } },
  },
  required: ['suitable', 'funny', 'clipDescription', 'topText', 'cta', 'title', 'caption', 'hashtags'],
};

export interface MemeCopy { suitable: boolean; funny: boolean; grounded: boolean; topText: string; cta: string; title: string; caption: string; hashtags: string[] }

// The renderer's caption font has no emoji glyphs; strip them rather than burn in boxes.
function plain(value: unknown, max: number, name: string): string {
  if (typeof value !== 'string') throw new MemeGenerationError(`The AI response had no ${name}. Try again.`);
  const text = value.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > max) throw new MemeGenerationError(`The AI ${name} was empty or too long. Try again.`);
  return text;
}

// Universal study objects are about the student, not about the footage.
const STUDY_NOUN = /^(?:notes?|flashcards?|phones?|laptops?|exams?|tests?|quizzes|desks?|revision|deadlines?|semesters?|assignments?|essays?|lectures?|classes?|brains?|study|screens?|books?|pens?|zoom|slides?|timers?|alarms?|teachers?|professors?|schedules?|calendars?|clocks?|grades?)$/i;

// "cold and empty as this cabin" or "like this cabin" only works when the cabin
// is unmistakably on screen; stock clips almost never are, so it reads as
// nonsense. A demonstrative followed by a study object ("this exam") is fine.
export function pointsAtClip(text: string): boolean {
  const pattern = /\b(?:like|as)\s+(?:this|that|these|those)\b/gi;
  for (const match of text.matchAll(pattern)) {
    const subject = text.slice((match.index ?? 0) + match[0].length).match(/^\s+([a-z][\w-]*)/i)?.[1];
    if (!subject || !STUDY_NOUN.test(subject)) return true;
  }
  return false;
}


export function parseMemeCopy(raw: string): MemeCopy {
  let value: Record<string, unknown> | null;
  try { value = record(JSON.parse(raw)); } catch { value = null; }
  if (!value || typeof value.suitable !== 'boolean' || typeof value.funny !== 'boolean') throw new MemeGenerationError('The AI returned an unreadable meme. Try again.');
  const empty = { topText: '', cta: '', title: '', caption: '', hashtags: [] as string[] };
  if (!value.suitable || !value.funny) return { suitable: value.suitable, funny: value.funny, grounded: false, ...empty };
  if (!Array.isArray(value.hashtags)) throw new MemeGenerationError('The AI response had no hashtags. Try again.');
  const hashtags = [...new Set(value.hashtags.filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim().replace(/^#/, '')).filter((tag) => /^[\p{L}\p{N}_]{1,50}$/u.test(tag)))].slice(0, 8);
  const copy = {
    suitable: true,
    funny: true,
    topText: plain(value.topText, 100, 'top text'),
    cta: plain(value.cta, 80, 'call to action'),
    title: plain(value.title, 100, 'title'),
    caption: plain(value.caption, 500, 'caption'),
    hashtags,
  };
  // A line that points at something in the clip only works if that thing is
  // unmistakably on screen, so the copy is unusable and the next clip is tried.
  return [copy.topText, copy.cta, copy.title, copy.caption].some(pointsAtClip)
    ? { ...copy, grounded: false, ...empty }
    : { ...copy, grounded: true };
}

// Reads model text from a non-streaming Interactions API response.
export function interactionText(body: unknown): string {
  const value = record(body);
  if (!value) throw new MemeGenerationError('The AI service returned an invalid response.');
  if (value.status !== undefined && value.status !== 'completed') throw new MemeGenerationError('The AI service did not finish the meme. Try again.');
  const steps = Array.isArray(value.steps) ? value.steps : [];
  const text = steps.map(record).filter((step) => step?.type === 'model_output')
    .flatMap((step) => Array.isArray(step!.content) ? step!.content : [])
    .map(record).filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part!.text as string).join('');
  if (text) return text;
  if (typeof value.output_text === 'string' && value.output_text) return value.output_text;
  throw new MemeGenerationError('The AI service returned no meme text. Try again.');
}

export async function readCapped(response: Response, max: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) throw new MemeGenerationError('The stock clip was too large. Try again.');
  const reader = response.body?.getReader();
  if (!reader) throw new MemeGenerationError('The stock clip download was empty. Try again.');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    // Timeouts and network drops mid-stream reject here; keep the curated message.
    try { chunk = await reader.read(); } catch { throw new MemeGenerationError('The stock clip download was interrupted. Try again.'); }
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > max) { await reader.cancel(); throw new MemeGenerationError('The stock clip was too large. Try again.'); }
    chunks.push(chunk.value);
  }
  if (!size) throw new MemeGenerationError('The stock clip download was empty. Try again.');
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

const timedOut = (error: unknown): boolean => (error as { name?: unknown } | null)?.name === 'TimeoutError';

// The configured model first, then the built-in fallbacks, without duplicates.
export function memeModels(primary: string): string[] {
  return [...new Set([primary.trim(), ...MEME_MODEL_FALLBACKS].filter(Boolean))];
}

// Asks each model in turn for the meme copy. An overloaded, rate-limited,
// timed-out, or unreadable model moves on to the next one; a rejected key or
// malformed request fails for every model and stops immediately.
// One Gemini call chain shared by meme writing and clip vetting: overloaded,
// rate-limited, timed-out or unreadable attempts move on to the next model.
async function requestGeminiJson<T>(models: string[], input: unknown[], schema: unknown, deps: GeminiDeps, deadline: number, parse: (text: string) => T): Promise<T> {
  const now = deps.now ?? Date.now;
  let lastFailure: MemeGenerationError | null = null;
  attempts: for (let round = 0; round < MODEL_ROUNDS; round++) {
    if (round > 0) {
      if (deadline - now() < MIN_MODEL_ATTEMPT_MS + MODEL_RETRY_DELAY_MS) break;
      await new Promise((resolve) => setTimeout(resolve, MODEL_RETRY_DELAY_MS));
    }
    for (const model of models) {
      if (deadline - now() < MIN_MODEL_ATTEMPT_MS) break attempts;
      let answer: Response;
      try {
        answer = await deps.fetcher(GEMINI_INTERACTIONS, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(Math.min(GEMINI_ATTEMPT_TIMEOUT_MS, Math.round(deadline - now()))),
          headers: { 'content-type': 'application/json', 'x-goog-api-key': deps.geminiKey },
          body: JSON.stringify({ model, store: false, input, response_format: { type: 'text', mime_type: 'application/json', schema } }),
        });
      } catch (error) {
        lastFailure = new MemeGenerationError(timedOut(error) ? 'The AI service took too long. Try again.' : 'Could not reach the AI service. Try again.');
        continue;
      }
      if (!answer.ok) {
        await answer.body?.cancel().catch(() => {});
        // An unknown model is replaced by the next one; a bad key or a malformed
        // request fails for every model.
        if (answer.status !== 404 && answer.status !== 429 && answer.status < 500) {
          throw new MemeGenerationError('The AI service rejected the request. Check GEMINI_API_KEY and GEMINI_MODEL.');
        }
        lastFailure = new MemeGenerationError(answer.status === 404 ? 'The AI model was not found. Check GEMINI_MODEL.'
          : answer.status === 429 ? 'The AI service rate limit was reached. Try again later.'
          : 'The AI service is busy right now. Try again in a minute.');
        continue;
      }
      try {
        return parse(interactionText(await answer.json().catch(() => null)));
      } catch (error) {
        if (!(error instanceof MemeGenerationError)) throw error;
        lastFailure = error;
      }
    }
  }
  throw lastFailure ?? new MemeGenerationError('The AI service took too long. Try again.');
}

function videoInput(clip: Uint8Array): { type: 'video'; data: string; mime_type: string; resolution: string } {
  // Encoded once: a maximum-size clip costs ~19 MB of base64 work.
  return { type: 'video', data: Buffer.from(clip.buffer, clip.byteOffset, clip.byteLength).toString('base64'), mime_type: 'video/mp4', resolution: 'low' };
}

async function requestMemeCopy(models: string[], clip: Uint8Array, theme: string, deps: MemeDependencies, deadline: number): Promise<MemeCopy> {
  return requestGeminiJson(models, [videoInput(clip), { type: 'text', text: memePrompt(theme) }], MEME_COPY_SCHEMA, deps, deadline, parseMemeCopy);
}

// Automatic curation: decide whether a stock clip belongs in the funny library.
export async function scoreClipForLibrary(models: string[], clip: Uint8Array, deps: GeminiDeps, deadline: number): Promise<{ funny: boolean; suitable: boolean; description: string }> {
  return requestGeminiJson(models, [videoInput(clip), { type: 'text', text: clipScorePrompt() }], CLIP_SCORE_SCHEMA, deps, deadline, parseClipScore);
}

export const CLIP_SCORE_SCHEMA = {
  type: 'object',
  properties: {
    funny: { type: 'boolean' },
    suitable: { type: 'boolean' },
    description: { type: 'string' },
  },
  required: ['funny', 'suitable', 'description'],
};

// Automatic curation: only clips the model calls genuinely comedic enter the pool.
export function clipScorePrompt(): string {
  return [
    'You are vetting short stock clips for a meme library. Watch the clip and judge it.',
    'funny: true only if the clip is genuinely comedic and expressive on its own - a clear facial reaction, a pratfall, a funny animal, slapstick or a visibly absurd moment. Slow pans, scenery, landscapes, text animations, abstract motion graphics, product shots and calm footage are false.',
    'suitable: false if it shows children, a recognisable brand logo or trademark, or if humour would have to mock a real person\'s appearance, ethnicity, disability or religion.',
    'description: one short sentence describing what happens.',
  ].join('\n');
}

export function parseClipScore(raw: string): { funny: boolean; suitable: boolean; description: string } {
  let parsed: unknown = null;
  try { parsed = JSON.parse(raw); } catch { parsed = null; }
  const value = record(parsed);
  if (!value || typeof value.funny !== 'boolean' || typeof value.suitable !== 'boolean') throw new MemeGenerationError('The AI returned an unreadable clip score. Try again.');
  const description = typeof value.description === 'string' ? value.description.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
  return { funny: value.funny, suitable: value.suitable, description };
}

// Platform-specific descriptions and tags, shared by new and existing campaigns.
export async function generatePlatformCopy(
  input: { title: string; hook: string; cta: string },
  deps: GeminiDeps,
  deadline: number,
): Promise<Partial<Record<Platform, PlatformCopy>>> {
  const copy = await requestGeminiJson(
    memeModels(deps.geminiModel),
    [{ type: 'text', text: platformCopyPrompt(input) }],
    PLATFORM_COPY_SCHEMA, deps, deadline, parsePlatformCopy,
  );
  if (!Object.keys(copy).length) throw new MemeGenerationError('The AI returned no usable platform copy. Try again.');
  return copy;
}

export interface MemeRequest {
  theme?: string;
  platforms: Platform[];
  tiktokPrivateTest?: boolean;
  requiresApproval: boolean;
  scheduledFor?: string | null;
}

export interface GeminiDeps {
  fetcher: typeof fetch;
  geminiKey: string;
  geminiModel: string;
  now?: () => number;
}

export interface MemeDependencies extends GeminiDeps {
  stock: StockKey;
  geminiKey: string;
  geminiModel: string;
  random?: () => number;
  now?: () => number;
  // Namespaced keys from stockUsageKey, e.g. "pixabay:125".
  usedStockIds(): Promise<Set<string>>;
  // Vetted funny clips. When this returns clips, keyword search is skipped.
  libraryClips?(): Promise<StockClip[]>;
  storeClip(bytes: Uint8Array, filename: string): Promise<{ assetId: string; storagePath?: string }>;
  createCampaign(input: CampaignInput, copy: Pick<PublicationCopy, 'caption' | 'hashtags'>, stock: StockCredit): Promise<{ campaignId: string; renderId?: string }>;
}

// Everything the admin's browser needs to render the meme it just generated.
export interface GeneratedMeme {
  campaignId: string;
  stock: StockCredit;
  renderId: string | null;
  clipStoragePath: string | null;
  copy: { title: string; hook: string; cta: string; caption: string; hashtags: string[] };
}

export async function generateMeme(request: MemeRequest, deps: MemeDependencies): Promise<GeneratedMeme> {
  // The search, the AI phase, and the upload all share the route's 120s limit.
  const started = (deps.now ?? Date.now)();
  const random = deps.random ?? Math.random;
  const requested = request.theme?.trim();
  // The joke is always about student life; the clip only supplies the reaction.
  const theme = requested || MEME_THEMES[Math.floor(random() * MEME_THEMES.length)];
  const used = await deps.usedStockIds();
  const library = deps.libraryClips ? await deps.libraryClips() : [];
  // Vetted clips win: search results are unknown footage, so it is only used
  // while the team has not curated anything yet.
  let candidates: StockClip[] = library.filter((clip) => !used.has(stockUsageKey(clip.credit)));
  let lastQuery: string | null = null;
  if (!candidates.length && !library.length) {
    for (const query of clipQueries(requested, random)) {
      lastQuery = query;
      const search = searchRequest(deps.stock, query);
      let found: Response;
      try { found = await deps.fetcher(search.url, search.init); }
      catch { throw new MemeGenerationError('Could not reach the stock video library. Try again.'); }
      if (found.status === 429) throw new MemeGenerationError('The stock video library rate limit was reached. Try again later.');
      if (!found.ok) throw new MemeGenerationError(`The stock video search failed. Check ${deps.stock.provider === 'pixabay' ? 'PIXABAY_API_KEY' : 'PEXELS_API_KEY'}.`);
      const results = await found.json().catch(() => null);
      candidates = deps.stock.provider === 'pixabay' ? pixabayCandidates(results, used) : pexelsCandidates(results, used);
      // A sparse humour search falls through to the next query instead of failing.
      if (candidates.length) break;
    }
  }
  // Shuffle so repeated generations for one theme do not always pick the same clip,
  // then prefer portrait clips (Pixabay has no orientation filter; landscape crops heavily).
  for (let index = candidates.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [candidates[index], candidates[swap]] = [candidates[swap], candidates[index]];
  }
  candidates.sort((a, b) => Number(b.portrait) - Number(a.portrait));
  if (!candidates.length) throw new MemeGenerationError(library.length
    ? 'Every clip in the funny clip library has been used. Add more clips in Content Studio.'
    : `No new stock clips found for "${lastQuery}". Try another theme.`);

  let lastFailure: MemeGenerationError | null = null;
  for (const [attempt, { credit, fileUrl }] of candidates.slice(0, MAX_ATTEMPTS).entries()) {
    if (attempt > 0 && (deps.now ?? Date.now)() - started > SECOND_ATTEMPT_DEADLINE_MS) break;
    let bytes: Uint8Array;
    // A broken or oversized clip moves on to the next candidate instead of failing outright.
    try {
      let download: Response;
      try { download = await deps.fetcher(fileUrl, { signal: AbortSignal.timeout(20_000) }); }
      catch { throw new MemeGenerationError('Could not download the stock clip. Try again.'); }
      const type = download.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
      if (!download.ok || !(type.startsWith('video/') || type === 'application/octet-stream')) {
        await download.body?.cancel().catch(() => {});
        throw new MemeGenerationError('Could not download the stock clip. Try again.');
      }
      bytes = await readCapped(download, MAX_CLIP_BYTES);
    } catch (error) {
      if (!(error instanceof MemeGenerationError)) throw error;
      lastFailure = error;
      continue;
    }

    const copy = await requestMemeCopy(memeModels(deps.geminiModel), bytes, theme, deps, started + GEMINI_PHASE_DEADLINE_MS);
    if (!copy.suitable || !copy.funny || !copy.grounded) continue;

    const stock: StockCredit = credit;
    const asset = await deps.storeClip(bytes, `${credit.provider}-${credit.videoId}.mp4`);
    const created = await deps.createCampaign({
      templateId: MEME_TEMPLATE_ID, title: copy.title, hook: copy.topText, cta: copy.cta, voiceText: '',
      sourceAssetIds: [asset.assetId], platforms: request.platforms,
      ...(request.tiktokPrivateTest !== undefined ? { tiktokPrivateTest: request.tiktokPrivateTest } : {}),
      requiresApproval: request.requiresApproval, scheduledFor: request.scheduledFor ?? null,
    }, { caption: copy.caption, hashtags: copy.hashtags }, stock);
    return {
      campaignId: created.campaignId, stock, renderId: created.renderId ?? null,
      clipStoragePath: asset.storagePath ?? null,
      copy: { title: copy.title, hook: copy.topText, cta: copy.cta, caption: copy.caption, hashtags: copy.hashtags },
    };
  }
  throw lastFailure ?? new MemeGenerationError(library.length
    ? 'The AI rejected the library clips it tried. Deactivate them in the funny clip library or add more.'
    : 'The AI found no suitable clip this time. Try again or choose another theme.');
}
