import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50 MB

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

export async function POST(request: NextRequest) {
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
      { error: `File type '${contentType}' is not allowed` },
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

  const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
  const filename = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from('tutorial-assets')
    .upload(filename, buffer, { contentType, upsert: false });

  if (uploadErr) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadErr.message}` },
      { status: 500 }
    );
  }

  const { data: urlData } = supabase.storage
    .from('tutorial-assets')
    .getPublicUrl(filename);

  return NextResponse.json({
    url: urlData.publicUrl,
    filename: file.name,
    type: isVideo ? 'video' : 'image',
    size_bytes: file.size,
  });
}
