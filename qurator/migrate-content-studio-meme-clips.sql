-- Curated "funny clip" library for Content Studio memes. Apply manually in the
-- Supabase SQL Editor after migrate-content-studio.sql.
-- Generated memes draw from these clips first; keyword search only runs while
-- the library is empty. Checked server routes use the service role, so this
-- table grants no browser access.
BEGIN;

CREATE TABLE IF NOT EXISTS public.content_studio_meme_clips (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL CHECK (provider IN ('pixabay','pexels')),
    video_id bigint NOT NULL CHECK (video_id > 0),
    label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
    -- Attribution is stored with the clip: stock licences require it.
    page_url text NOT NULL,
    author text NOT NULL,
    author_url text NOT NULL,
    file_url text NOT NULL,
    portrait boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, video_id)
);

CREATE INDEX IF NOT EXISTS content_studio_meme_clips_active_idx
    ON public.content_studio_meme_clips (created_at DESC)
    WHERE active;

ALTER TABLE public.content_studio_meme_clips ENABLE ROW LEVEL SECURITY;

-- manual = added by an admin; auto = vetted and added by the curation job.
ALTER TABLE public.content_studio_meme_clips
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','auto'));

COMMIT;
