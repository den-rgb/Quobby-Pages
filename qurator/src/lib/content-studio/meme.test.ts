import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { clipQueries, clipScorePrompt, FUNNY_CLIP_QUERIES, generateMeme, MEME_COPY_SCHEMA, parseClipScore, pointsAtClip, interactionText, MAX_CLIP_BYTES, memeModels, MEME_MODEL_FALLBACKS, memePrompt, parseMemeCopy, pexelsCandidates, pixabayCandidates, type MemeDependencies } from './meme.ts';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { MemeGenerationError } from './errors.ts';
// @ts-expect-error Node's strip-types runner requires the .ts extension.
import { assertCampaignInput } from './state.ts';

const file = (width: number, link = `https://player.vimeo.com/external/${width}.mp4`) => ({ quality: 'sd', file_type: 'video/mp4', width, height: Math.round(width * 16 / 9), link });
const video = (id: number, overrides: Record<string, unknown> = {}) => ({
  id, url: `https://www.pexels.com/video/${id}/`, duration: 8, user: { name: `Creator ${id}`, url: `https://www.pexels.com/@c${id}` },
  video_files: [file(1080), file(540), file(2160), { ...file(720), file_type: 'video/webm' }], ...overrides,
});
const copy = { suitable: true, funny: true, clipDescription: 'A student yawns over a laptop.', topText: 'Me at 2am promising I will start revising tomorrow 😴', cta: 'Block the scroll. Study with Quobby.', title: 'The 2am promise', caption: 'We have all been there. Quobby keeps you on track.', hashtags: ['#studytok', 'exam season', 'Quobby', 'studytok'] };
const interaction = (value: unknown) => ({ id: 'i1', status: 'completed', steps: [{ type: 'thought' }, { type: 'model_output', content: [{ type: 'text', text: JSON.stringify(value) }] }] });

const rendition = (width: number, height: number, size = 2_000_000, url = `https://cdn.pixabay.com/video/2024/01/01/${width}.mp4`) => ({ url, width, height, size, thumbnail: 'https://cdn.pixabay.com/t.jpg' });
const hit = (id: number, overrides: Record<string, unknown> = {}) => ({
  id, pageURL: `https://pixabay.com/videos/id-${id}/`, type: 'film', duration: 9, user: `maker${id}`, user_id: 500 + id,
  videos: { large: rendition(3840, 2160, 60_000_000), medium: rendition(1920, 1080, 20_000_000), small: rendition(1280, 720, 9_000_000), tiny: rendition(960, 540, 3_000_000) }, ...overrides,
});

test('pixabay clips need 3-20 seconds, an unused ID, and an allowed 540-1080px rendition under the size cap', () => {
  const clips = pixabayCandidates({ hits: [
    hit(1), hit(2, { duration: 25 }), hit(3), hit(4, { videos: { tiny: rendition(960, 540, MAX_CLIP_BYTES + 1) } }),
    hit(5, { videos: { tiny: rendition(960, 540, 1000, 'https://evil.example/x.mp4') } }), hit(6, { pageURL: 'javascript:alert(1)' }),
    hit(7, { videos: { tiny: rendition(540, 960) } }), 'junk',
  ] }, new Set(['pixabay:3', 'pexels:1']));
  assert.deepEqual(clips.map((clip) => clip.credit.videoId), [1, 7]);
  assert.equal(clips[0].fileUrl, 'https://cdn.pixabay.com/video/2024/01/01/960.mp4');
  assert.deepEqual(clips[0].credit, { provider: 'pixabay', videoId: 1, pageUrl: 'https://pixabay.com/videos/id-1/', author: 'maker1', authorUrl: 'https://pixabay.com/users/maker1-501/' });
  assert.deepEqual([clips[0].portrait, clips[1].portrait], [false, true]);
  assert.deepEqual(pixabayCandidates(null, new Set()), []);
});

