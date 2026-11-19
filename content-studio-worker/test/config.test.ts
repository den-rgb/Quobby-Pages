import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.ts';

const env = { CONTENT_STUDIO_BASE_URL: 'https://qurator.example', CONTENT_STUDIO_MACHINE_ID: 'mac-one', CONTENT_STUDIO_MACHINE_TOKEN: 'secret-token' };
test('configuration fails closed for absent values and unsafe control-plane origins', () => {
  for (const key of Object.keys(env)) assert.throws(() => loadConfig({ ...env, [key]: '' }), new RegExp(key));
  for (const url of ['http://qurator.example', 'https://user:pass@example.com', 'https://example.com/other', 'https://example.com?token=x']) {
    assert.throws(() => loadConfig({ ...env, CONTENT_STUDIO_BASE_URL: url }), /CONTENT_STUDIO_BASE_URL/);
  }
  assert.equal(loadConfig({ ...env, CONTENT_STUDIO_BASE_URL: 'http://localhost:3000/' }).baseUrl, 'http://localhost:3000');
});
