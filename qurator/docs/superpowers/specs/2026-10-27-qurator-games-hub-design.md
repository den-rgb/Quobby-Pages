# Qurator Games Hub

**Status:** Approved for implementation; review comments incorporated
**Date:** 2026-10-27

## Goal

Add a Qurator-branded games hub with original daily word, number, and riddle games. Every player receives the same challenge for a game on a given UTC date. Players choose a single game; there is no requirement or bonus for playing the other modes. The Qurator twist is the shared daily challenge, profile-linked Games streak, shared Quobby XP, and a post-game profile prompt for guests.

## First-release experience

- Add a `/games` hub reachable from the navbar, footer, and homepage. It offers three independent daily modes: **Letter Ledger**, **Number Trail**, and **Riddle Master**. Each mode opens directly from its own card.
- **Letter Ledger** selects a five-letter answer from a prebuilt server-side English word list. Its curated answer deck contains at least 400 valid words, and a stable shuffled UTC-day schedule uses each answer before repeating, so a year of daily puzzles will not repeat. Answers and accepted guesses must contain five distinct letters. Players get eight guesses. After each guess, show side counters for green (letters in the correct position), yellow (letters present in a different position), and red (letters absent), with a number in each counter. Do not reveal individual letter positions through tile colors. One short contextual hint appears from the start. The word list, clue text, name, and interface are original to Qurator.
- **Number Trail** gives five positive values from 1–9 (duplicates allowed) and a target from 10–99. Players may use each value instance at most once with addition, subtraction, multiplication, division, and parentheses. The server creates a solution before publishing the challenge. There is no timer; players can keep trying or give up.
- **Riddle Master** presents one rephrased traditional riddle per day and allows five answer guesses. Answers are matched against normalized accepted variants. On a win, exhausted guesses, or give-up, show the answer and the player’s result.
- The date selects one shared challenge for each mode. All players see the same challenge ID for that mode/date. The daily collection changes at 00:00 UTC. There are no personalized variants in v1.
- Any mode can be played on its own. A round ends when solved, when its guess allowance is exhausted, or when the player gives up. End screens show the answer/solution and either profile stats or a sign-in/create-profile prompt. Finishing a round by any of those outcomes grants the completion reward once for that mode/date.
- Results can be shared without revealing the answer or number solution. Archives, practice modes, leaderboards, player-created puzzles, additional modes, official third-party games, and official game links are out of scope for v1.

## Rewards and profiles

- Award 25 XP once per profile, mode, and puzzle date. Replaying a finished mode/date does not award more XP.
- Add game XP to the existing `profiles.total_xp` and recalculate `profiles.level` with Quobby’s existing XP curve so the reward appears in shared profile progress.
- Keep a separate Games current/best streak tied to the profile. Completing any one of the three modes advances the Games streak once for that UTC date. Playing a second mode that day does not increment the streak again. A missed UTC date resets the current Games streak to one on the next completion; best streak only increases.
- Leave Quobby’s study `current_streak` and `longest_streak` unchanged. Show Games streak and completion stats separately on the Qurator profile page and on each signed-in game result screen.
- Guests can finish a round before seeing the sign-in/create-profile prompt. Keep their challenge ID and attempt history on the device. After OAuth returns to the selected game, offer or automatically perform a one-time claim for the result. Clearing browser storage before claiming can lose the pending guest result.

## Architecture and data flow

- Build the hub and three game views under the Qurator App Router. Keep each game’s rules and UI separate so additional original modes can be added later.
- Select the word, clue, number challenge, and riddle from server-only curated data using the UTC date. Select Letter Ledger answers from a stable shuffled deck by UTC-day index, so the deck is not reused until every answer has appeared. Create a row in a Qurator-owned daily-challenge table on first request and keep its public puzzle data and private solution there. A unique `(puzzle_date, game_key)` key keeps a day’s challenge stable across users and redeploys.
- Keep answer checking on the server. The word API returns only the green/yellow/red counts until the round ends; the number API validates expressions; the riddle API returns only whether the submitted guess is correct. Endpoints replay the submitted history against the stored solution before accepting a result or guest claim.
- Add a completion ledger with a unique key on profile, game, and puzzle date, plus profile-linked Games streak state. The server derives the profile ID from the Supabase session. A server-only transactional database function records the completion, awards XP once, recalculates the level, and advances the Games streak without changing study streak columns. The function is callable only with the service role; the browser cannot supply an XP amount or profile ID.
- Preserve guest challenge IDs and attempt histories locally until sign-in. The server validates the guest transcript against its stored challenge before applying the same idempotent completion function.
- Qurator’s OAuth callback currently restricts allowed return paths; allow `/games` so guest claims can resume after sign-in.
- Put the game schema and reward function in a Qurator-owned SQL migration. Use the existing shared Supabase project; no Quobby mobile-client changes are needed because the website updates the shared profile XP fields.

## Failure handling

- If sign-in or a reward request fails, preserve the pending result and allow a retry. The completion ledger prevents repeated XP awards.
- If the profile already has a completion for that mode/date, return the recorded result without another XP award or streak increment.
- If the server cannot validate a completion, return a retryable error and do not display XP as awarded.
- If the daily challenge cannot be loaded or persisted, show a retryable unavailable state rather than starting a client-generated variant.

## Validation and acceptance criteria

- Players can choose and finish any single mode. No screen blocks progress until another mode is played.
- Signed-in players receive the same challenge IDs for a given mode/date, earn 25 XP per finished mode at most once, and see a Games streak that remains independent from the study streak.
- Letter Ledger has at least 400 unique-letter daily answers, does not repeat an answer until its deck is exhausted, accepts only five-letter words with no repeated letters, and shows the three numerical feedback counts after each accepted guess.
- Riddle Master allows five guesses and shows the riddle answer on loss or give-up. Other modes also reveal their answer/solution at the end.
- Guests can finish any mode before seeing the profile prompt. Signing in returns them to the selected game, claims the validated result once, and updates shared XP and Games streak.
- Repeated submissions, finishing multiple modes on one date, and retrying a failed reward request do not double-award XP or increment the streak more than once that date.
- At 00:00 UTC, each mode’s challenge advances together for every player.
- Verify mobile and desktop layouts, keyboard play, and spoiler-free sharing.
