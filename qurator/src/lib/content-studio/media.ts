type SourceFile = { type: string; size: number };

const MAX_OPTIONAL_IMAGES = 8;
const MAX_OPTIONAL_AUDIO_FILES = 1;
export const OPTIONAL_MEDIA_HINT = `Up to ${MAX_OPTIONAL_IMAGES} images and ${MAX_OPTIONAL_AUDIO_FILES} background audio file.`;

// All three V1 templates have one recording followed by optional image/audio layers.
// The cross-package boundary test in ui.test.ts keeps this aligned with the worker.
export function validateSourceFiles(recordings: (SourceFile | null)[], extras: SourceFile[]): string | null {
  if (!recordings.length || recordings.some((file) => !file)) return 'Choose each required recording.';
  if (recordings.length !== 1) return 'Choose exactly one required recording.';
  if (recordings.some((file) => file && !['video/mp4', 'video/quicktime'].includes(file.type))) return 'Required recordings must be MP4 or QuickTime videos.';
  const optionalTypes = ['image/jpeg', 'image/png', 'image/webp', 'audio/wav', 'audio/mpeg', 'audio/aac'];
  const supportedMedia = ['video/mp4', 'video/quicktime', ...optionalTypes];
  if ([...recordings, ...extras].some((file) => file && (!supportedMedia.includes(file.type) || !Number.isSafeInteger(file.size) || file.size <= 0 || file.size > 262144000))) {
    return 'Use supported video, image, or audio files between 1 byte and 250 MB each.';
  }
  if (extras.some((file) => !optionalTypes.includes(file.type))) return 'Optional sources must be supported images or audio.';
  if (extras.filter((file) => file.type.startsWith('audio/')).length > MAX_OPTIONAL_AUDIO_FILES) return 'Choose at most one optional background audio file.';
  if (extras.filter((file) => file.type.startsWith('image/')).length > MAX_OPTIONAL_IMAGES) return 'Choose at most eight optional images.';
  return null;
}
