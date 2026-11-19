import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from './process.ts';
import { requireLocalPath } from './templates.ts';
import type { ProcessRunner, VoiceRequest } from './types.ts';

export async function synthesizeVoice(request: VoiceRequest, dependencies: { run: ProcessRunner; env: NodeJS.ProcessEnv } = { run, env: process.env }): Promise<string> {
  if (typeof request.text !== 'string' || !request.text.trim() || request.text.length > 500) throw new Error('Voice text must be between 1 and 500 characters.');
  requireLocalPath(request.outputDirectory);
  await mkdir(request.outputDirectory, { recursive: true, mode: 0o700 });
  const output = join(request.outputDirectory, 'voice.wav');
  await rm(output, { force: true });
  const custom = dependencies.env.VOICE_COMMAND;
  if (custom !== undefined) {
    let command: unknown;
    try { command = JSON.parse(custom); } catch { throw new Error('VOICE_COMMAND must be a JSON array of executable and argument tokens.'); }
    if (!Array.isArray(command) || command.length < 3 || !command.every((part) => typeof part === 'string' && part.length > 0 && !part.includes('\0')) || !command.slice(1).includes('{text}') || !command.slice(1).includes('{output}') || /[{}]/.test(command[0])) throw new Error('VOICE_COMMAND must be a JSON array including {text} and {output} argument tokens.');
    await dependencies.run(command[0], command.slice(1).map((part: string) => part === '{text}' ? request.text : part === '{output}' ? output : part));
  } else {
    const input = join(request.outputDirectory, 'voice.txt');
    const aiff = join(request.outputDirectory, 'voice.aiff');
    await rm(aiff, { force: true });
    await writeFile(input, request.text, { mode: 0o600 });
    // -f keeps leading dashes and shell-like copy out of say's option parser.
    await dependencies.run('/usr/bin/say', ['-o', aiff, '-v', dependencies.env.VOICE_NAME || 'Samantha', '-f', input]);
    await dependencies.run(dependencies.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner', '-nostdin', '-y', '-i', aiff, '-vn', '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '1', output]);
  }
  const file = await stat(output).catch(() => null);
  if (!file?.isFile() || file.size === 0) throw new Error('Local voice command did not produce a nonempty WAV file.');
  return output;
}
