import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capture, run } from './process.ts';
import { TEMPLATES, validateRenderRequest } from './templates.ts';
import type { ProcessCapture, ProcessRunner, RenderRequest, RenderResult, RenderSpec } from './types.ts';

function literalAss(text: string): string {
  // ASS overrides and event newlines cannot be allowed through from campaign copy.
  return text.replace(/\\/g, '＼').replace(/\{/g, '｛').replace(/\}/g, '｝').replace(/[\r\n\u0000-\u001f\u007f]/g, ' ');
}

function assTime(seconds: number): string {
  const centiseconds = Math.round(seconds * 100);
  return `${Math.floor(centiseconds / 360000)}:${String(Math.floor(centiseconds / 6000) % 60).padStart(2, '0')}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`;
}

export function buildAssCaptions(spec: RenderSpec, durationSeconds: number): string {
  const template = TEMPLATES[spec.templateId];
  const events = [[0, 4, 'Hook', spec.hook], [4, durationSeconds - 4, 'Title', spec.title], [durationSeconds - 4, durationSeconds, 'CTA', spec.cta]] as const;
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Hook,Arial,${template.fontSize},&H00FFFFFF,&H00FFFFFF,&H00101014,&H90101014,-1,0,0,0,100,100,0,0,3,10,0,8,80,80,200,1
Style: Title,Arial,64,&H00FFFFFF,&H00FFFFFF,&H00101014,&H90101014,-1,0,0,0,100,100,0,0,3,10,0,2,80,80,300,1
Style: CTA,Arial,68,${template.accent},&H00FFFFFF,&H00101014,&H90101014,-1,0,0,0,100,100,0,0,3,10,0,2,80,80,300,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.map(([start, end, style, text]) => `Dialogue: 0,${assTime(start)},${assTime(end)},${style},,0,0,0,,${literalAss(text)}`).join('\n')}
`;
}

function filterPath(path: string): string {
  // Escape the AVOption value first, then the surrounding filtergraph grammar.
  const option = path.replace(/[\\':]/g, '\\$&');
  return option.replace(/[\\'\[\],;]/g, '\\$&');
}

export function buildFfmpegArgs(request: RenderRequest, durationSeconds = TEMPLATES[request.spec.templateId]?.durationSeconds): string[] {
  validateRenderRequest(request);
  if (!request.voicePath) throw new Error('Use buildMemeFfmpegArgs for templates without a voice-over.');
  if (!Number.isFinite(durationSeconds) || durationSeconds < 9 || durationSeconds > 60) throw new Error('Render duration must be between 9 and 60 seconds.');
  const source = request.assets.find((asset) => asset.id === request.spec.sourceAssetIds[0])!;
  const images = request.spec.sourceAssetIds.map((id) => request.assets.find((asset) => asset.id === id)!).filter((asset) => asset.mimeType.startsWith('image/'));
  const music = request.assets.find((asset) => asset.mimeType.startsWith('audio/'));
  const args = ['-hide_banner', '-nostdin', '-y', '-stream_loop', '-1', '-i', source.path, '-i', request.voicePath];
  for (const image of images) args.push('-loop', '1', '-i', image.path);
  if (music) args.push('-stream_loop', '-1', '-i', music.path);
  const filters = ['[0:v]setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x101014,setsar=1,fps=30[base0]'];
  images.forEach((_image, index) => {
    const start = 4 + (durationSeconds - 8) * index / images.length;
    const end = 4 + (durationSeconds - 8) * (index + 1) / images.length;
    filters.push(`[${index + 2}:v]setpts=PTS-STARTPTS,scale=900:1100:force_original_aspect_ratio=decrease,setsar=1[image${index}]`);
    filters.push(`[base${index}][image${index}]overlay=(W-w)/2:(H-h)/2:enable='between(t,${start},${end})'[base${index + 1}]`);
  });
  filters.push(`[base${images.length}]ass=filename=${filterPath(join(request.outputDirectory, 'captions.ass'))},format=yuv420p[video]`);
  filters.push(`[1:a]aresample=48000,apad=whole_dur=${durationSeconds},atrim=duration=${durationSeconds},asetpts=PTS-STARTPTS[voice]`);
  if (music) {
    filters.push(`[${images.length + 2}:a]aresample=48000,volume=0.15,atrim=duration=${durationSeconds},asetpts=PTS-STARTPTS[music]`);
    filters.push('[voice][music]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[audio]');
  } else filters.push('[voice]anull[audio]');
  args.push('-filter_complex', filters.join(';'), '-map', '[video]', '-map', '[audio]', '-t', String(durationSeconds), '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', join(request.outputDirectory, 'output.mp4'));
  return args;
}

const MEME_BAND_HEIGHT = 560;
const MEME_CTA_SECONDS = 3;
// Bundled with the worker so every end card is branded, whatever the campaign.
export const MEME_LOGO_PATH = fileURLToPath(new URL('../assets/quobby-logo.png', import.meta.url));
const MEME_LOGO_SIZE = 300;
// Always shown on the end card, independent of the campaign's single CTA line.
export const MEME_FEATURES = ['Focus blocker', 'Flashcards & study streaks', 'Points, challenges & prizes'] as const;

// The clip plays for 5-12 seconds (looping short clips), then a 3-second CTA card.
export function memeDurationSeconds(clipSeconds: number): number {
  if (!Number.isFinite(clipSeconds) || clipSeconds <= 0) throw new Error('Could not read the meme clip duration.');
  return Math.min(Math.max(Math.ceil(clipSeconds), 5), 12) + MEME_CTA_SECONDS;
}

export function buildMemeAss(spec: RenderSpec, durationSeconds: number): string {
  const template = TEMPLATES['meme-classic'];
  const ctaStart = durationSeconds - MEME_CTA_SECONDS;
  // Our own override tags style the end card; campaign copy is escaped by literalAss.
  return `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Top,Arial Black,${template.fontSize},&H00000000,&H00000000,&H00FFFFFF,&H00FFFFFF,0,0,0,0,100,100,0,0,1,0,0,8,60,60,90,1