test('pexels clips need 3-20 seconds, an unused ID, and an allowed 540-1080px MP4; the smallest is chosen', () => {
  const clips = pexelsCandidates({ videos: [
    video(1), video(2, { duration: 2 }), video(3, { duration: 25 }), video(4),
    video(5, { video_files: [file(720, 'https://evil.example/clip.mp4'), file(360)] }), video(6, { user: null }), 'junk',
  ] }, new Set(['pexels:4']));
  assert.deepEqual(clips.map((clip) => clip.credit.videoId), [1]);
  assert.equal(clips[0].fileUrl, 'https://player.vimeo.com/external/540.mp4');
  assert.equal(clips[0].portrait, true);
  assert.deepEqual(pexelsCandidates(null, new Set()), []);
});

test('meme copy is validated, emoji-free for the caption font, and hashtags are normalized', () => {
  const parsed = parseMemeCopy(JSON.stringify(copy));
  assert.equal(parsed.topText, 'Me at 2am promising I will start revising tomorrow');
  assert.deepEqual(parsed.hashtags, ['studytok', 'Quobby']);
  assert.deepEqual(parseMemeCopy(JSON.stringify({ suitable: false, funny: false })), { suitable: false, funny: false, grounded: false, topText: '', cta: '', title: '', caption: '', hashtags: [] });
  assert.deepEqual(parseMemeCopy(JSON.stringify({ ...copy, funny: false })), { suitable: true, funny: false, grounded: false, topText: '', cta: '', title: '', caption: '', hashtags: [] });
  // A response without the funny verdict is unreadable rather than assumed funny.
  assert.throws(() => parseMemeCopy(JSON.stringify({ ...copy, funny: undefined })), /unreadable meme/);
  assert.ok((MEME_COPY_SCHEMA.required as string[]).includes('funny'));
  for (const bad of ['not json', JSON.stringify({ ...copy, suitable: 'yes' }), JSON.stringify({ ...copy, topText: 'x'.repeat(101) }), JSON.stringify({ ...copy, cta: '🔥' }), JSON.stringify({ ...copy, hashtags: 'x' })]) {
    assert.throws(() => parseMemeCopy(bad), MemeGenerationError);
  }
});

test('copy that points at something in the clip is unusable so the joke stands alone', () => {
  for (const patch of [
    { topText: 'My brain is as cold and empty as this cabin' },
    { topText: 'Me pretending to study like this' },
    { caption: 'My last study session felt like that cabin.' },
    { title: 'Cold like that cabin' },
    { topText: 'Me sobbing like this video' },
  ]) {
    const parsed = parseMemeCopy(JSON.stringify({ ...copy, ...patch }));
    assert.equal(parsed.grounded, false, JSON.stringify(patch));
    assert.equal(parsed.topText, ''); assert.equal(parsed.caption, '');
  }
  assert.equal(parseMemeCopy(JSON.stringify(copy)).grounded, true);
  // Wording about the student's own study situation is not a clip reference.
  for (const text of ['Me when this exam ends', 'Me as soon as this test is over', 'Me as hard as this exam requires', 'Me pretending this is revision', 'Me staring at this screen']) {
    assert.equal(pointsAtClip(text), false, text);
  }
});

test('clip searches ask for funny footage, with the plain theme only as a fallback', () => {
  assert.deepEqual(clipQueries('exam stress', () => 0), ['exam stress funny', 'exam stress']);
  const picks = [0, 0.4]; let draw = 0;
  assert.deepEqual(clipQueries(undefined, () => picks[draw++]), [FUNNY_CLIP_QUERIES[0], FUNNY_CLIP_QUERIES[4]]);
  assert.deepEqual(clipQueries(undefined, () => 0), [FUNNY_CLIP_QUERIES[0]]);
});

