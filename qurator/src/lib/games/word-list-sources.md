# Letter Ledger word list sources

`word-list.json` contains lowercase five-letter words with distinct letters
from the system Webster's Second International dictionary (`/usr/share/dict/web2`).
`scowl-word-list.json` adds distinct-letter words from the English Speller
Database (ESDB, previously SCOWL v2), release `rel-2026.02.25`. These smaller
lists remain the dictionary for curated daily answer candidates, which must
have five different letters.

`scowl-guess-word-list.json` contains the union of all lowercase alphabetic
five-letter Webster entries and ESDB entries. It includes repeated-letter
words. It was regenerated from the same system Webster source and the pinned
ESDB release using size 70, American English (`A`), and variant level 1. The
release's `scowl_v0` database was queried for standard English and American
spelling rows in the US or unrestricted region, size at most 70, variant level
at most 1, and an empty special-category field. Diacritics were removed, then
only lowercase alphabetic five-letter entries were retained. Filtering the raw
word before abbreviation punctuation is removed excludes abbreviations such
as `chron.`. The generated set contains 11,303 words (8,506 Webster; 6,920
ESDB before deduplication). The union was filtered at generation time with
`containsProfanity` from `src/lib/profanity.ts`, removing 18 blocked words.
The server applies the same predicate to every submitted guess.

Guesses confirmed by the Free Dictionary API are persisted in Supabase's
`qurator_game_verified_words` table and added to the server's in-memory set.
The shared cache is checked before making another API request.

`curated-word-additions.json` contains `ghast`, an archaic English word reported
as rejected in Letter Ledger. It is absent from both generated sources and is
available only as a guess, never as a daily answer candidate.

Source: [en-wl/wordlist, release rel-2026.02.25](https://github.com/en-wl/wordlist/tree/rel-2026.02.25)

Copyright 2000-2026 by Kevin Atkinson.

Permission to use, copy, modify, distribute, and sell any part of the English
Speller Database (ESDB, previously known as SCOWLv2), or word lists created
from it, is hereby granted without fee, provided that the above copyright
notice appears in all copies and that both the above copyright notice and this
notice appear in supporting documentation. Kevin Atkinson makes no
representations about the suitability of this database for any purpose. It is
provided "as is" without express or implied warranty.

ESDB is derived from many sources, most of which are in the public domain. Data
from the Corpus of Contemporary American English (COCA) was also used under the
rights granted by the source's data license.
