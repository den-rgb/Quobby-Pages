import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50 MB

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

const MAGIC_BYTES: [string, number[]][] = [
  ['image/jpeg', [0xFF, 0xD8, 0xFF]],
  ['image/png', [0x89, 0x50, 0x4E, 0x47]],
  ['image/gif', [0x47, 0x49, 0x46, 0x38]],
  ['image/webp', [0x52, 0x49, 0x46, 0x46]], // RIFF header; WebP follows at offset 8
  ['video/mp4', []], // ftyp box checked separately
  ['video/webm', [0x1A, 0x45, 0xDF, 0xA3]],
  ['video/quicktime', []], // ftyp box checked separately
];

function detectMime(buf: Uint8Array): string | null {
  if (buf.length < 12) return null;

  for (const [mime, sig] of MAGIC_BYTES) {
    if (sig.length === 0) continue;
    if (sig.every((b, i) => buf[i] === b)) {
      if (mime === 'image/webp') {
        const tag = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
        return tag === 'WEBP' ? 'image/webp' : null;
      }
      return mime;
    }
  }

  // MP4/MOV: ftyp box at offset 4
  const ftyp = String.fromCharCode(buf[4], buf[5], buf[6], buf[7]);
  if (ftyp === 'ftyp') {
    const brand = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
    if (['qt  ', 'moov'].includes(brand)) return 'video/quicktime';
    return 'video/mp4';
  }

  return null;
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const contentType = file.type;
  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: 'File type is not allowed' },
      { status: 400 }
    );
  }

  const isVideo = ALLOWED_VIDEO_TYPES.includes(contentType);
  const maxBytes = isVideo ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;

  if (file.size > maxBytes) {
    const limitMB = maxBytes / (1024 * 1024);
    return NextResponse.json(
      { error: `File exceeds ${limitMB} MB limit` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const detected = detectMime(new Uint8Array(buffer.buffer, buffer.byteOffset, Math.min(buffer.length, 16)));
  if (!detected || !ALLOWED_TYPES.includes(detected)) {
    return NextResponse.json(
      { error: 'File content does not match an allowed type' },
      { status: 400 }
    );
  }

  const actualType = detected;
  const actualIsVideo = ALLOWED_VIDEO_TYPES.includes(actualType);
  const actualMaxBytes = actualIsVideo ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
  if (file.size > actualMaxBytes) {
    const limitMB = actualMaxBytes / (1024 * 1024);
    return NextResponse.json(
      { error: `File exceeds ${limitMB} MB limit` },
      { status: 400 },
    );
  }
  const ext = file.name.split('.').pop() || (actualIsVideo ? 'mp4' : 'jpg');
  const filename = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('tutorial-assets')
    .upload(filename, buffer, { contentType: actualType, upsert: false });

  if (uploadErr) {
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }

  const { data: urlData } = supabase.storage
    .from('tutorial-assets')
    .getPublicUrl(filename);

  return NextResponse.json({
    url: urlData.publicUrl,
    filename: file.name,
    type: actualIsVideo ? 'video' : 'image',
    size_bytes: file.size,
  });
}
