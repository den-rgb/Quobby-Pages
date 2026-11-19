export interface WorkerConfig { baseUrl: string; machineId: string; machineToken: string; version: string }

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  function required(name: string, max: number): string {
    const value = env[name];
    if (!value?.trim() || value.length > max || /[\r\n\0]/.test(value)) throw new Error(`Set a valid ${name}.`);
    return value;
  }
  const rawUrl = required('CONTENT_STUDIO_BASE_URL', 2048);
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error('Set a valid CONTENT_STUDIO_BASE_URL.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Set a valid CONTENT_STUDIO_BASE_URL origin (HTTPS, or HTTP localhost).');
  return { baseUrl: url.origin, machineId: required('CONTENT_STUDIO_MACHINE_ID', 200), machineToken: required('CONTENT_STUDIO_MACHINE_TOKEN', 4096), version: '0.1.0' };
}