test('automatic curation only accepts clips the model calls funny and suitable', () => {
  assert.deepEqual(parseClipScore(JSON.stringify({ funny: true, suitable: true, description: 'A dog slips on ice.' })), { funny: true, suitable: true, description: 'A dog slips on ice.' });
  assert.equal(parseClipScore(JSON.stringify({ funny: false, suitable: true, description: 'calm waves' })).funny, false);
  assert.throws(() => parseClipScore('not json'), MemeGenerationError);
  assert.throws(() => parseClipScore(JSON.stringify({ funny: 'yes', suitable: true })), /unreadable clip score/);
  assert.match(clipScorePrompt(), /funny: true only if/);
  assert.match(clipScorePrompt(), /abstract motion graphics/);
});

test('interaction text joins model_output text and rejects unfinished or empty responses', () => {
  assert.equal(interactionText(interaction({ a: 1 })), '{"a":1}');
  assert.equal(interactionText({ output_text: '{"b":2}' }), '{"b":2}');
  assert.throws(() => interactionText({ status: 'incomplete', steps: [] }), MemeGenerationError);
  assert.throws(() => interactionText({ status: 'completed', steps: [] }), MemeGenerationError);
  assert.throws(() => interactionText(null), MemeGenerationError);
});

test('the prompt ties the joke to real Quobby features, forbids mocking the person, and keeps the text clip-independent', () => {
  const prompt = memePrompt('exam stress');
  assert.match(prompt, /focus blocker/); assert.match(prompt, /flashcards/); assert.match(prompt, /never at the person shown/);
  assert.match(prompt, /Theme hint: exam stress/);
  // The reported failure: a caption describing a cabin the clip never showed.
  assert.match(prompt, /never seen the clip/); assert.match(prompt, /Never point at the video/); assert.match(prompt, /"liked? this/);
  assert.match(prompt, /Set funny to false/);
});

function harness(gemini: unknown[], videos: unknown[] = [video(10), video(11)], clipBytes = 2048, downloads: (Response | null)[] = [], provider: 'pexels' | 'pixabay' = 'pexels') {
  const calls: { url: string; init: RequestInit }[] = []; const stored: string[] = []; const created: unknown[] = [];
  const replies = [...gemini];
  const deps: MemeDependencies = {
    stock: { provider, key: `${provider}-key` }, geminiKey: 'gemini-key', geminiModel: 'gemini-4-hydrogen', random: () => 0.999, // keeps the shuffle in original order
    usedStockIds: async () => new Set(['pexels:99', 'pixabay:99']),
    storeClip: async (bytes, filename) => { stored.push(`${filename}:${bytes.byteLength}`); return { assetId: '55555555-5555-4555-8555-555555555555' }; },
    createCampaign: async (input, publicationCopy, stock) => { created.push({ input, publicationCopy, stock }); return { campaignId: 'campaign-1' }; },
    fetcher: (async (url: string | URL, init: RequestInit = {}) => {
      calls.push({ url: String(url), init });
      const href = String(url);
      if (href.startsWith('https://api.pexels.com/')) return new Response(JSON.stringify({ videos }), { status: 200 });
      if (href.startsWith('https://pixabay.com/api/')) return new Response(JSON.stringify({ total: videos.length, totalHits: videos.length, hits: videos }), { status: 200 });
      if (href.startsWith('https://player.vimeo.com/') || href.startsWith('https://cdn.pixabay.com/')) return downloads.shift() ?? new Response(new Uint8Array(clipBytes), { status: 200, headers: { 'content-type': 'video/mp4' } });
      const reply = replies.shift();
      return reply instanceof Response ? reply : new Response(JSON.stringify(reply), { status: 200 });
    }) as typeof fetch,
  };
  return { deps, calls, stored, created };
}

test('generation searches, downloads, asks Gemini with the clip, stores it, and creates a valid meme campaign', async () => {
  const { deps, calls, stored, created } = harness([interaction(copy)]);
  const result = await generateMeme({ theme: 'tired student', platforms: ['instagram'], requiresApproval: true }, deps);
  assert.equal(result.campaignId, 'campaign-1');
  const search = new URL(calls[0].url);
  // Humour first: the themed query asks for funny footage, not stock scenery.
  assert.equal(search.pathname, '/v1/videos/search'); assert.equal(search.searchParams.get('query'), 'tired student funny'); assert.equal(search.searchParams.get('orientation'), 'portrait');
  // Always page 1 (later pages can be empty) with the maximum page size.
  assert.equal(search.searchParams.get('page'), null); assert.equal(search.searchParams.get('per_page'), '80');
  assert.equal(new Headers(calls[0].init.headers).get('authorization'), 'pexels-key');
  assert.equal(calls[2].url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
  assert.equal(new Headers(calls[2].init.headers).get('x-goog-api-key'), 'gemini-key');
  assert.ok(!calls.some((call) => call.url.includes('gemini-key') || call.url.includes('pexels-key')));
  const body = JSON.parse(String(calls[2].init.body));
  assert.equal(body.model, 'gemini-4-hydrogen'); assert.equal(body.store, false);
  assert.deepEqual({ ...body.input[0], data: body.input[0].data.length }, { type: 'video', data: Buffer.from(new Uint8Array(2048)).toString('base64').length, mime_type: 'video/mp4', resolution: 'low' });
  assert.equal(body.response_format.mime_type, 'application/json'); assert.ok(body.response_format.schema.required.includes('topText'));
  assert.deepEqual(stored, ['pexels-10.mp4:2048']);
  const campaign = created[0] as { input: Record<string, unknown>; publicationCopy: unknown; stock: unknown };
  assert.doesNotThrow(() => assertCampaignInput(campaign.input, new Date()));
  assert.equal(campaign.input.templateId, 'meme-classic'); assert.equal(campaign.input.voiceText, '');
  assert.equal(campaign.input.hook, 'Me at 2am promising I will start revising tomorrow');
  assert.deepEqual(campaign.publicationCopy, { caption: copy.caption, hashtags: ['studytok', 'Quobby'] });
  assert.deepEqual(campaign.stock, { provider: 'pexels', videoId: 10, pageUrl: 'https://www.pexels.com/video/10/', author: 'Creator 10', authorUrl: 'https://www.pexels.com/@c10' });
});

test('pixabay generation searches safe films, prefers portrait clips, and stores the Pixabay credit', async () => {
  const { deps, calls, stored, created } = harness([interaction(copy)], [hit(20), hit(21, { videos: { tiny: rendition(540, 960) } })], 2048, [], 'pixabay');
  const result = await generateMeme({ theme: 'exam stress', platforms: ['youtube'], requiresApproval: true }, deps);
  const search = new URL(calls[0].url);
  assert.equal(search.origin + search.pathname, 'https://pixabay.com/api/videos/');
  for (const [name, value] of [['key', 'pixabay-key'], ['q', 'exam stress funny'], ['video_type', 'film'], ['safesearch', 'true'], ['per_page', '80']]) assert.equal(search.searchParams.get(name), value);
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[1].url, 'https://cdn.pixabay.com/video/2024/01/01/540.mp4');
  assert.deepEqual(stored, ['pixabay-21.mp4:2048']);
  assert.deepEqual(result.stock, { provider: 'pixabay', videoId: 21, pageUrl: 'https://pixabay.com/videos/id-21/', author: 'maker21', authorUrl: 'https://pixabay.com/users/maker21-521/' });
  assert.equal((created[0] as { stock: unknown }).stock, result.stock);
  const failed = harness([], [], 2048, [], 'pixabay');
  failed.deps.fetcher = (async () => new Response('{"error":"pixabay-key"}', { status: 400 })) as typeof fetch;
  await assert.rejects(generateMeme({ platforms: ['youtube'], requiresApproval: true }, failed.deps), (error: unknown) => error instanceof MemeGenerationError && /PIXABAY_API_KEY/.test(error.message) && !error.message.includes('pixabay-key'));
});

test('an unsuitable clip is skipped for the next candidate; two unsuitable clips fail without storing anything', async () => {
  const retry = harness([interaction({ suitable: false, funny: false }), interaction(copy)]);
  await generateMeme({ platforms: ['youtube'], requiresApproval: false }, retry.deps);
  assert.deepEqual(retry.stored, ['pexels-11.mp4:2048']);
  const none = harness([interaction({ suitable: false, funny: false }), interaction({ suitable: false, funny: false })]);
  await assert.rejects(generateMeme({ platforms: ['youtube'], requiresApproval: false }, none.deps), /no suitable clip/);
  assert.deepEqual(none.stored, []);
});

test('a broken or non-video download moves on to the next clip; a slow first attempt skips the second', async () => {
  const html = harness([interaction(copy)], undefined, 2048, [new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })]);
  await generateMeme({ platforms: ['instagram'], requiresApproval: true }, html.deps);
  assert.deepEqual(html.stored, ['pexels-11.mp4:2048']);
  const failed = harness([interaction(copy)], undefined, 2048, [new Response(null, { status: 404 }), new Response(null, { status: 500 })]);
  await assert.rejects(generateMeme({ platforms: ['instagram'], requiresApproval: true }, failed.deps), /Could not download/);
  let clock = 0;
  const slow = harness([interaction({ suitable: false, funny: false }), interaction(copy)]);
  slow.deps.now = () => clock; slow.deps.usedStockIds = async () => { clock = 0; return new Set(); };
  const fetcher = slow.deps.fetcher;
  slow.deps.fetcher = (async (url: string | URL, init?: RequestInit) => { const response = await fetcher(url, init); if (String(url).includes('generativelanguage')) clock += 50_000; return response; }) as typeof fetch;
  await assert.rejects(generateMeme({ platforms: ['instagram'], requiresApproval: true }, slow.deps), /no suitable clip/);
  assert.equal(slow.calls.filter((call) => call.url.includes('generativelanguage')).length, 1);
});

