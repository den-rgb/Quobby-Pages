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
| `NEXT_PUBLIC_ADMIN_USER_IDS` | Comma-separated admin user UUIDs |
| `BGG_API_TOKEN` | (Optional) BoardGameGeek API bearer token |

## Database Setup

Run `supabase_qurator_setup.sql` in the Supabase SQL Editor. For categories migration, run `migrate-categories.sql` afterwards.
