import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
// @ts-expect-error Installed Node typings predate synchronous module hooks.
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

// Only auth is substituted. Components and React rendering are real, with no network IO.
const state = globalThis as unknown as {
  studioRenderAuth: { user: { id: string } | null; loading: boolean; isAdmin: boolean };
  studioRenderAdmin: { id: string } | null;
};
state.studioRenderAuth = { user: null, loading: false, isAdmin: false };
state.studioRenderAdmin = null;
const sourceRoot = new URL('../../', import.meta.url);
registerHooks({
  resolve(specifier: string, context: { parentURL?: string }, nextResolve: (specifier: string, context: { parentURL?: string }) => unknown) {
    if (specifier === 'next/link') return nextResolve('next/link.js', context);
    if (specifier === '@/lib/auth') return { url: 'data:text/javascript,export function useAuth(){return globalThis.studioRenderAuth}', shortCircuit: true };
    if (specifier === '@/lib/admin') return { url: 'data:text/javascript,export async function requireAdminUser(){return globalThis.studioRenderAdmin}', shortCircuit: true };
    const base = specifier.startsWith('@/') ? new URL(specifier.slice(2), sourceRoot)
      : specifier.startsWith('.') && context.parentURL?.startsWith('file:') ? new URL(specifier, context.parentURL) : null;
    if (base && !/\.[a-z]+$/.test(base.pathname)) {
      for (const extension of ['.ts', '.tsx']) {
        const resolved = new URL(base.href + extension);
        if (existsSync(resolved)) return { url: resolved.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url: string, context: unknown, nextLoad: (url: string, context: unknown) => unknown) {
    if (url.endsWith('.tsx')) return {
      format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        fileName: fileURLToPath(url), compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
      }).outputText,
    };
    return nextLoad(url, context);
  },
});

test('signed-out server route renders Admin only without a studio data component', async () => {
  // @ts-expect-error Node module hooks compile TSX for this rendering test.
  const { default: Page } = await import('../../app/admin/content-studio/page.tsx');
  const html = renderToStaticMarkup(await Page());
  assert.match(html, />Admin only</);
  assert.doesNotMatch(html, /Campaign queue|New campaign|<video|sourceAssetIds/);
});

test('client identity and admin gates hide studio controls from non-admins and changed accounts', async () => {
  // @ts-expect-error Node module hooks compile TSX for this rendering test.
  const { QueueTable } = await import('../../components/content-studio/queue-table.tsx');
  for (const auth of [
    { user: null, loading: false, isAdmin: false },
    { user: { id: 'member' }, loading: false, isAdmin: false },
    { user: { id: 'other-admin' }, loading: false, isAdmin: true },
  ]) {
    state.studioRenderAuth = auth;
    const html = renderToStaticMarkup(createElement(QueueTable, { adminId: 'admin-1' }));
    assert.match(html, />Admin only</);
    assert.doesNotMatch(html, /Campaign queue|New campaign|<video/);
  }
  state.studioRenderAuth = { user: { id: 'admin-1' }, loading: false, isAdmin: true };
  assert.match(renderToStaticMarkup(createElement(QueueTable, { adminId: 'admin-1' })), /Campaign queue &amp; history/);
});

test('campaign form renders all three choices, required copy and default-on approval switch', async () => {
  // @ts-expect-error Node module hooks compile TSX for this rendering test.
  const { CampaignForm } = await import('../../components/content-studio/campaign-form.tsx');
  const html = renderToStaticMarkup(createElement(CampaignForm, { onCreated() {}, onClose() {}, onForbidden() {} }));
  assert.match(html, /Focus blocker: problem → solution/);
  assert.match(html, /Flashcards before an exam/);
  assert.match(html, /Study streak meme/);
  assert.equal((html.match(/type="radio"/g) ?? []).length, 3);
  assert.equal((html.match(/<textarea required=""/g) ?? []).length, 4);
  assert.match(html, /role="switch"[^>]*checked=""/);
  assert.match(html, /Require approval before publish/);
  assert.match(html, /Up to 8 images and 1 background audio file/);
});

test('meme mode asks only for an optional theme and targeting, and credits Pexels', async () => {
  // @ts-expect-error Node module hooks compile TSX for this rendering test.
  const { CampaignForm } = await import('../../components/content-studio/campaign-form.tsx');
  const html = renderToStaticMarkup(createElement(CampaignForm, { onCreated() {}, onClose() {}, onForbidden() {}, mode: 'meme' }));
  assert.match(html, /Generate meme/);
  assert.match(html, /Theme \(optional/);
  assert.match(html, /href="https:\/\/www\.pexels\.com"/);
  assert.equal((html.match(/type="radio"/g) ?? []).length, 0);
  assert.equal((html.match(/<textarea/g) ?? []).length, 0);
  assert.equal((html.match(/type="file"/g) ?? []).length, 0);
  assert.match(html, /role="switch"[^>]*checked=""/);
});