test('copy that points at the clip is skipped for the next candidate', async () => {
  const retry = harness([interaction({ ...copy, topText: 'My brain is as cold and empty as this cabin' }), interaction(copy)]);
  await generateMeme({ platforms: ['youtube'], requiresApproval: false }, retry.deps);
  assert.deepEqual(retry.stored, ['pexels-11.mp4:2048']);
});

const libraryClip = (videoId = 77) => ({
  credit: { provider: 'pexels' as const, videoId, pageUrl: `https://www.pexels.com/video/${videoId}/`, author: `Creator ${videoId}`, authorUrl: `https://www.pexels.com/@c${videoId}` },
  fileUrl: `https://player.vimeo.com/external/${videoId}.mp4`, portrait: true,
});

test('generation returns the render id, clip path and copy the browser needs', async () => {
  const { deps } = harness([interaction(copy)]);
  deps.storeClip = async () => ({ assetId: 'asset-1', storagePath: 'uploads/abc/clip.mp4' });
  deps.createCampaign = async () => ({ campaignId: 'campaign-1', renderId: 'render-1' });
  const result = await generateMeme({ platforms: ['instagram'], requiresApproval: true }, deps);
  assert.equal(result.renderId, 'render-1');
  assert.equal(result.clipStoragePath, 'uploads/abc/clip.mp4');
  assert.equal(result.copy.hook, 'Me at 2am promising I will start revising tomorrow');
  assert.equal(result.copy.cta, copy.cta);
  assert.deepEqual(result.copy.hashtags, ['studytok', 'Quobby']);
});

