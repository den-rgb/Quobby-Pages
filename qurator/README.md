# Qurator

Interactive tutorial creation and playback platform. Part of the Quobby ecosystem — create step-by-step tutorials for board games, cooking, software, music, and more.

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **UI:** React 19, Tailwind CSS 4, Lucide icons
- **State:** Zustand
- **Backend:** Supabase (Auth, PostgREST, Storage)
- **Flow Editor:** XYFlow (React Flow)
- **Video:** FFmpeg WASM (client-side compression)

## Getting Started

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `ADMIN_USER_IDS` | Server-only comma-separated admin user UUID allowlist |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase service-role key required for Content Studio private Storage and RPCs |
| `CONTENT_STUDIO_MACHINE_TOKEN` | Server-only shared secret for the paired Mac worker; it must exactly match its Keychain `machine` item. Never expose it as `NEXT_PUBLIC_*`. |
| `PIXABAY_API_KEY` | Server-only Pixabay API key for Content Studio "Generate meme" stock clips (free at pixabay.com/api/docs); preferred when both stock keys are set |
| `PEXELS_API_KEY` | Server-only Pexels API key, an alternative stock clip source (free at pexels.com/api) |
| `GEMINI_API_KEY` | Server-only Gemini API key; Gemini watches each stock clip and writes the meme text (falls back to `GOOGLE_GENERATIVE_AI_API_KEY`) |
| `GEMINI_MODEL` | (Optional) Gemini model ID, default `gemini-3.5-flash-lite`; an overloaded model automatically falls back to `gemini-3.1-flash-lite` |
| `BGG_API_TOKEN` | (Optional) BoardGameGeek API bearer token |

## Database Setup

Qurator uses the same Supabase project as the Quobby app. Run `../Quobby/supabase_setup.sql` in the Supabase SQL Editor. For categories migration, run `migrate-categories.sql` afterwards.

## Content Studio (internal admin only)

Content Studio lives at `/admin/content-studio` and is available only to IDs in
`ADMIN_USER_IDS`. It creates captioned Quobby promotional videos
from recorded and licensed assets using a paired, self-hosted Mac worker; it
does not use AI presenters or a render/TTS subscription.

Before using it outside development:

1. Set `ADMIN_USER_IDS`, `SUPABASE_SERVICE_ROLE_KEY`, and a long random
   `CONTENT_STUDIO_MACHINE_TOKEN` in the Qurator server environment. Keep all
   three server-only.
2. Apply [`migrate-content-studio.sql`](./migrate-content-studio.sql) in the
   intended non-production Supabase project's SQL Editor. This creates private
   storage, RLS-protected tables, and the worker RPCs. Do not make the bucket
   public or add browser RLS policies for it. Then apply
   [`migrate-content-studio-meme-clips.sql`](./migrate-content-studio-meme-clips.sql)
   for the funny clip library and
   [`migrate-content-studio-browser-render.sql`](./migrate-content-studio-browser-render.sql)
   so an admin's browser can complete a render and mark a post published. Until
   they are applied memes fall back to stock search and browser renders cannot
   be saved.
3. Rendering and publishing no longer need the companion Mac worker: every
   template renders in the admin's browser and publishing is manual. The worker
   and its [setup guide](../content-studio-worker/README.md) remain only for the
   historical Keychain-based provider flows.
4. Manually verify a render, upload, approval/review state, and each permitted
   provider sandbox flow before any production campaign. Social credentials and
   provider app approval are not supplied by this repository.

**Generate meme** creates a campaign with one click and needs no Mac worker.
Qurator picks footage from the **funny clip library** — Pixabay/Pexels videos
that a scheduled curation job has already had Gemini vet as genuinely comedic —
so nobody has to choose clips by hand. Recently used clips are skipped, so the
whole library rotates before a clip comes back; only while the library is empty
does Qurator search Pixabay (or Pexels) directly.

Gemini watches the chosen clip and writes a classic top-text meme caption plus an
end-card line tying it to a Quobby feature. The admin's **browser then renders the
video** with ffmpeg.wasm (clip audio, or silence for silent clips), uploads it to
private Storage, and the render moves to review with the Quobby logo and feature
list on the end card. Publishing is manual: approve the render, download the MP4
(or use the preview) and post it, then mark each platform as published with its
link.

It needs `PIXABAY_API_KEY` or `PEXELS_API_KEY`, plus `GEMINI_API_KEY`. Clips that
are not comedic, and copy that points at something the clip does not show, are
skipped. Review the caption and preview before approving; the dashboard credits
the clip creator.

Each publication also gets **its own description and tag list** per platform
(Instagram Reels, TikTok, YouTube Shorts), written in one extra model call. New
generations write them automatically; for an existing campaign use **Generate
platform copy** in the review panel (or edit a single platform by hand), and the
copy is regenerated for every publication that is not published yet.

### Voice-over templates

The three curated templates (focus blocker, flashcards, study streak) also render
in the browser: the uploaded recording is looped and padded to 1080×1920, optional
images and background music are mixed in, and three caption phases (hook, title,
CTA) are composited over it. The voice-over is synthesized by Gemini TTS
(`gemini-3.8-flash-tts`, overridable with `GEMINI_TTS_MODEL`) and muxed with the
recording. Rendering takes as long as the encode needs, so keep the tab open;
an unfinished render can be retried from the campaign panel.

### Automatic clip curation

`GET /api/internal/content-studio/curate` tops the library up to 30 clips: it
searches a humour query, lets Gemini veto anything that is not genuinely funny,
and stores the winners with `source = 'auto'`. `vercel.json` runs it once a day
(Vercel Hobby only allows daily cron jobs); run the endpoint by hand with the
bearer token if you want to fill the library faster. Authenticate the request
with `Authorization: Bearer $CRON_SECRET` and set `CRON_SECRET` to the same value
as `CONTENT_STUDIO_MACHINE_TOKEN` (the endpoint also accepts the machine token
header). It is a no-op while the library is full.

The current TikTok Direct Post rules do not permit public publishing from an
internal team upload utility. The dashboard allows only an explicitly selected
`SELF_ONLY` private integration test; it never reports this as a public post.
