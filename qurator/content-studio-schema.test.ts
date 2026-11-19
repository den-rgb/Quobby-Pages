import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('content studio migration creates private storage and atomic claim functions', async () => {
  const sql = await readFile(new URL('./migrate-content-studio.sql', import.meta.url), 'utf8');
  for (const required of [
    'CREATE TABLE IF NOT EXISTS public.content_studio_campaigns',
    'CREATE TABLE IF NOT EXISTS public.content_studio_publications',
    "'content-studio'",
    'CREATE OR REPLACE FUNCTION public.content_studio_claim_job',
    'ENABLE ROW LEVEL SECURITY',
  ]) assert.match(sql, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(sql, /CREATE POLICY[^;]+FOR SELECT\s+USING \(true\)/s);
});

test('lease cleanup skips locked expired rows before updating either queue', async () => {
  const sql = await readFile(new URL('./migrate-content-studio.sql', import.meta.url), 'utf8');
  const cleanup = sql.split('CREATE OR REPLACE FUNCTION public.content_studio_release_expired_leases()')[1]
    ?.split('$$;')[0];
  assert.ok(cleanup, 'lease cleanup function is present');

  for (const [queue, status] of [['renders', 'rendering'], ['publications', 'publishing']]) {
    assert.match(cleanup, new RegExp(
      `WITH expired_${queue} AS \\(\\s*SELECT id\\s+FROM public\\.content_studio_${queue}`
      + `\\s+WHERE status = '${status}' AND lease_expires_at < now\\(\\)`
      + `\\s+FOR UPDATE SKIP LOCKED\\s*\\)\\s*UPDATE public\\.content_studio_${queue} AS job`
      + `[\\s\\S]+?FROM expired_${queue}\\s+WHERE job\\.id = expired_${queue}\\.id;`,
    ));
  }
});

test('worker transitions check database time and audit within the service-only RPC', async () => {
  const sql = await readFile(new URL('./migrate-content-studio.sql', import.meta.url), 'utf8');
  const transition = sql.split('CREATE OR REPLACE FUNCTION public.content_studio_transition_job(')[1]?.split('$$;')[0];
  assert.ok(transition, 'worker transition RPC is present');
  assert.match(transition, /SECURITY DEFINER SET search_path = public/);
  for (const [table, activeStatus] of [['renders', 'rendering'], ['publications', 'publishing']]) {
    const update = transition.split(`UPDATE public.content_studio_${table}`)[1]?.split('RETURNING')[0];
    assert.ok(update, `${table} mutation is present`);
    assert.match(update, new RegExp(`status = '${activeStatus}'`));
    assert.match(update, /lease_owner = p_machine_id/);
    assert.match(update, /lease_expires_at > now\(\)/);
    assert.match(update, /lease_expires_at > clock_timestamp\(\)/);
    assert.match(transition, new RegExp(`FROM public\\.content_studio_${table}[\\s\\S]*?FOR UPDATE;`));
  }
  // Publication completion also atomically records a campaign status change
  // when the last active publication becomes terminal.
  assert.ok((transition.match(/PERFORM public\.content_studio_record_transition\(/g) ?? []).length >= 2);
  assert.match(transition, /Worker must own the active lease/);
  assert.doesNotMatch(transition, /EXECUTE\s/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.content_studio_transition_job\(text, uuid, text, text, jsonb, text, jsonb\)\s+FROM PUBLIC, anon, authenticated;/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.content_studio_transition_job\(text, uuid, text, text, jsonb, text, jsonb\)\s+TO service_role;/);
});

test('approval policy parent locks serialize writers without blocking audit foreign-key checks', async () => {
  const sql = await readFile(new URL('./migrate-content-studio.sql', import.meta.url), 'utf8');
  const policy = sql.split('CREATE OR REPLACE FUNCTION public.content_studio_set_approval_policy(')[1]?.split('$$;')[0];
  assert.ok(policy, 'approval policy RPC is present');
  assert.match(policy, /FROM public\.content_studio_campaigns WHERE id = p_campaign_id FOR NO KEY UPDATE;/);
  assert.match(policy, /FROM public\.content_studio_renders\s+WHERE campaign_id = p_campaign_id ORDER BY id FOR NO KEY UPDATE/);
  assert.match(policy, /FROM public\.content_studio_publications[\s\S]*?ORDER BY id FOR UPDATE/);
  assert.match(policy, /status = ANY\(p_expected_statuses\)/);
  assert.match(policy, /p_event_name => 'approval_requirement_changed'/);
});

test('publication retry reads approval policy under the same parent-first transaction', async () => {
  const sql = await readFile(new URL('./migrate-content-studio.sql', import.meta.url), 'utf8');
  const retry = sql.split('CREATE OR REPLACE FUNCTION public.content_studio_retry_publication(')[1]?.split('$$;')[0];
  assert.ok(retry, 'publication retry RPC is present');
  assert.match(retry, /SECURITY DEFINER SET search_path = public/);
  assert.match(retry, /FROM public\.content_studio_campaigns WHERE id = v_campaign_id FOR NO KEY UPDATE;/);
  assert.match(retry, /FROM public\.content_studio_renders WHERE id = v_render_id FOR NO KEY UPDATE;/);
  assert.match(retry, /FROM public\.content_studio_publications WHERE id = p_publication_id FOR UPDATE;/);
  assert.match(retry, /v_campaign\.requires_approval AND v_campaign\.approved_at IS NULL THEN 'review'/);
  assert.match(retry, /p_event_name => 'publication_retry_requested'/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.content_studio_retry_publication\(uuid, uuid\)\s+FROM PUBLIC, anon, authenticated;/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.content_studio_retry_publication\(uuid, uuid\)\s+TO service_role;/);
});

test('campaign review and publication completion are atomic with parent-first locks', async () => {
  const sql = await readFile(new URL('./migrate-content-studio.sql', import.meta.url), 'utf8');
  const review = sql.split('CREATE OR REPLACE FUNCTION public.content_studio_review_campaign(')[1]?.split('$$;')[0];
  assert.ok(review, 'campaign review RPC is present');
  assert.match(review, /FROM public\.content_studio_campaigns WHERE id = p_campaign_id FOR NO KEY UPDATE;/);
  assert.match(review, /FROM public\.content_studio_renders\s+WHERE campaign_id = p_campaign_id ORDER BY id FOR NO KEY UPDATE/);
  assert.match(review, /FROM public\.content_studio_publications[\s\S]*?ORDER BY id FOR UPDATE/);
  assert.match(review, /p_event_name => CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.content_studio_review_campaign\(uuid, uuid, text\)\s+FROM PUBLIC, anon, authenticated;/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.content_studio_review_campaign\(uuid, uuid, text\)\s+TO service_role;/);

  const transition = sql.split('CREATE OR REPLACE FUNCTION public.content_studio_transition_job(')[1]?.split('$$;')[0];
  assert.ok(transition, 'worker transition RPC is present');
  assert.match(transition, /p_job_kind = 'publication'[\s\S]*?content_studio_campaigns WHERE id = v_campaign_id FOR NO KEY UPDATE/);
  assert.match(transition, /p_event_name => 'campaign_publication_result_applied'/);
});

test('a retryable publication keeps a mixed terminal campaign eligible for its explicit same-row retry', async () => {
  const sql = await readFile(new URL('./migrate-content-studio.sql', import.meta.url), 'utf8');
  const transition = sql.split('CREATE OR REPLACE FUNCTION public.content_studio_transition_job(')[1]?.split('$$;')[0];
  const retry = sql.split('CREATE OR REPLACE FUNCTION public.content_studio_retry_publication(')[1]?.split('$$;')[0];
  assert.ok(transition && retry, 'publication transition and retry RPCs are present');

  // A provider restriction may be terminal for one platform while another
  // publication still has a safe, checkpointed retry. Terminalizing the parent
  // would make that existing failed row unreachable through the guarded retry.
  assert.match(transition, /AND NOT bool_or\(p\.status = 'failed'\s+AND p\.error_code IS NOT DISTINCT FROM 'publication-retryable'\)/);
  assert.match(retry, /v_publication\.error_code IS DISTINCT FROM 'publication-retryable'/);
});

test('a retry returning to review moves its approval-gated campaign back to review atomically', async () => {
  const sql = await readFile(new URL('./migrate-content-studio.sql', import.meta.url), 'utf8');
  const retry = sql.split('CREATE OR REPLACE FUNCTION public.content_studio_retry_publication(')[1]?.split('$$;')[0];
  assert.ok(retry, 'publication retry RPC is present');

  // Enabling approval can leave a queued campaign with approved_at NULL while
  // all publication rows are terminal. Retrying a checkpointed failure then
  // returns that row to review, so the same transaction must reopen the parent
  // review state before the admin review RPC can approve it.
  assert.match(retry, /v_next_status = 'review'/);
  assert.match(retry, /UPDATE public\.content_studio_campaigns\s+SET status = 'review', updated_at = now\(\)\s+WHERE id = v_campaign\.id AND status = v_campaign\.status;/);
  assert.match(retry, /p_event_name => 'campaign_review_reopened_for_retry'/);
  assert.match(retry, /p_old_status => v_campaign\.status, p_new_status => 'review'/);
});