test('a vetted funny clip is used instead of searching stock footage', async () => {
  const { deps, calls, created } = harness([interaction(copy)]);
  deps.libraryClips = async () => [libraryClip()];
  const result = await generateMeme({ theme: 'exam stress', platforms: ['instagram'], requiresApproval: true }, deps);
  // No provider search at all: the library decides the footage.
  assert.ok(!calls.some((call) => call.url.includes('api.pexels.com') || call.url.includes('pixabay.com/api')));
  assert.equal(calls[0].url, 'https://player.vimeo.com/external/77.mp4');
  assert.deepEqual(result.stock, libraryClip().credit);
  assert.deepEqual((created[0] as { stock: unknown }).stock, libraryClip().credit);
});

test('an exhausted library fails instead of silently using random footage', async () => {
  const { deps, calls } = harness([]);
  deps.libraryClips = async () => [libraryClip()];
  deps.usedStockIds = async () => new Set(['pexels:77']);
  await assert.rejects(generateMeme({ platforms: ['instagram'], requiresApproval: true }, deps), /Every clip in the funny clip library has been used/);
  assert.ok(!calls.some((call) => call.url.includes('api.pexels.com') || call.url.includes('pixabay.com/api')));
});

test('an empty library still falls back to stock search', async () => {
  const { deps, calls } = harness([interaction(copy)]);
  deps.libraryClips = async () => [];
  await generateMeme({ platforms: ['instagram'], requiresApproval: true }, deps);
  assert.ok(calls.some((call) => call.url.startsWith('https://api.pexels.com/')));
});

