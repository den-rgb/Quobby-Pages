// Browser composition for the voice-over templates. Mirrors the retired Mac
// worker: looped recording padded to 1080x1920, optional images over the middle
// section, three caption phases, and the voice mixed with optional music.

export const VOICE_TEMPLATES = {
  'focus-blocker-problem-solution': { durationSeconds: 15, accent: '#FFE767', fontSize: 74 },
  'flashcards-before-exam': { durationSeconds: 15, accent: '#9CF4C6', fontSize: 72 },
  'study-streak-meme': { durationSeconds: 12, accent: '#DEB4FF', fontSize: 78 },
} as const;

export type VoiceTemplateId = keyof typeof VOICE_TEMPLATES;
export const isVoiceTemplate = (id: string): id is VoiceTemplateId => Object.hasOwn(VOICE_TEMPLATES, id);

// The CTA caption occupies the final four seconds.
export const VOICE_CTA_SECONDS = 4;

export interface VoiceTimeline { durationSeconds: number; ctaStart: number }

export function voiceOverTimeline(templateId: VoiceTemplateId, voiceSeconds: number): VoiceTimeline {
  if (!Number.isFinite(voiceSeconds) || voiceSeconds <= 0) throw new Error('Could not read the voice-over duration.');
  const durationSeconds = Math.max(VOICE_TEMPLATES[templateId].durationSeconds, Math.ceil(voiceSeconds + 1));
  if (durationSeconds > 60) throw new Error('The voice-over is too long; keep it under a minute.');
  return { durationSeconds, ctaStart: durationSeconds - VOICE_CTA_SECONDS };
}

export interface VoiceOverInputs {
  durationSeconds: number;
  recordingName: string;
  imageNames: readonly string[];
  musicName?: string | null;
}

// input 0 = recording, 1 = voice, then images, optional music, then hook/title/CTA.
export function voiceOverFfmpegArgs(input: VoiceOverInputs): string[] {
  const { durationSeconds, recordingName, imageNames, musicName } = input;
  if (!Number.isFinite(durationSeconds) || durationSeconds < 9 || durationSeconds > 60) throw new Error('Render duration must be between 9 and 60 seconds.');
  const imageBase = 2;
  const musicIndex = musicName ? imageBase + imageNames.length : -1;
  const captionBase = imageBase + imageNames.length + (musicName ? 1 : 0);
  const middleEnd = durationSeconds - VOICE_CTA_SECONDS;

  const filters = [
    '[0:v]setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x101014,setsar=1,fps=30[base0]',
  ];
  imageNames.forEach((_name, index) => {
    // Images share the middle section evenly, like the worker.
    const start = 4 + (durationSeconds - 8) * index / imageNames.length;
    const end = 4 + (durationSeconds - 8) * (index + 1) / imageNames.length;
    filters.push(`[${imageBase + index}:v]setpts=PTS-STARTPTS,scale=900:1100:force_original_aspect_ratio=decrease,setsar=1[image${index}]`);
    filters.push(`[base${index}][image${index}]overlay=(W-w)/2:(H-h)/2:enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'[base${index + 1}]`);
  });
  filters.push(`[base${imageNames.length}][${captionBase}:v]overlay=0:0:enable='between(t,0,4)'[cap1]`);
  filters.push(`[cap1][${captionBase + 1}:v]overlay=0:0:enable='between(t,4,${middleEnd})'[cap2]`);
  filters.push(`[cap2][${captionBase + 2}:v]overlay=0:0:enable='between(t,${middleEnd},${durationSeconds})'[video0]`);
  filters.push('[video0]format=yuv420p[video]');
  filters.push(`[1:a]aresample=48000,apad=whole_dur=${durationSeconds},atrim=duration=${durationSeconds},asetpts=PTS-STARTPTS[voice]`);
  if (musicName) {
    filters.push(`[${musicIndex}:a]aresample=48000,volume=0.15,atrim=duration=${durationSeconds},asetpts=PTS-STARTPTS[music]`);
    filters.push('[voice][music]amix=inputs=2:duration=first:normalize=0[audio]');
  } else {
    filters.push('[voice]anull[audio]');
  }

  const args = ['-hide_banner', '-nostdin', '-y', '-stream_loop', '-1', '-i', recordingName, '-i', 'voice.wav'];
  for (const name of imageNames) args.push('-loop', '1', '-i', name);
  if (musicName) args.push('-stream_loop', '-1', '-i', musicName);
  args.push('-loop', '1', '-i', 'hook.png', '-loop', '1', '-i', 'title.png', '-loop', '1', '-i', 'cta.png');
  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '[video]', '-map', '[audio]',
    '-t', String(durationSeconds), '-r', '30',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-movflags', '+faststart', 'out.mp4',
  );
  return args;
}
