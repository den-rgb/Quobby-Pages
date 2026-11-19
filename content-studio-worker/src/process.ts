import { spawn } from 'node:child_process';

function execute(command: string, args: string[], collectOutput: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: ['ignore', collectOutput ? 'pipe' : 'ignore', 'pipe'] });
    let stderr = Buffer.alloc(0);
    let stdout = '';
    let outputTooLarge = false;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 10 * 60 * 1000);
    child.stderr?.on('data', (chunk: Buffer) => { stderr = Buffer.concat([stderr, chunk]).subarray(-4096); });
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      if (Buffer.byteLength(stdout) > 65536) { outputTooLarge = true; child.kill('SIGKILL'); }
    });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (timedOut) reject(new Error('Local process exceeded its 10 minute limit.'));
      else if (outputTooLarge) reject(new Error('Local process output exceeded 64KB.'));
      else if (code !== 0) reject(new Error(`Local process exited ${code ?? signal}: ${stderr.toString('utf8')}`));
      else resolve(stdout);
    });
  });
}

export async function run(command: string, args: string[]): Promise<void> {
  await execute(command, args, false);
}

export async function capture(command: string, args: string[]): Promise<string> {
  return execute(command, args, true);
}
