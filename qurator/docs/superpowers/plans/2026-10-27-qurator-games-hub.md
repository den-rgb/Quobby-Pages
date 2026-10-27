# Qurator Games Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not commit or push without explicit approval.

**Goal:** Add three original, shared daily Qurator games with server-validated results, profile-linked XP and Games streaks, and a guest claim flow.

**Architecture:** Next.js App Router pages provide a selectable `/games` hub and three mode routes. Server-only challenge generation, transcript validation, Supabase persistence, and a service-role-only reward function protect answers and XP. The browser stores guest transcripts until OAuth returns to the selected mode.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase SSR/client, PostgreSQL SQL migration.

**Spec:** `qurator/docs/superpowers/specs/2026-10-27-qurator-games-hub-design.md`

## Global Constraints

- Every player gets the same challenge for each game on the same UTC date.
- Players can choose one mode; there is no requirement or bonus for playing other modes.
- Letter Ledger accepts only five-letter words with five distinct letters, allows eight guesses, and reports green/yellow/red counts without revealing per-letter positions. Its 400+ answer deck follows a stable shuffled UTC-day schedule and does not repeat until exhausted.
- Number Trail uses five values from 1–9 and a target from 10–99, with `+`, `-`, `*`, `/`, and parentheses; a submitted value instance can be used at most once.
- Riddle Master allows five guesses and displays the answer at the end.
- Any round outcome awards 25 XP once per profile, game, and date. Any one game advances the independent Games streak at most once per UTC date.
- Never modify Quobby study streak fields. Never accept a profile ID or XP amount from the browser.
- Guests can finish before sign-in; preserve the challenge ID and transcript locally and validate them before a one-time claim.
- Use original Qurator names/content and spoiler-free sharing. Do not link to or embed official third-party games.
- Do not add or run tests under the session’s standing instruction; use lint/build and source review for validation.

---

## File Map

| File | Responsibility |
|---|---|
| `qurator/src/lib/games/types.ts` | Game keys, challenge shapes, guess feedback, results, profile stats. |
| `qurator/src/lib/games/dictionary.ts`, `word-list.json`, and `daily-word-groups.json` | Prebuilt five-letter distinct-letter guess dictionary and curated daily answer deck with category hints. |
| `qurator/src/lib/games/challenges.ts` | UTC date scheduling, shared daily challenge selection, number witness creation, riddle catalog. |
| `qurator/src/lib/games/validation.ts` | Word feedback, safe arithmetic expression parsing, riddle matching, transcript replay. |
| `qurator/src/lib/games/server.ts` | Challenge persistence, server-only solution lookup, completion RPC, stats reads. |
| `qurator/supabase/migrations/20261027000000_qurator_games_hub.sql` | Challenge, completion, and profile streak tables plus the idempotent reward function. |
| `qurator/src/app/api/games/daily/route.ts` | Public spoiler-free daily challenge endpoint. |
| `qurator/src/app/api/games/round/route.ts` | Guess, give-up, and authenticated guest-claim endpoint. |
| `qurator/src/app/api/games/stats/route.ts` | Authenticated profile XP and Games statistics endpoint. |
| `qurator/src/app/games/page.tsx` and `qurator/src/app/games/[game]/page.tsx` | Hub and mode route metadata/dispatch. |
| `qurator/src/components/games/games-hub.tsx` | Three independent daily game cards. |
| `qurator/src/components/games/game-player.tsx` | Challenge load, transcript persistence, request lifecycle, OAuth claim resume. |
| `qurator/src/components/games/letter-ledger.tsx` | Word entry and per-guess three-count display. |
| `qurator/src/components/games/number-trail.tsx` | Arithmetic expression entry and feedback. |
| `qurator/src/components/games/riddle-master.tsx` | Riddle prompt and five-guess entry. |
| `qurator/src/components/games/game-result.tsx` | Answer/solution, profile stats or guest prompt, retry, spoiler-free share. |
| `qurator/src/app/profile/page.tsx` | Separate Games streak and completion statistics. |
| `qurator/src/components/layout/navbar.tsx`, `footer.tsx`, `qurator/src/app/page.tsx` | Games navigation and homepage entry. |
| `qurator/src/app/auth/callback/route.ts` | Permit safe OAuth return paths under `/games`. |
| `qurator/src/app/sitemap.ts` | Include `/games` in the sitemap. |