test('an unfunny clip is skipped for the next candidate', async () => {
  const retry = harness([interaction({ ...copy, funny: false }), interaction(copy)]);
  await generateMeme({ platforms: ['youtube'], requiresApproval: false }, retry.deps);
  assert.deepEqual(retry.stored, ['pexels-11.mp4:2048']);
});

test('an empty humour search falls back to the plain theme instead of failing', async () => {
  const { deps } = harness([interaction(copy)]);
  const base = deps.fetcher;
  const queries: (string | null)[] = [];
  deps.fetcher = (async (url: string | URL, init: RequestInit = {}) => {
    if (String(url).startsWith('https://api.pexels.com/')) {
      queries.push(new URL(String(url)).searchParams.get('query'));
      if (queries.length === 1) return new Response(JSON.stringify({ videos: [] }), { status: 200 });
    }
    return base(url, init);
  }) as typeof fetch;
  await generateMeme({ theme: 'exam stress', platforms: ['instagram'], requiresApproval: true }, deps);
  assert.deepEqual(queries, ['exam stress funny', 'exam stress']);
});

test('an unthemed request searches comedic reaction footage', async () => {
  const { deps, calls } = harness([interaction(copy)]);
  await generateMeme({ platforms: ['instagram'], requiresApproval: true }, deps);
  const query = new URL(calls[0].url).searchParams.get('query');
  assert.ok(FUNNY_CLIP_QUERIES.includes(query as (typeof FUNNY_CLIP_QUERIES)[number]));
});

test('generation fails safely for no clips and oversized clips', async () => {
  await assert.rejects(generateMeme({ theme: 'x', platforms: ['instagram'], requiresApproval: true }, harness([], [video(99)]).deps), /No new stock clips found for "x"/);
  await assert.rejects(generateMeme({ platforms: ['instagram'], requiresApproval: true }, harness([], undefined, MAX_CLIP_BYTES + 1).deps), /too large/);
});

// Every Gemini call answers with the same status, so no model can rescue the attempt.
function alwaysAnswering(status: number) {
  const { deps, calls } = harness([]);
  const base = deps.fetcher;
  deps.fetcher = (async (url: string | URL, init: RequestInit = {}) => {
    if (!String(url).includes('generativelanguage')) return base(url, init);
    calls.push({ url: String(url), init });
    return new Response('{"error":"gemini-key"}', { status });
  }) as typeof fetch;
  const models = () => calls.filter((call) => call.url.includes('generativelanguage')).map((call) => JSON.parse(String(call.init.body)).model);
  return { deps, models };
}

test('the configured model is tried first, then the fallbacks, without duplicates', () => {
  assert.deepEqual(memeModels('gemini-4-hydrogen'), ['gemini-4-hydrogen', ...MEME_MODEL_FALLBACKS]);
  assert.deepEqual(memeModels(' gemini-3.1-flash-lite '), ['gemini-3.1-flash-lite', 'gemini-3.1-flash-lite-preview']);
});

