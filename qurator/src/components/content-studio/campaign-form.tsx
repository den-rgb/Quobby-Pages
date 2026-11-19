'use client';

import { createCampaignWithAssets, generateMeme, generatePlatformCopy, StudioAccessError } from '@/lib/content-studio/client';
import { renderCampaign } from '@/lib/content-studio/render-pipeline';
import { CURATED_TEMPLATES } from '@/lib/content-studio/templates';
import { PLATFORMS, type Platform } from '@/lib/content-studio/types';
import { validateSourceFiles } from '@/lib/content-studio/ui';
import { OPTIONAL_MEDIA_HINT } from '@/lib/content-studio/media';
import { Loader2, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

const inputClass = 'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50';

export function CampaignForm({ onCreated, onClose, onForbidden, mode = 'upload' }: {
  onCreated: (campaignId: string) => void; onClose: () => void; onForbidden: () => void;
  // 'meme' finds a stock clip and writes its caption automatically.
  mode?: 'upload' | 'meme';
}) {
  const meme = mode === 'meme';
  const [theme, setTheme] = useState('');
  const [template, setTemplate] = useState(CURATED_TEMPLATES[0]);
  const [copy, setCopy] = useState({ ...CURATED_TEMPLATES[0].defaultCopy });
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [tiktokPrivateTest, setTiktokPrivateTest] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [scheduledFor, setScheduledFor] = useState('');
  const [files, setFiles] = useState<(File | null)[]>([null]);
  const [extras, setExtras] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  // Meme generation renders in this browser: clip selection, captions, encode.
  const [stage, setStage] = useState<'idle' | 'generating' | 'rendering' | 'uploading'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!meme && Object.values(copy).some((value) => !value.trim())) return setError('Fill in every copy field.');
    if (!platforms.length) return setError('Choose at least one platform.');
    const assetError = meme ? null : validateSourceFiles(files, extras);
    if (assetError) return setError(assetError);
    const selectedFiles = [...files.filter((file): file is File => file !== null), ...extras];
    const scheduled = scheduledFor ? new Date(scheduledFor) : null;
    if (scheduled && (!Number.isFinite(scheduled.getTime()) || scheduled.getTime() <= Date.now())) {
      return setError('Choose a future date and time.');
    }
    setBusy(true);
    setProgress(0);
    setStage(meme ? 'generating' : 'rendering');
    controller.current = new AbortController();
    const signal = controller.current.signal;
    try {
      const targeting = { platforms, ...(platforms.includes('tiktok') ? { tiktokPrivateTest } : {}), requiresApproval, scheduledFor: scheduled?.toISOString() ?? null };
      let campaignId: string;
      let renderId: string;
      if (meme) {
        const generated = await generateMeme({ ...(theme.trim() ? { theme: theme.trim() } : {}), ...targeting }, signal);
        campaignId = generated.campaignId; renderId = generated.renderId;
      } else {
        const created = await createCampaignWithAssets({ templateId: template.id, ...copy, ...targeting }, selectedFiles, signal);
        campaignId = created.campaignId; renderId = created.renderId;
        // Per-platform copy is best-effort; the review panel can regenerate it.
        await generatePlatformCopy(campaignId, signal).catch(() => {});
      }
      setStage('rendering');
      try {
        await renderCampaign(renderId, setProgress, signal);
        onCreated(campaignId);
      } catch (renderFailure) {
        if (signal.aborted || renderFailure instanceof StudioAccessError) throw renderFailure;
        throw new Error(`The campaign was saved but the browser render failed: ${renderFailure instanceof Error ? renderFailure.message : 'unknown error'} You can retry it from the campaign panel.`);
      }
    } catch (failure) {
      if (failure instanceof StudioAccessError) onForbidden();
      else if (!controller.current.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not create campaign.');
    } finally {
      setBusy(false);
      setStage('idle');
    }
  }

  return (
    <section aria-labelledby="new-campaign-title" className="rounded-2xl border border-border bg-white/[0.03] p-5 mb-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 id="new-campaign-title" className="font-semibold text-foreground">{meme ? 'Generate meme' : 'New campaign'}</h2>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close new campaign" className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-40"><X className="w-4 h-4" /></button>
      </div>
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
          {meme ? <div className="space-y-3">
            <p className="text-sm text-foreground-muted">Picks an unwatched clip from your funny clip library (or a free stock clip while the library is empty), has Gemini watch it and write a meme caption that ties it to a Quobby feature, then renders a classic top-text meme with the Quobby logo end card.</p>
            <label className="block text-xs font-medium text-foreground-muted max-w-sm">
              Theme (optional — e.g. “exam stress”, “falling asleep at desk”)
              <input type="text" maxLength={60} value={theme} onChange={(event) => setTheme(event.target.value)} placeholder="Random student-life theme" className={`${inputClass} mt-1.5`} />
            </label>
            <p className="text-xs text-foreground-faint">Clips provided by <a href="https://pixabay.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Pixabay</a> or <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Pexels</a>. Review the caption and preview before approving.</p>
          </div> : <>
          <div className="grid sm:grid-cols-3 gap-3">
            {CURATED_TEMPLATES.map((choice) => (
              <label key={choice.id} className={`rounded-xl border p-4 cursor-pointer ${choice.id === template.id ? 'border-accent/60 bg-accent/5' : 'border-border hover:bg-white/5'}`}>
                <span className="flex items-start gap-2 text-sm font-medium">
                  <input type="radio" name="template" value={choice.id} checked={choice.id === template.id} onChange={() => {
                    setTemplate(choice); setCopy({ ...choice.defaultCopy }); setFiles(choice.requiredAssetLabels.map(() => null)); setExtras([]); setError(null);
                  }} className="mt-1 accent-accent" />
                  {choice.label}
                </span>
                <span className="block mt-2 text-xs leading-relaxed text-foreground-muted">{choice.description}</span>
              </label>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {([
              ['title', 'Title', 100], ['hook', 'Hook', 120], ['cta', 'Call to action', 80], ['voiceText', 'Voice-over text', 500],
            ] as const).map(([key, label, maxLength]) => (
              <label key={key} className="block text-xs font-medium text-foreground-muted">
                {label} <span className="text-foreground-faint">({copy[key].length}/{maxLength})</span>
                <textarea required maxLength={maxLength} value={copy[key]} onChange={(event) => setCopy({ ...copy, [key]: event.target.value })} rows={key === 'voiceText' ? 3 : 2} className={`${inputClass} mt-1.5`} />
              </label>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-4" key={template.id}>
            {template.requiredAssetLabels.map((label, index) => (
              <label key={label} className="block text-xs font-medium text-foreground-muted">
                {label} (required)
                <input type="file" required accept="video/mp4,video/quicktime" className={`${inputClass} mt-1.5`} onChange={(event) => setFiles((previous) => previous.map((file, slot) => slot === index ? event.target.files?.[0] ?? null : file))} />
              </label>
            ))}
            <label className="block text-xs font-medium text-foreground-muted">
              Additional licensed images or audio (optional)
              <input type="file" multiple accept="image/jpeg,image/png,image/webp,audio/wav,audio/mpeg,audio/aac" className={`${inputClass} mt-1.5`} onChange={(event) => setExtras(Array.from(event.target.files ?? []))} />
            </label>
          </div>
          <p className="text-xs text-foreground-faint">{OPTIONAL_MEDIA_HINT} Use Quobby-owned or commercially licensed assets. Maximum 250 MB per file. Files upload privately before the campaign is queued.</p>
          </>}
          <fieldset>
            <legend className="text-xs font-medium text-foreground-muted mb-2">Target platforms (choose at least one)</legend>
            <div className="flex flex-wrap gap-4">
              {PLATFORMS.map((platform) => (
                <label key={platform} className="flex items-center gap-2 text-sm capitalize">
                  <input type="checkbox" checked={platforms.includes(platform)} onChange={(event) => setPlatforms((previous) => {
                    if (event.target.checked) return [...previous, platform];
                    if (platform === 'tiktok') setTiktokPrivateTest(false);
                    return previous.filter((value) => value !== platform);
                  })} className="accent-accent" />
                  {platform === 'youtube' ? 'YouTube Shorts' : platform === 'instagram' ? 'Instagram Reels' : 'TikTok'}
                </label>
              ))}
            </div>
            {platforms.includes('tiktok') && <div className="mt-2 rounded-lg border border-amber-300/30 bg-amber-300/5 p-3 text-xs text-amber-200">
              <p>TikTok public Direct Post is unavailable for internal team tools. This option creates a private <code>SELF_ONLY</code> integration test, never a public post.</p>
              <label className="mt-2 flex items-start gap-2 text-amber-100"><input type="checkbox" checked={tiktokPrivateTest} onChange={(event) => setTiktokPrivateTest(event.target.checked)} className="mt-0.5 accent-amber-300" />
                <span>I understand this TikTok post is a private <code>SELF_ONLY</code> test.</span>
              </label>
            </div>}
          </fieldset>
          <label className="block text-xs font-medium text-foreground-muted max-w-sm">
            Publish date and time (optional, your local time)
            <input type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} className={`${inputClass} mt-1.5`} />
          </label>
          <label className="flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" role="switch" checked={requiresApproval} onChange={(event) => setRequiresApproval(event.target.checked)} className="accent-accent w-4 h-4" />
            Require approval before publish
          </label>
          <p className="text-xs text-foreground-muted">{requiresApproval ? 'The rendered video waits for your approval.' : 'Publishing stays manual: you post the approved video yourself.'}</p>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button type="submit" className="inline-flex items-center gap-2 bg-accent text-black rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {busy
              ? stage === 'generating' ? 'Finding a clip and writing the meme…'
                : stage === 'rendering' ? `Rendering in your browser… ${Math.round(progress * 100)}%`
                  : 'Uploading the finished video…'
              : meme ? 'Generate meme' : 'Create campaign'}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
