'use client';

import { StudioAccessError, studioRequest } from '@/lib/content-studio/client';
import { renderCampaign } from '@/lib/content-studio/render-pipeline';
import type { PublicationRow, QueueCampaign } from '@/lib/content-studio/types';
import { publicationErrorSummary } from '@/lib/content-studio/ui';
import { Loader2, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

function PublicationCard({ publication, editable, busy, onReschedule, onRetry, onPublish, onEdit }: {
  publication: PublicationRow; editable: boolean; busy: boolean;
  onReschedule: (id: string, scheduledFor: string) => Promise<void>;
  onRetry: (id: string) => Promise<void>;
  onPublish: (id: string, publicUrl: string | null) => Promise<void>;
  onEdit: (id: string, copy: { caption: string; hashtags: string[] }) => Promise<void>;
}) {
  const [schedule, setSchedule] = useState('');
  const [postUrl, setPostUrl] = useState('');
  const [caption, setCaption] = useState(publication.copy_json.caption);
  const [tags, setTags] = useState(publication.copy_json.hashtags.join(' '));
  const [validationError, setValidationError] = useState<string | null>(null);
  const error = publicationErrorSummary(publication.status, publication.error_code);
  async function reschedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const date = new Date(schedule);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) return setValidationError('Choose a future date and time.');
    setValidationError(null);
    await onReschedule(publication.id, date.toISOString());
  }
  async function saveCopy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);
    await onEdit(publication.id, {
      caption: caption.trim(),
      hashtags: tags.split(/[\s,]+/).map((tag) => tag.replace(/^#/, '').trim()).filter(Boolean),
    });
  }
  async function markPublished(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = postUrl.trim();
    if (url && !url.startsWith('https://')) return setValidationError('Paste the public https link.');
    setValidationError(null);
    await onPublish(publication.id, url || null);
  }
  // Only public HTTPS publication links can become navigation targets.
  const publicUrl = publication.public_url?.startsWith('https://') ? publication.public_url : null;
  return (
    <article className="rounded-xl border border-border p-4">
      <div className="flex justify-between gap-2 text-sm mb-3">
        <h3 className="font-semibold capitalize">{publication.platform}</h3>
        <span className="text-foreground-muted capitalize">{publication.status}</span>
      </div>
      <p className="text-sm font-medium break-words">{publication.copy_json.title}</p>
      <p className="text-xs text-foreground-muted whitespace-pre-wrap break-words mt-2">{publication.copy_json.caption}</p>
      {publication.copy_json.hashtags.length > 0 && <p className="text-xs text-foreground-faint mt-2 break-words">{publication.copy_json.hashtags.join(' ')}</p>}
      <dl className="mt-3 space-y-1 text-xs text-foreground-muted">
        <div><dt className="inline">Schedule: </dt><dd className="inline">{publication.scheduled_for ? new Date(publication.scheduled_for).toLocaleString() : 'When ready and approved'}</dd></div>
        {publication.published_at && <div><dt className="inline">Published: </dt><dd className="inline">{new Date(publication.published_at).toLocaleString()}</dd></div>}
        {publication.external_post_id && <div><dt className="inline">Post ID: </dt><dd className="inline break-all">{publication.external_post_id}</dd></div>}
        <div><dt className="inline">Attempts: </dt><dd className="inline">{publication.attempt_count}</dd></div>
      </dl>
      {publicUrl && <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-accent hover:underline mt-3">View published post ↗</a>}
      {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
      {editable && publication.status === 'failed' && publication.error_code === 'publication-retryable' && (
        <div className="mt-4">
          <button type="button" disabled={busy} onClick={() => void onRetry(publication.id)} className="text-xs font-semibold rounded-lg bg-white/5 border border-border px-3 py-2 hover:bg-white/10 disabled:opacity-40">Retry this publication</button>
          <p className="mt-2 text-xs text-foreground-faint">Retries this same publication only. The Mac keeps its provider checkpoint to prevent duplicate posts.</p>
        </div>
      )}
      {editable && ['draft', 'review', 'queued', 'scheduled'].includes(publication.status) && (
        <form onSubmit={reschedule} className="mt-4 space-y-2">
          <label className="block text-xs text-foreground-muted">
            Reschedule {publication.platform} (your local time)
            <input type="datetime-local" required value={schedule} disabled={busy} onChange={(event) => setSchedule(event.target.value)} className="block w-full mt-1.5 rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground" />
          </label>
          <button type="submit" disabled={busy} className="text-xs font-semibold rounded-lg bg-white/5 border border-border px-3 py-2 hover:bg-white/10 disabled:opacity-40">Reschedule</button>
          {validationError && <p role="alert" className="text-xs text-red-400">{validationError}</p>}
        </form>
      )}
      {editable && !['published', 'rejected'].includes(publication.status) && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-accent">Edit description &amp; tags</summary>
          <form onSubmit={saveCopy} className="mt-2 space-y-2">
            <label className="block text-xs text-foreground-muted">Description
              <textarea value={caption} disabled={busy} maxLength={2200} rows={4} onChange={(event) => setCaption(event.target.value)} className="block w-full mt-1.5 rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground" />
            </label>
            <label className="block text-xs text-foreground-muted">Tags (space or comma separated)
              <input value={tags} disabled={busy} onChange={(event) => setTags(event.target.value)} className="block w-full mt-1.5 rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground" />
            </label>
            <button type="submit" disabled={busy} className="text-xs font-semibold rounded-lg bg-white/5 border border-border px-3 py-2 hover:bg-white/10 disabled:opacity-40">Save copy</button>
          </form>
        </details>
      )}
      {editable && ['review', 'queued', 'scheduled', 'failed'].includes(publication.status) && (
        <form onSubmit={markPublished} className="mt-4 space-y-2">
          <label className="block text-xs text-foreground-muted">
            Posted it yourself? Paste the public link (optional)
            <input type="url" value={postUrl} disabled={busy} onChange={(event) => setPostUrl(event.target.value)} placeholder="https://…" className="block w-full mt-1.5 rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground" />
          </label>
          <button type="submit" disabled={busy} className="text-xs font-semibold rounded-lg bg-white/5 border border-border px-3 py-2 hover:bg-white/10 disabled:opacity-40">Mark as published</button>
        </form>
      )}
    </article>
  );
}

export function ReviewPanel({ campaign, adminId, onClose, onChanged, onForbidden }: {
  campaign: QueueCampaign; adminId: string; onClose: () => void;
  onChanged: () => void; onForbidden: () => void;
}) {
  const render = campaign.content_studio_renders[0];
  const renderId = render?.id;
  const [preview, setPreview] = useState<{ url: string; expiresAt: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [renderStage, setRenderStage] = useState<'idle' | 'rendering' | 'uploading'>('idle');
  const [renderProgress, setRenderProgress] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const owner = campaign.created_by === adminId;
  const stock = campaign.render_spec.stock;
  const canPreview = owner && render && !!render.output_path && !['draft', 'queued', 'rendering', 'failed', 'rejected'].includes(render.status);
  const editable = owner && !['published', 'failed', 'rejected'].includes(campaign.status);
  // No Mac worker any more: an unfinished render is completed in this browser.
  // Every template renders in this browser now.
  const canRender = owner && !!render && ['draft', 'queued', 'rendering', 'failed'].includes(render.status) && !render.output_path;
  useEffect(() => {
    controller.current = new AbortController();
    return () => controller.current?.abort();
  }, []);

  const loadPreview = useCallback(async (signal?: AbortSignal) => {
    if (!canPreview) return;
    try {
      const data = await studioRequest<{ signedUrl: string; expiresIn: number }>(`/renders/${renderId}/preview`, { signal });
      if (signal?.aborted) return;
      setPreview({ url: data.signedUrl, expiresAt: Date.now() + data.expiresIn * 1000 });
      setPreviewError(null);
    } catch (failure) {
      if (signal?.aborted) return;
      if (failure instanceof StudioAccessError) onForbidden();
      else setPreviewError('Could not load the private preview. Refresh to try again.');
    } finally {
      if (!signal?.aborted) setPreviewLoading(false);
    }
  }, [canPreview, renderId, onForbidden]);

  useEffect(() => {
    if (!preview) return;
    const timeout = setTimeout(() => { setPreview(null); setPreviewError('Preview link expired. Refresh the private preview.'); }, Math.max(0, preview.expiresAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [preview]);

  async function mutate(path: string, method: string, body: object) {
    setBusy(true); setError(null);
    try {
      await studioRequest(path, { method, body: JSON.stringify(body), signal: controller.current?.signal });
      onChanged();
    } catch (failure) {
      if (controller.current?.signal.aborted) return;
      if (failure instanceof StudioAccessError) onForbidden();
      else setError(failure instanceof Error ? failure.message : 'Could not update this campaign.');
    } finally { setBusy(false); }
  }

  async function renderInBrowser() {
    if (!render) return;
    setError(null); setRenderStage('rendering'); setRenderProgress(0);
    try {
      await renderCampaign(render.id, setRenderProgress, controller.current?.signal);
      onChanged();
    } catch (failure) {
      if (controller.current?.signal.aborted) return;
      if (failure instanceof StudioAccessError) onForbidden();
      else setError(failure instanceof Error ? failure.message : 'The browser render failed.');
    } finally { setRenderStage('idle'); }
  }

  async function downloadVideo() {
    if (!renderId) return;
    setError(null);
    try {
      const data = await studioRequest<{ signedUrl: string }>(`/renders/${renderId}/preview?download=${encodeURIComponent(campaign.title)}`);
      window.location.assign(data.signedUrl);
    } catch (failure) {
      if (failure instanceof StudioAccessError) onForbidden();
      else setError('Could not prepare the download.');
    }
  }

  return (
    <section aria-labelledby="review-title" className="rounded-2xl border border-border bg-white/[0.03] p-5 mt-6">
      <div className="flex justify-between gap-4 mb-5">
        <div><h2 id="review-title" className="font-semibold break-words">{campaign.title}</h2><p className="text-xs text-foreground-muted mt-1 capitalize">{campaign.status} · {campaign.requires_approval ? 'Approval required' : 'Automatic publishing'}</p></div>
        <button type="button" onClick={onClose} aria-label="Close campaign review" disabled={busy} className="p-2 h-fit rounded-lg hover:bg-white/5 disabled:opacity-40"><X className="w-4 h-4" /></button>
      </div>
      {!owner && <p className="text-sm text-foreground-muted mb-4">Only the administrator who created this campaign can preview or change it.</p>}
      {stock && <p className="text-xs text-foreground-muted mb-4">
        Meme text: <span className="text-foreground">“{campaign.render_spec.hook}”</span> · End card: <span className="text-foreground">“{campaign.render_spec.cta}”</span><br />
        Clip by {stock.authorUrl.startsWith('https://') ? <a href={stock.authorUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{stock.author}</a> : stock.author} on {stock.pageUrl.startsWith('https://') ? <a href={stock.pageUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{stock.provider === 'pixabay' ? 'Pixabay' : 'Pexels'}</a> : (stock.provider === 'pixabay' ? 'Pixabay' : 'Pexels')}. Reject and generate again if the caption doesn’t fit.
      </p>}
      {editable && <div className="mb-5">
        <button type="button" disabled={busy} onClick={() => void mutate(`/campaigns/${campaign.id}/copy`, 'POST', {})} className="rounded-xl bg-white/5 border border-border px-4 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-40">Generate platform copy</button>
        <p className="mt-2 text-xs text-foreground-faint">Writes a separate description and tag list for Instagram, TikTok and YouTube. Regenerate any time before publishing, or edit one platform by hand.</p>
      </div>}
      <div className="grid lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] gap-6">
        <div>
          {preview ? (
            <video key={preview.url} controls playsInline preload="metadata" className="w-full max-h-[480px] aspect-[9/16] bg-black rounded-xl" src={preview.url} onError={() => setPreviewError('Preview could not play. Refresh its signed link.')} aria-label={`Private rendered preview for ${campaign.title}`} />
          ) : <div className="min-h-44 rounded-xl bg-black/30 border border-border flex items-center justify-center p-5 text-center text-xs text-foreground-muted">{previewLoading ? <Loader2 className="w-5 h-5 animate-spin" aria-label="Loading preview" /> : canPreview ? 'Load the private preview to review this video.' : 'A preview is available after a successful render.'}</div>}
          {previewError && <p role="alert" className="text-xs text-red-400 mt-2">{previewError}</p>}
          {canPreview && <div className="flex flex-wrap items-center gap-4 mt-3">
            <button type="button" onClick={() => { setPreviewLoading(true); setPreviewError(null); void loadPreview(controller.current?.signal); }} disabled={previewLoading} className="flex items-center gap-2 text-xs text-accent disabled:opacity-40"><RefreshCw className="w-3 h-3" />{preview ? 'Refresh private preview' : 'Load private preview'}</button>
            <button type="button" onClick={() => void downloadVideo()} className="text-xs text-accent hover:underline">Download video</button>
          </div>}
          {canRender && <div className="mt-4">
            <button type="button" onClick={() => void renderInBrowser()} disabled={renderStage !== 'idle'} className="rounded-xl bg-accent text-black text-sm font-semibold px-4 py-2 disabled:opacity-40">
              {renderStage === 'rendering' ? `Rendering in your browser… ${Math.round(renderProgress * 100)}%` : renderStage === 'uploading' ? 'Uploading the finished video…' : 'Render video in browser'}
            </button>
            <p className="mt-2 text-xs text-foreground-faint">No background worker is used: this browser encodes the meme and uploads it. Keep this tab open.</p>
          </div>}
          {render?.status === 'failed' && <p className="text-xs text-red-400 mt-3">Rendering failed. Re-render it in your browser.</p>}
          {owner && campaign.status === 'review' && <div className="flex gap-2 mt-5">
            <button type="button" disabled={busy} onClick={() => void mutate(`/campaigns/${campaign.id}/review`, 'POST', { action: 'approve' })} className="rounded-xl bg-accent text-black text-sm font-semibold px-4 py-2 disabled:opacity-40">Approve</button>
            <button type="button" disabled={busy} onClick={() => void mutate(`/campaigns/${campaign.id}/review`, 'POST', { action: 'reject' })} className="rounded-xl border border-red-400/30 text-red-400 text-sm font-semibold px-4 py-2 disabled:opacity-40">Reject</button>
          </div>}
          {error && <p role="alert" className="text-sm text-red-400 mt-3">{error}</p>}
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
          {campaign.content_studio_renders.flatMap((item) => item.content_studio_publications).map((publication) => <PublicationCard key={publication.id} publication={publication} editable={editable} busy={busy} onReschedule={(id, scheduledFor) => mutate(`/publications/${id}`, 'PATCH', { scheduledFor })} onRetry={(id) => mutate(`/publications/${id}/retry`, 'POST', {})} onPublish={(id, publicUrl) => mutate(`/publications/${id}/publish`, 'POST', publicUrl ? { publicUrl } : {})} onEdit={(id, copy) => mutate(`/publications/${id}`, 'PATCH', copy)} />)}
        </div>
      </div>
    </section>
  );
}
