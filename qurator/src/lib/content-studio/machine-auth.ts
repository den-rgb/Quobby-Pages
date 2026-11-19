import { timingSafeEqual } from 'node:crypto';

export function requireMachineToken(request: Pick<Request, 'headers'>): boolean {
  const provided = request.headers.get('x-content-studio-machine-token');
  const expected = process.env.CONTENT_STUDIO_MACHINE_TOKEN ?? '';
  if (!provided || !expected) return false;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  if (providedBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(providedBytes, expectedBytes);
}
