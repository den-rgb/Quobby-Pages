import type { ClaimedJob } from '../src/client.ts';

export function renderJob(): Extract<ClaimedJob, { kind: 'render' }> {
  return { kind: 'render', id: '11111111-1111-4111-8111-111111111111', render_id: '11111111-1111-4111-8111-111111111111', campaign_id: '22222222-2222-4222-8222-222222222222', output_path: null, platform: null, copy_json: null,
    render_spec: { templateId: 'focus-blocker-problem-solution', templateVersion: 1, title: 'Study with Quobby', hook: 'One more scroll?', cta: 'Try Quobby', voiceText: 'Make room for study with Quobby.', sourceAssetIds: ['33333333-3333-4333-8333-333333333333'] } };
}
