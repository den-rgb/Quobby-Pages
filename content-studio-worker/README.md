# Quobby Content Studio Mac worker

This is the single self-hosted Mac companion for Qurator's internal Content
Studio. It renders real Quobby recordings and licensed assets with local
FFmpeg and macOS `say`; it has no AI presenter and no paid render or TTS
subscription. It polls the Qurator control plane, but social credentials and
publication recovery records remain only in this Mac's Keychain.

Do not install a second worker for the same environment. A worker lease and
local recovery records assume one trusted Mac.

## Prerequisites

- macOS with a logged-in GUI user (do not use `sudo`)
- Node.js 25 or newer (`node --version`)
- FFmpeg, FFprobe, `libx264`, AAC, and `libass` — for example `brew install ffmpeg`
- built-in macOS `say` (`say -v '?'` lists available voices)
- a deployed Qurator URL, an admin account, and a manually applied
  `qurator/migrate-content-studio.sql` migration

Verify the renderer before launchd installation:

```bash
node --version
ffmpeg -version
ffprobe -version
ffmpeg -hide_banner -filters | grep ' ass '   # captions need libass; if empty: brew install ffmpeg-full
say -v '?'
npm test
npm run render:test
```

`npm run render:test` creates an owned temporary fixture and performs a real
FFmpeg render. It must pass on the target Mac before campaigns are approved.
The development checkout used to create this feature has no FFmpeg, so that
integration test was intentionally not claimed as passing there.

## Pair the Mac to Qurator

Set these values in the terminal only for installation. The machine token must
be the exact server-side `CONTENT_STUDIO_MACHINE_TOKEN` value, but it is not
put into launchd, an `.env` file, or this repository.

```bash
export CONTENT_STUDIO_BASE_URL='https://qurator.example.com'
export CONTENT_STUDIO_MACHINE_ID='quobby-mac-1'
read -s 'CONTENT_STUDIO_MACHINE_TOKEN?Machine token: '
printf '\n'
/usr/bin/security add-generic-password -U \
  -s quobby-content-studio -a machine -w "$CONTENT_STUDIO_MACHINE_TOKEN"
unset CONTENT_STUDIO_MACHINE_TOKEN
```

The worker reads the `machine` Keychain item when it starts. Confirm the item
exists without printing its value:

```bash
/usr/bin/security find-generic-password -s quobby-content-studio -a machine >/dev/null
```

Run one private control-plane pass before installation:

```bash
CONTENT_STUDIO_BASE_URL="$CONTENT_STUDIO_BASE_URL" \
CONTENT_STUDIO_MACHINE_ID="$CONTENT_STUDIO_MACHINE_ID" \
npm start -- --once
```

This will fail safely until the Qurator server has the same machine token and
the SQL migration has been applied. It does not publish a social post without
a claimed approved/due publication.

## Install or update launchd

From this directory, with `CONTENT_STUDIO_BASE_URL` and
`CONTENT_STUDIO_MACHINE_ID` still exported:

```bash
./scripts/install-launchd.sh
```

The installer is deliberately user-scoped. It validates Node/FFmpeg/FFprobe,
creates only these paths, and never handles a token:

- `~/Library/LaunchAgents/com.quobby.content-studio-worker.plist`
- `~/Library/Logs/QuobbyContentStudio/worker.out.log`
- `~/Library/Logs/QuobbyContentStudio/worker.err.log`

Check the process and non-sensitive logs:

```bash
launchctl print "gui/$(id -u)/com.quobby.content-studio-worker"
tail -n 100 ~/Library/Logs/QuobbyContentStudio/worker.err.log
```

To uninstall, first stop the exact user service, then remove only its plist.
This does **not** remove Keychain items, publication recovery records, source
media, or Supabase data:

```bash
launchctl bootout "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.quobby.content-studio-worker.plist" || true
rm -f "$HOME/Library/LaunchAgents/com.quobby.content-studio-worker.plist"
```

## Connect social accounts

The worker uses Keychain service `quobby-content-studio` and these accounts:

- `instagram`, `tiktok`, `youtube`: provider OAuth credentials
- `publication-<publication UUID>`: recovery checkpoint — **never delete this
  account to retry a post**

`scripts/connect-platform.ts` stores an access token, optional refresh token,
and expiry metadata in the matching Keychain account. It prints no token.
YouTube performs state-checked OAuth with a registered loopback callback
(`http://127.0.0.1:<port>/callback`) and opens the browser only when run by an
operator. Create a Google Cloud OAuth client of type **Desktop app**; Google
requires its client secret at the token endpoint even with PKCE, and treats
installed-app secrets as non-confidential:

```bash
export YOUTUBE_OAUTH_CLIENT_ID='...'
read -s 'YOUTUBE_OAUTH_CLIENT_SECRET?Desktop client secret: '; printf '\n'; export YOUTUBE_OAUTH_CLIENT_SECRET
export YOUTUBE_OAUTH_REDIRECT_URI='http://127.0.0.1:43123/callback'
export YOUTUBE_OAUTH_AUTHORIZE_URL='https://accounts.google.com/o/oauth2/v2/auth'
export YOUTUBE_OAUTH_TOKEN_URL='https://oauth2.googleapis.com/token'
export YOUTUBE_OAUTH_SCOPES='https://www.googleapis.com/auth/youtube.upload'
node --experimental-strip-types scripts/connect-platform.ts youtube
unset YOUTUBE_OAUTH_CLIENT_ID YOUTUBE_OAUTH_CLIENT_SECRET YOUTUBE_OAUTH_REDIRECT_URI YOUTUBE_OAUTH_AUTHORIZE_URL YOUTUBE_OAUTH_TOKEN_URL YOUTUBE_OAUTH_SCOPES
```

