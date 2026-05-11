export const FREE_VIDEO_RAW_MAX_BYTES = 250 * 1024 * 1024;
export const PREMIUM_VIDEO_RAW_MAX_BYTES = 1024 * 1024 * 1024;

export function videoRawMaxBytes(isPremium: boolean): number {
  return isPremium ? PREMIUM_VIDEO_RAW_MAX_BYTES : FREE_VIDEO_RAW_MAX_BYTES;
}

export function videoRawMaxLabel(isPremium: boolean): string {
  return isPremium ? '1 GB' : '250 MB';
}

export const PREMIUM_FEATURES = [
  {
    title: 'Larger video uploads',
    description: 'Upload videos up to 1 GB (free users: 250 MB).',
  },
  {
    title: 'Video splitting',
    description: 'Split long videos into segments, each becoming its own tutorial step.',
  },
  {
    title: 'Tutorial analytics',
    description: 'See play counts, ratings, and trends for every tutorial you publish.',
  },
] as const;