test('an overloaded model falls back to the next model instead of failing the meme', async () => {
  const { deps, calls } = harness([new Response('{"error":"busy"}', { status: 503 }), interaction(copy)]);
  const result = await generateMeme({ platforms: ['instagram'], requiresApproval: true }, deps);
  assert.equal(result.campaignId, 'campaign-1');
  assert.deepEqual(calls.filter((call) => call.url.includes('generativelanguage')).map((call) => JSON.parse(String(call.init.body)).model),
    ['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
});

test('a spike that clears during the second round still produces the meme', async () => {
  const { deps, calls } = harness([new Response('{"error":"busy"}', { status: 503 }), new Response('{"error":"busy"}', { status: 503 }),
    new Response('{"error":"busy"}', { status: 503 }), interaction(copy)]);
  const result = await generateMeme({ platforms: ['instagram'], requiresApproval: true }, deps);
  assert.equal(result.campaignId, 'campaign-1');
  assert.deepEqual(calls.filter((call) => call.url.includes('generativelanguage')).map((call) => JSON.parse(String(call.init.body)).model),
    ['gemini-4-hydrogen', ...MEME_MODEL_FALLBACKS, 'gemini-4-hydrogen']);
});

test('an unreadable model answer falls back too, while a rejected key stops immediately', async () => {
  const unreadable = harness([new Response('not json', { status: 200 }), interaction(copy)]);
  await generateMeme({ platforms: ['instagram'], requiresApproval: true }, unreadable.deps);
  assert.equal(unreadable.stored.length, 1);
  for (const status of [400, 403]) {
    const rejected = alwaysAnswering(status);
    await assert.rejects(generateMeme({ platforms: ['instagram'], requiresApproval: true }, rejected.deps),
      (error: unknown) => error instanceof MemeGenerationError && /GEMINI_API_KEY/.test(error.message) && !error.message.includes('gemini-key'));
    assert.deepEqual(rejected.models(), ['gemini-4-hydrogen']);
  }
});

test('a model the API does not know is replaced by the next one', async () => {
  const { deps, calls } = harness([new Response('{"error":{"code":404}}', { status: 404 }), interaction(copy)]);
  await generateMeme({ platforms: ['instagram'], requiresApproval: true }, deps);
  assert.deepEqual(calls.filter((call) => call.url.includes('generativelanguage')).map((call) => JSON.parse(String(call.init.body)).model),
    ['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
});

test('every model busy, rate limited, or slow fails with a curated message and no leaked key', async () => {
  for (const [status, message] of [[429, /rate limit/], [503, /busy/]] as const) {
    const { deps, models } = alwaysAnswering(status);
    await assert.rejects(generateMeme({ platforms: ['instagram'], requiresApproval: true }, deps),
      (error: unknown) => error instanceof MemeGenerationError && message.test(error.message) && !error.message.includes('gemini-key'));
    // Both budget-guarded rounds try every model before giving up.
    assert.equal(models().length, 2 * (1 + MEME_MODEL_FALLBACKS.length));
  }
  const slow = harness([]);
  const base = slow.deps.fetcher;
  slow.deps.fetcher = (async (url: string | URL, init: RequestInit = {}) => {
    if (!String(url).includes('generativelanguage')) return base(url, init);
    throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
  }) as typeof fetch;
  await assert.rejects(generateMeme({ platforms: ['instagram'], requiresApproval: true }, slow.deps), /took too long/);
});

test('a model that burns the time budget is the last one attempted', async () => {
  let clock = 0;
  const { deps, calls } = harness([]);
  deps.now = () => clock;
  const base = deps.fetcher;
  deps.fetcher = (async (url: string | URL, init: RequestInit = {}) => {
    if (!String(url).includes('generativelanguage')) return base(url, init);
    calls.push({ url: String(url), init });
    clock += 70_000;
    throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
  }) as typeof fetch;
  await assert.rejects(generateMeme({ platforms: ['instagram'], requiresApproval: true }, deps), /took too long/);
  assert.equal(calls.filter((call) => call.url.includes('generativelanguage')).length, 1);
});