## Tasks

### Task 1: Update and lock the reviewed design

**Files:**
- Modify: `qurator/docs/superpowers/specs/2026-10-27-qurator-games-hub-design.md`

- [x] Incorporate the review: selectable single games, Word500-style count feedback with unique-letter words, Riddle Master, and an outcome screen for every mode.
- [x] Preserve shared daily puzzles, XP, Games streak, guest claims, server validation, and no official third-party content.

### Task 2: Add challenge data, validation rules, and database schema

**Files:**
- Create: `qurator/src/lib/games/types.ts`
- Create: `qurator/src/lib/games/word-list.json`
- Create: `qurator/src/lib/games/dictionary.ts`
- Create: `qurator/src/lib/games/challenges.ts`
- Create: `qurator/src/lib/games/validation.ts`
- Create: `qurator/supabase/migrations/20261027000000_qurator_games_hub.sql`

- [x] Define game keys `letter-ledger`, `number-trail`, and `riddle-master`, plus public challenge and terminal result types.
- [x] Include a prebuilt lowercase five-letter dictionary filtered to distinct letters and at least 400 curated, valid daily answers; deduplicate and filter blocked words.
- [x] Derive daily challenge selection from the ISO UTC date. Use a stable shuffled word deck indexed by UTC day so answers do not repeat until the deck is exhausted. Generate the Number Trail target from a server-held valid expression witness, and store the same challenge row on first request.
- [x] Implement Letter Ledger counts from the five unique letters, and reject malformed or non-dictionary guesses.
- [x] Parse arithmetic using a tokenizer and recursive-descent parser; do not use `eval` or `Function`. Use rational arithmetic so division and exact-target checks are stable. Reject unknown operators, extra number uses, invalid parentheses, divide-by-zero, and expressions not drawn from the provided values.
- [x] Add a small catalog of original rewordings of traditional riddles and normalized answer aliases.
- [x] Create RLS-protected tables for daily challenge public/private data, per-profile per-game daily completions, and Games streak stats. Add a service-role-only transactional RPC that awards 25 XP, applies Quobby’s existing level curve, and advances Games streaks without writing study-streak columns.

### Task 3: Add spoiler-safe server endpoints and reward claims

**Files:**
- Create: `qurator/src/lib/games/server.ts`
- Create: `qurator/src/app/api/games/daily/route.ts`
- Create: `qurator/src/app/api/games/round/route.ts`
- Create: `qurator/src/app/api/games/stats/route.ts`

- [x] `GET /api/games/daily?game=<key>` returns `{ game, challengeId, date, title, data }` and never returns the solution.
- [x] `POST /api/games/round` accepts `{ game, challengeId, guesses, giveUp }`, loads the stored solution, and replays the entire transcript before returning feedback.
- [x] Nonterminal responses return feedback only. A solved transcript, exhausted guess limit, or explicit give-up returns the answer/solution and the final outcome.
- [x] For authenticated terminal requests, derive the profile ID from `createClient().auth.getUser()` and call the service-role-only reward RPC. Return shared XP, level, Games current/best streak, and total completed modes. Never trust client-supplied identity or reward values.
- [x] For guests, return a claimable terminal result without awarding XP. Replaying the same challenge and transcript after OAuth applies the completion once. Duplicate completions return the existing profile stats.
- [x] `GET /api/games/stats` returns the signed-in user’s profile XP/level and Games stats through server-side reads; unauthenticated calls return 401.
- [x] Rate-limit guess and completion requests and return explicit retryable errors when challenge storage or reward persistence is unavailable.

