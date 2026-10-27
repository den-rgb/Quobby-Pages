# Qurator Games Hub

**Status:** Design for user review
**Date:** 2026-10-27

## Goal

Add a Games section to Qurator where people can play an original daily word puzzle and an original daily number puzzle. The puzzles are available inside Qurator, use Qurator branding and content, and are the same for every player on a given UTC date. The daily pair, profile-linked game streak, shared Quobby XP, and post-game profile prompt are the Qurator-specific twist.

## First-release experience

- Add a `/games` hub reachable from the navbar, footer, and a homepage entry.
- Show two cards: a word puzzle and a number puzzle. Players may play either first.
- The word puzzle uses a hidden five-letter word, up to six guesses, feedback for exact-position letters, misplaced letters, and absent letters, plus one contextual hint shown from the start. Its word list, clues, interface, and name are original.
- The number puzzle gives five positive values from 1–9 (duplicates allowed) and a target from 10–99. Players may use each value instance at most once with addition, subtraction, multiplication, division, and parentheses to reach the target exactly. The generator verifies that every puzzle has a solution. There is no timer. Its puzzle set, interface, and name are original.
- Each date maps to one shared word puzzle and one shared number puzzle. The pair changes at 00:00 UTC. There are no personalized variants in v1.
- A round ends when it is solved, the word guesses run out, or the player chooses to reveal the answer/give up. Finishing any outcome grants the completion reward. Results can be shared without revealing answers.
- Archives, practice modes, leaderboards, player-created puzzles, additional game modes, and official third-party games are out of scope for v1.

## Rewards and profiles

- Award 25 XP once per profile, game, and puzzle date. Replaying a completed daily round does not award more XP.
- Add game XP to the existing `profiles.total_xp` and update `profiles.level` so it appears in Qurator's existing profile progress.
- Keep a separate Games current/best streak tied to the profile. Completing either daily game advances the Games streak once for that date; completing both does not advance it twice.
- Leave Quobby's study `current_streak` and `longest_streak` unchanged. Show Games streak information in a Qurator Games profile section.
- After a guest finishes a round, show a dismissible sign-in/create-profile prompt. Keep the result on the device while the guest continues. After sign-in, return to `/games` and offer a one-time claim for that result. Clearing browser storage before claiming can lose the pending guest result.

## Architecture and data flow

- Build the hub and two game views under the Qurator App Router. Keep each puzzle's rules and UI separate so more original games can be added later.
- Choose the word answer and hint from a curated server-side set using the UTC date. Generate the number challenge from a date-based seed and verify that it has a solution. Persist each challenge ID, public puzzle data, and private solution in a table with a unique date/game key; this keeps a day's pair stable across users and redeploys.
- Keep puzzle interaction and answer checking on the server. For word guesses, the server returns only per-guess feedback; for number rounds, it validates the submitted expression. The client receives a spoiler-free result.
- Add a completion ledger with a unique key on profile, game, and puzzle date, plus profile-linked Games streak state. The server route validates the submitted guesses or number expression; a narrow transactional database function records the completion, awards XP once, recalculates level using Quobby's existing XP curve, and advances the Games streak. A second completion on the same UTC date does not increment the streak again; a missed UTC date resets the current Games streak to one on the next completion, while best streak only increases.
- Use the authenticated Supabase user ID as the profile key. The server derives that ID from the session and supplies it to a server-only database function; do not accept a profile ID or XP amount from the browser as authority. Keep the guest's challenge ID and attempt history locally until sign-in; replay the submitted history against the server-held challenge, validate the claim, and make retries idempotent.
- Qurator's OAuth callback currently restricts allowed return paths; allow `/games` so the guest claim flow can resume after sign-in.
- The game schema belongs in a Qurator-owned SQL migration. The feature uses the existing shared Supabase project and does not require changes to the Quobby mobile clients.

## Failure handling

- If sign-in or the reward request fails, preserve the pending result and let the player retry. The completion ledger makes repeated submissions safe.
- If the profile already has a completion for that game and date, return the existing result without another XP award or streak increment.
- If the server cannot validate a completion, show a retryable error and do not display XP as awarded.

## Validation and acceptance criteria

- Signed-in players see the same two challenge IDs for a given UTC date, earn 25 XP per finished game at most once, and see the Games streak change independently from the study streak.
- Guest players can finish a round before seeing the profile prompt. Signing in returns them to `/games`, claims the validated result once, and updates shared XP and Games streak.
- Repeated submissions, completing both puzzles on one date, and retrying a failed reward request do not double-award XP or double-increment the streak.
- At the UTC date change, both challenge IDs advance together for every player.
- Verify the experience at mobile and desktop widths, including keyboard play and spoiler-free sharing.