YouTube's installed-app flow uses S256 PKCE, `access_type=offline`, and
`prompt=consent` so Google always returns a refresh token. The token endpoint,
client ID, and client secret are saved with it in the `youtube` Keychain item,
and the worker refreshes the access token automatically when fewer than 15
minutes remain. If refresh is rejected (for example, access was revoked or the
Google app is still in **Testing**, where refresh tokens expire after 7 days),
the publication fails with a "Reconnect" message; rerun this command.

Instagram and TikTok require registered HTTPS web callbacks in their provider
configurations; the Mac worker does not receive those public callbacks. Complete
each provider's HTTPS OAuth/token procedure in its developer console or
reviewed web callback first. Then, at a physical interactive Mac terminal,
enable the one-time Keychain provisioner and run it. The connector asks for the
resulting access token with terminal echo disabled and writes it directly to
the matching Keychain account. These tokens are not refreshed automatically:
Instagram long-lived tokens last about 60 days and TikTok access tokens about
24 hours, so repeat this step before they expire. Do **not** put the token in a command argument,
an environment variable, a shell script, a project `.env`, or a pasteable log:

```bash
export INSTAGRAM_MANUAL_TOKEN_PROVISIONING=true
node --experimental-strip-types scripts/connect-platform.ts instagram
unset INSTAGRAM_MANUAL_TOKEN_PROVISIONING

export TIKTOK_MANUAL_TOKEN_PROVISIONING=true
node --experimental-strip-types scripts/connect-platform.ts tiktok
unset TIKTOK_MANUAL_TOKEN_PROVISIONING
```

This provisioner refuses noninteractive input and does not accept a token from
CLI arguments or environment variables. Rotate a provider token by repeating
the provider OAuth process and this command; do not delete any
`publication-<publication UUID>` recovery record. Provider client secrets,
when required for the provider-managed HTTPS exchange, belong only in that
reviewed callback deployment and never in this worker or project `.env`.

For the publishing adapters and voice, export these non-secret values before
running `./scripts/install-launchd.sh`. The installer writes each exported,
nonempty value into the generated launchd plist; unset values are omitted.
Export them again whenever you re-run the installer, because it regenerates
the plist from the template:

- Instagram (required to publish): `INSTAGRAM_API_BASE_URL` (for example
  `https://graph.instagram.com`), `INSTAGRAM_API_VERSION` (for example
  `v23.0`), `INSTAGRAM_USER_ID`
- YouTube: optional `YOUTUBE_API_BASE_URL` (defaults to the official API)
- TikTok: optional `TIKTOK_API_BASE_URL` and, only for private integration
  testing, `TIKTOK_PRIVATE_TEST_ENABLED=true`
- Voice: optional `VOICE_NAME` (a `say -v '?'` voice; default `Samantha`) or
  `VOICE_COMMAND` (a JSON array containing `{text}` and `{output}`)

Never export social tokens or client secrets for the installer.

### TikTok limitation

TikTok's current Direct Post review rules reject an internal utility that only
uploads to accounts managed by the same team. This worker therefore blocks
public TikTok posts. With an unaudited app, an operator may use only an
explicitly selected `SELF_ONLY` private test and must set
`TIKTOK_PRIVATE_TEST_ENABLED=true`; this result is reported as a provider
restriction, not a published public post. See the current
[TikTok content-sharing guidelines](https://developers.tiktok.com/docs/en/content-sharing-guidelines).

## Provider and recovery checks

Configure and test each provider in its sandbox/approved account before a live
campaign. The code uses current official endpoints, but this repository cannot
provide app IDs, client secrets, app review, or provider access. Instagram
requires a professional account and content-publishing permission; YouTube
requires the upload scope and a processed public video before Qurator marks it
published.

If a provider request's outcome is uncertain, the worker keeps its local
checkpoint and stops automatic resubmission. In Qurator, use **Retry
publication** only for an eligible failed row. It reuses that same publication
and preserves the checkpoint. Inspect the provider account first; never create
a new campaign or remove the recovery Keychain item just to retry.

## Manual end-to-end acceptance

1. Apply the migration to a non-production Supabase project.
2. Sign in with an allowlisted Qurator admin ID and open `/admin/content-studio`.
3. Create a campaign with a licensed fixture recording; verify it remains in
   private Content Studio storage.
4. Run the worker once. Confirm it uploads a vertical 1080×1920 MP4 and the
   campaign enters review when approval is enabled.
5. Approve/reject/reschedule from the admin UI, then confirm an approved due
   publication follows the documented provider behavior.
6. Run credentialed sandbox smoke tests before enabling Instagram or YouTube
   public posts. Do not attempt a public TikTok post with this internal tool.

No live provider, Keychain, launchd, or Supabase operation is performed by the
automated tests in this repository.
