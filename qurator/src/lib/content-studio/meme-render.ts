// Browser-side meme composition. Mirrors the Mac worker's layout exactly so the
// preview and the published video match: white top band, cropped clip, then a
// branded end card. Kept free of DOM/network so it is unit-testable.

export const MEME_WIDTH = 1080;
export const MEME_HEIGHT = 1920;
export const MEME_BAND_HEIGHT = 560;
export const MEME_CTA_SECONDS = 3;
export const MEME_FEATURES = ['Focus blocker', 'Flashcards & study streaks', 'Points, challenges & prizes'] as const;

export interface MemeTimeline {
  // Clip seconds that are actually shown before the end card.
  shownSeconds: number;
  ctaStart: number;
  durationSeconds: number;
}

// 5-12 seconds of clip (looping short clips), then a 3 second end card.
export function memeTimeline(clipSeconds: number): MemeTimeline {
  if (!Number.isFinite(clipSeconds) || clipSeconds <= 0) throw new Error('Could not read the clip duration.');
  const shownSeconds = Math.min(Math.max(Math.ceil(clipSeconds), 5), 12);
  return { shownSeconds, ctaStart: shownSeconds, durationSeconds: shownSeconds + MEME_CTA_SECONDS };
}

// input 0 = clip, 1 = top band overlay, 2 = end card overlay.
export function memeFfmpegArgs(timeline: MemeTimeline, hasAudio: boolean): string[] {
  const { durationSeconds, ctaStart } = timeline;
  const clipHeight = MEME_HEIGHT - MEME_BAND_HEIGHT;
  const filters = [
    `color=c=white:s=${MEME_WIDTH}x${MEME_HEIGHT}:r=30:d=${durationSeconds}[bg]`,
    `[0:v]setpts=PTS-STARTPTS,scale=${MEME_WIDTH}:${clipHeight}:force_original_aspect_ratio=increase,crop=${MEME_WIDTH}:${clipHeight},setsar=1,fps=30[clip]`,
    `[bg][clip]overlay=0:${MEME_BAND_HEIGHT}[stack]`,
    `[stack][1:v]overlay=0:0[withTop]`,
    `[withTop][2:v]overlay=0:0:enable='gte(t,${ctaStart})'[card]`,
    `[card]format=yuv420p[video]`,
    // Silent stock clips still need an audio stream for social platforms.
    hasAudio
      ? `[0:a]aresample=48000,atrim=duration=${durationSeconds},asetpts=PTS-STARTPTS,afade=t=out:st=${ctaStart}:d=${MEME_CTA_SECONDS}[audio]`
      : `anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=${durationSeconds}[audio]`,
  ];
  return [
    '-hide_banner', '-nostdin', '-y',
    '-stream_loop', '-1', '-i', 'clip.mp4',
    '-loop', '1', '-i', 'top.png',
    '-loop', '1', '-i', 'end.png',
    '-filter_complex', filters.join(';'),
    '-map', '[video]', '-map', '[audio]',
    '-t', String(durationSeconds), '-r', '30',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-movflags', '+faststart', 'out.mp4',
  ];
}