### Task 4: Build the selectable hub and three keyboard-friendly games

**Files:**
- Create: `qurator/src/app/games/page.tsx`
- Create: `qurator/src/app/games/[game]/page.tsx`
- Create: `qurator/src/components/games/games-hub.tsx`
- Create: `qurator/src/components/games/game-player.tsx`
- Create: `qurator/src/components/games/letter-ledger.tsx`
- Create: `qurator/src/components/games/number-trail.tsx`
- Create: `qurator/src/components/games/riddle-master.tsx`
- Create: `qurator/src/components/games/game-result.tsx`

- [x] Render three cards and let each player enter any one game without requiring another completion.
- [x] Render Letter Ledger’s previous guesses and a right-side green/yellow/red numeric summary per guess; do not color individual letters as clues.
- [x] Render five number tiles, target, expression field, and validation feedback. Render a plain text answer solution after a loss or give-up.
- [x] Render Riddle Master’s prompt and remaining guess count; reveal the answer after the fifth incorrect guess or give-up.
- [x] Keep transcripts in local storage per challenge ID. Resume after OAuth, retry a pending claim, and clear only after the server confirms the award or existing completion.
- [x] On any game’s end state, show the answer/solution, then either signed-in stats or Google/Apple sign-in/create-profile actions. Keep the result available if sign-in or XP persistence fails.
- [x] Add keyboard submission and responsive layouts. Share only the game/date/outcome or attempt count, never the word, riddle answer, or number solution.

### Task 5: Connect navigation, profile stats, OAuth, and discovery

**Files:**
- Modify: `qurator/src/components/layout/navbar.tsx`
- Modify: `qurator/src/components/layout/footer.tsx`
- Modify: `qurator/src/app/page.tsx`
- Modify: `qurator/src/app/profile/page.tsx`
- Modify: `qurator/src/app/auth/callback/route.ts`
- Modify: `qurator/src/app/sitemap.ts`

- [x] Add Games links to the navbar, footer, and homepage.
- [x] Add a Games profile section showing current streak, best streak, and completed-mode count, kept visually separate from “Quobby App Stats.”
- [x] Add `/games` to the OAuth callback’s safe return prefixes so a guest can claim from the selected mode.
- [x] Add `/games` to the sitemap and add page metadata with original Qurator game descriptions.

### Task 6: Review and validate the implementation

**Files:** all feature files above.

- [x] Review the final diff for spec coverage, public answer leaks, reliance on client identity/XP, and any writes to Quobby study streak columns.
- [x] Run feature-targeted ESLint on the new game modules, routes, page, footer, homepage, OAuth callback, and sitemap; it passes with one pre-existing homepage image warning. Full `npm run lint` remains red on existing generated FFmpeg files and unrelated React hook findings.
- [x] Run `npm run build` from `qurator/`; production build and TypeScript validation pass.
- [x] Validate the expanded Letter Ledger deck has 447 accepted answers and produces a distinct, stable answer for each of 447 consecutive UTC dates.
- [ ] Manually inspect desktop/mobile rendering and play interactions. The CUA bridge reported no browser surface, and no local browser executable or Playwright/Puppeteer package is installed, so this visual check could not run in this session.
- [x] Do not run or add automated tests under the session’s standing instruction. The SQL migration still needs to be applied to the shared Supabase project before the API can persist challenges and rewards.

## Spec Coverage Checklist

- Single-mode choice, three original game modes, and shared UTC challenges: Tasks 2 and 4.
- Unique-letter word dictionary, 400+ scheduled answers without yearly repeats, and count feedback: Tasks 2 and 4.
- Riddle guesses and answer reveal: Tasks 2 and 4.
- Number expression rules and solution validation: Tasks 2 and 4.
- Answer privacy, retryable reward handling, and idempotent guest claim: Task 3 and Task 4.
- XP, separate Games streak, and profile stats: Tasks 2, 3, and 5.
- Site discovery and OAuth return: Task 5.
- Lint/build validation: Task 6.