Style: CTA,Arial Black,72,&H00FFFFFF,&H00FFFFFF,&H00101014,&H00101014,0,0,0,0,100,100,0,0,1,0,0,5,80,80,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,${assTime(0)},${assTime(ctaStart)},Top,,0,0,0,,{\\an5\\pos(540,${MEME_BAND_HEIGHT / 2})}${literalAss(spec.hook)}
Dialogue: 0,${assTime(ctaStart)},${assTime(durationSeconds)},CTA,,0,0,0,,{\\an5\\pos(540,1180)}{\\fs112\\c&H${template.accent.slice(4)}&}Quobby{\\r}\\N{\\fs56}${literalAss(spec.cta)}\\N\\N{\\fs40\\c&HB8B8C0&}${MEME_FEATURES.map((feature) => `• ${literalAss(feature)}`).join('\\N')}
`;
}

export function buildMemeFfmpegArgs(request: RenderRequest, durationSeconds: number, hasAudio: boolean): string[] {
  validateRenderRequest(request);
  if (TEMPLATES[request.spec.templateId].voiceOver) throw new Error('Use buildFfmpegArgs for voice-over templates.');
  if (!Number.isFinite(durationSeconds) || durationSeconds < 8 || durationSeconds > 15) throw new Error('Meme duration must be between 8 and 15 seconds.');
  const source = request.assets.find((asset) => asset.id === request.spec.sourceAssetIds[0])!;
  const ctaStart = durationSeconds - MEME_CTA_SECONDS;
  const clipHeight = 1920 - MEME_BAND_HEIGHT;
  const filters = [
    `color=c=white:s=1080x1920:r=30:d=${durationSeconds}[bg]`,
    `[0:v]setpts=PTS-STARTPTS,scale=1080:${clipHeight}:force_original_aspect_ratio=increase,crop=1080:${clipHeight},setsar=1,fps=30[clip]`,
    `[bg][clip]overlay=0:${MEME_BAND_HEIGHT}[stack]`,
    `[stack]drawbox=x=0:y=0:w=iw:h=ih:color=0x101014:t=fill:enable='gte(t,${ctaStart})'[card]`,
    `[1:v]scale=${MEME_LOGO_SIZE}:${MEME_LOGO_SIZE},setsar=1[logo]`,
    `[card][logo]overlay=x=(W-w)/2:y=520:enable='gte(t,${ctaStart})'[branded]`,
    `[branded]ass=filename=${filterPath(join(request.outputDirectory, 'captions.ass'))},format=yuv420p[video]`,
    // Stock clips are often silent; AAC output still needs an audio stream.
    hasAudio
      ? `[0:a]aresample=48000,atrim=duration=${durationSeconds},asetpts=PTS-STARTPTS,afade=t=out:st=${ctaStart}:d=${MEME_CTA_SECONDS}[audio]`
      : `anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=${durationSeconds}[audio]`,
  ];
  return ['-hide_banner', '-nostdin', '-y', '-stream_loop', '-1', '-i', source.path, '-loop', '1', '-i', MEME_LOGO_PATH, '-filter_complex', filters.join(';'), '-map', '[video]', '-map', '[audio]', '-t', String(durationSeconds), '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', join(request.outputDirectory, 'output.mp4')];
}

export async function renderVideo(request: RenderRequest, dependencies: { run: ProcessRunner; capture: ProcessCapture } = { run, capture }): Promise<RenderResult> {
  validateRenderRequest(request);
  for (const path of [...request.assets.map((asset) => asset.path), ...(request.voicePath ? [request.voicePath] : [])]) {
    const file = await stat(path);
    if (!file.isFile() || file.size === 0) throw new Error('Source media must be a nonempty local file.');
  }
  const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
  let durationSeconds: number; let captions: string; let args: string[];
  if (request.voicePath) {
    const voiceDuration = Number((await dependencies.capture(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', request.voicePath])).trim());
    if (!Number.isFinite(voiceDuration) || voiceDuration <= 0 || voiceDuration > 59) throw new Error('Voice duration must be positive and under 59 seconds.');
    durationSeconds = Math.max(TEMPLATES[request.spec.templateId].durationSeconds, Math.ceil(voiceDuration + 1));
    captions = buildAssCaptions(request.spec, durationSeconds);
    args = buildFfmpegArgs(request, durationSeconds);
  } else {
    const logo = await stat(MEME_LOGO_PATH).catch(() => null);
    if (!logo?.isFile()) throw new Error('The worker logo asset is missing from assets/quobby-logo.png.');
    const source = request.assets.find((asset) => asset.id === request.spec.sourceAssetIds[0])!;
    durationSeconds = memeDurationSeconds(Number((await dependencies.capture(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', source.path])).trim()));
    const hasAudio = (await dependencies.capture(ffprobe, ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', source.path])).trim() !== '';
    captions = buildMemeAss(request.spec, durationSeconds);
    args = buildMemeFfmpegArgs(request, durationSeconds, hasAudio);
  }
  await mkdir(request.outputDirectory, { recursive: true, mode: 0o700 });
  const outputPath = join(request.outputDirectory, 'output.mp4');
  await rm(outputPath, { force: true });
  await writeFile(join(request.outputDirectory, 'captions.ass'), captions, { mode: 0o600 });
  await dependencies.run(process.env.FFMPEG_PATH || 'ffmpeg', args);
  const output = await stat(outputPath).catch(() => null);
  if (!output?.isFile() || output.size === 0) throw new Error('FFmpeg did not produce a nonempty output MP4.');
  return { outputPath, durationMs: durationSeconds * 1000 };
}
