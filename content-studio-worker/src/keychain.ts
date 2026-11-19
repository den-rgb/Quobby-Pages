import { spawn } from 'node:child_process';

export type KeychainCommand = (command: string, args: string[]) => Promise<{ code: number | null; stdout: string }>;

const execute: KeychainCommand = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { shell: false, stdio: ['ignore', 'pipe', 'ignore'] });
  let stdout = ''; let exceeded = false;
  const timer = setTimeout(() => { exceeded = true; child.kill('SIGKILL'); }, 30_000);
  child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); if (Buffer.byteLength(stdout) > 65536) { exceeded = true; child.kill('SIGKILL'); } });
  child.on('error', () => { clearTimeout(timer); reject(new Error('Keychain command failed.')); });
  child.on('close', (code) => { clearTimeout(timer); if (exceeded) reject(new Error('Keychain command failed.')); else resolve({ code, stdout }); });
});

export class Keychain {
  private command: KeychainCommand;
  constructor(command: KeychainCommand = execute) { this.command = command; }
  private account(value: string): string {
    if (!/^[a-z][a-z0-9-]{0,99}$/.test(value)) throw new Error('Use a valid Keychain account name.');
    return value;
  }
  async get(account: string): Promise<string | null> {
    const name = this.account(account);
    try {
      const result = await this.command('/usr/bin/security', ['find-generic-password', '-s', 'quobby-content-studio', '-a', name, '-w']);
      if (result.code === 44) return null;
      if (result.code !== 0) throw new Error();
      const value = result.stdout.replace(/\r?\n$/, '');
      if (!value || value.length > 65536 || value.includes('\0')) throw new Error();
      return value;
    } catch { throw new Error('Could not read macOS Keychain.'); }
  }
  async set(account: string, token: string): Promise<void> {
    const name = this.account(account);
    if (typeof token !== 'string' || !token.trim() || token.length > 65536 || token.includes('\0')) throw new Error('Use a nonempty Keychain value.');
    try {
      const result = await this.command('/usr/bin/security', ['add-generic-password', '-U', '-s', 'quobby-content-studio', '-a', name, '-w', token]);
      if (result.code !== 0) throw new Error();
    } catch { throw new Error('Could not update macOS Keychain.'); }
  }
}
