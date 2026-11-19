#!/bin/zsh
set -euo pipefail
# Never exit silently: name the failing line (e.g. a killed or failing command).
trap 'print -u2 "install-launchd.sh failed at line $LINENO (exit $?)."' ZERR

if [[ "$(id -u)" -eq 0 ]]; then
  print -u2 'Run this installer as the logged-in Mac user, never with sudo.'
  exit 1
fi

worker_directory="$(cd "$(dirname "$0")/.." && pwd -P)"
template="$worker_directory/com.quobby.content-studio-worker.plist"
target="$HOME/Library/LaunchAgents/com.quobby.content-studio-worker.plist"
log_directory="$HOME/Library/Logs/QuobbyContentStudio"
uid="$(id -u)"

for command in node ffmpeg ffprobe say security launchctl plutil; do
  command -v "$command" >/dev/null || { print -u2 "Missing required command: $command"; exit 1; }
done
# Resolve paths only after the check above, so set -e cannot exit silently here.
node_binary="$(command -v node)"
ffmpeg_binary="$(command -v ffmpeg)"
ffprobe_binary="$(command -v ffprobe)"

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [[ ! "$node_major" =~ '^[0-9]+$' ]] || (( node_major < 25 )); then
  print -u2 'Node.js 25 or newer is required.'
  exit 1
fi

: "${CONTENT_STUDIO_BASE_URL:?Set CONTENT_STUDIO_BASE_URL before installing.}"
: "${CONTENT_STUDIO_MACHINE_ID:?Set CONTENT_STUDIO_MACHINE_ID before installing.}"

mkdir -p "$HOME/Library/LaunchAgents" "$log_directory"
# Build the plist outside LaunchAgents: macOS kills plutil when it edits a file
# in place inside ~/Library/LaunchAgents, so only the finished file is moved there.
temporary="$(mktemp "${TMPDIR:-/tmp}/com.quobby.content-studio-worker.XXXXXX")"
cleanup() { rm -f "$temporary"; }
trap cleanup EXIT
cp "$template" "$temporary"

# plutil writes plist strings safely; this script never reads or writes a token.
# Replace the whole array: on current macOS, `-replace ProgramArguments.N` inserts
# instead of replacing. Node JSON-encodes the paths so quotes cannot break the value.
program_arguments="$(node -e 'process.stdout.write(JSON.stringify(process.argv.slice(1)))' "$node_binary" --experimental-strip-types "$worker_directory/src/index.ts")"
plutil -replace 'ProgramArguments' -json "$program_arguments" "$temporary"
plutil -replace 'WorkingDirectory' -string "$worker_directory" "$temporary"
plutil -replace 'EnvironmentVariables.CONTENT_STUDIO_BASE_URL' -string "$CONTENT_STUDIO_BASE_URL" "$temporary"
plutil -replace 'EnvironmentVariables.CONTENT_STUDIO_MACHINE_ID' -string "$CONTENT_STUDIO_MACHINE_ID" "$temporary"
plutil -replace 'EnvironmentVariables.FFMPEG_PATH' -string "$ffmpeg_binary" "$temporary"
plutil -replace 'EnvironmentVariables.FFPROBE_PATH' -string "$ffprobe_binary" "$temporary"
# Optional non-secret provider and voice settings: each exported, nonempty value
# is written into the plist. Social tokens and client secrets stay in Keychain.
for name in INSTAGRAM_API_BASE_URL INSTAGRAM_API_VERSION INSTAGRAM_USER_ID YOUTUBE_API_BASE_URL TIKTOK_API_BASE_URL TIKTOK_PRIVATE_TEST_ENABLED VOICE_NAME VOICE_COMMAND; do
  if [[ -n "${(P)name:-}" ]]; then
    plutil -replace "EnvironmentVariables.$name" -string "${(P)name}" "$temporary"
  fi
done
plutil -replace 'StandardOutPath' -string "$log_directory/worker.out.log" "$temporary"
plutil -replace 'StandardErrorPath' -string "$log_directory/worker.err.log" "$temporary"
plutil -lint "$temporary" >/dev/null || { print -u2 'The generated launchd plist is invalid.'; exit 1; }
chmod 644 "$temporary"
mv -f "$temporary" "$target"
trap - EXIT

# Reinstall just this label for this user. A missing previous service is normal.
launchctl bootout "gui/$uid" "$target" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$uid" "$target"
print "Installed com.quobby.content-studio-worker for user $uid. Logs: $log_directory"
