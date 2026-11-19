import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { AmbiguousUploadError, ControlPlaneError, type ClaimedJob, type PublicationResult, type WorkerClient } from './client.ts';
import { renderVideo } from './renderer.ts';
import { TEMPLATES } from './templates.ts';
import { synthesizeVoice } from './tts.ts';
import { SocialError } from './social/types.ts';

export interface PublicationRequest {
  job: Extract<ClaimedJob, { kind: 'publication' }>;
  videoPath: string;
  signedUrl: string;
}
export interface WorkerDependencies {
  synthesizeVoice?: typeof synthesizeVoice;
  renderVideo?: typeof renderVideo;
  publishPublication?: (request: PublicationRequest) => Promise<PublicationResult>;
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
}
const sleep = async (milliseconds: number, signal?: AbortSignal) => { await wait(milliseconds, undefined, { signal }); };

export class Worker {
  private client: WorkerClient;
  private deps: WorkerDependencies;
  constructor(client: WorkerClient, deps: WorkerDependencies = {}) { this.client = client; this.deps = deps; }
  async runOnce(): Promise<boolean> {
    await this.client.heartbeat(null);
    const job = await this.client.claim();
    if (!job) return false;
    let directory: string | undefined;
    let completing = false;
    // Heartbeats are observability only: they never extend a job lease.
    let pendingHeartbeat = Promise.resolve();
    const heartbeat = setInterval(() => {
      pendingHeartbeat = pendingHeartbeat.then(() => this.client.heartbeat(job.id)).catch(() => {});
    }, 60_000);
    heartbeat.unref();
    try {
      directory = await mkdtemp(join(tmpdir(), 'quobby-content-studio-'));
      if (job.kind === 'render') {
        const assets = [];
        for (let index = 0; index < job.render_spec.sourceAssetIds.length; index++) {
          const id = job.render_spec.sourceAssetIds[index];
          const downloaded = await this.client.downloadAsset(job, join(directory, `source-${index}`), id);
          assets.push({ id, path: downloaded.path, mimeType: downloaded.mimeType });
        }
        // Unknown templates fall through to the renderer, which rejects them.
        const voiceOver = TEMPLATES[job.render_spec.templateId]?.voiceOver ?? true;
        const voicePath = voiceOver ? await (this.deps.synthesizeVoice ?? synthesizeVoice)({ text: job.render_spec.voiceText, outputDirectory: directory }) : null;
        const result = await (this.deps.renderVideo ?? renderVideo)({ spec: job.render_spec, assets, voicePath, outputDirectory: directory });
        const outputPath = await this.client.uploadOutput(job, result.outputPath);
        // A lost completion response may mean the transaction already committed.
        // Let lease/state recovery resolve it instead of reporting a false failure.
        completing = true;
        await this.client.completeRender(job.id, outputPath, result.durationMs);
      } else {
        if (!this.deps.publishPublication) throw new Error('Publisher is not configured.');
        const asset = await this.client.downloadAsset(job, join(directory, 'output.mp4'));
        const result = await this.deps.publishPublication({ job, videoPath: asset.path, signedUrl: asset.signedUrl });
        if (!result.published) {
          await this.client.failJob(job, 'publication-action-required', 'The provider restricted this publication. Review its privacy and app approval settings.');
          return true;
        }
        completing = true;
        await this.client.completePublication(job.id, result);
      }
      return true;
    } catch (error) {
      // Storage can accept an output then lose its response. Do not turn that
      // ambiguous result into a terminal render failure: the lease will expire
      // and the same canonical, scoped output PUT can be retried safely.
      if (completing || error instanceof ControlPlaneError || error instanceof AmbiguousUploadError) throw error;
      if (job.kind === 'publication' && error instanceof SocialError) {
        await this.client.failJob(job, `publication-${error.kind}`, error.message);
        return true;
      }
      await this.client.failJob(job, job.kind === 'render' ? 'render-failed' : 'publication-failed', job.kind === 'render' ? 'Local rendering failed. Check the Mac worker setup.' : 'Publishing failed. Check the connected account and Mac worker setup.');
      return true;
    } finally {
      clearInterval(heartbeat);
      await pendingHeartbeat;
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  }
  async runForever(signal?: AbortSignal): Promise<void> {
    let failures = 0;
    while (!signal?.aborted) {
      let delay: number;
      try {
        const worked = await this.runOnce(); failures = 0;
        if (worked) continue;
        delay = 15_000;
      } catch (error) {
        if (error instanceof AmbiguousUploadError) {
          delay = Math.min(15_000 * 2 ** Math.min(failures++, 5), 300_000);
        } else if (!(error instanceof ControlPlaneError) || !error.retryable) throw error;
        else delay = Math.min(15_000 * 2 ** Math.min(failures++, 5), 300_000);
      }
      try { await (this.deps.sleep ?? sleep)(delay, signal); }
      catch (error) { if (!signal?.aborted) throw error; }
    }
  }
}
