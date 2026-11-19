The integration script creates its own deterministic 2-second recording and WAV
using local FFmpeg lavfi color/sine sources. No downloaded or licensed media is
required. Generated files live in an OS temporary directory and are removed on
success or failure.

Run `npm run render:test --prefix content-studio-worker` after installing FFmpeg
with the ASS/libass filter, H.264 encoder, AAC encoder, and ffprobe. The command
fails with an installation message when those binaries are missing; a missing
binary is never reported as a successful fixture render.
