'use client';

import { StudioAccessError, studioRequest } from '@/lib/content-studio/client';
import type { MemeClipRow } from '@/lib/content-studio/types';
import { ChevronDown, ExternalLink, Loader2, Plus } from 'lucide-react';
import { useCallback, useState, type FormEvent } from 'react';

const PROVIDERS = [{ id: 'pixabay', label: 'Pixabay' }, { id: 'pexels', label: 'Pexels' }] as const;

export function ClipLibrary({ onForbidden }: { onForbidden: () => void }) {
  const [open, setOpen] = useState(false);
  const [clips, setClips] = useState<MemeClipRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<'pixabay' | 'pexels'>('pixabay');
  const [videoId, setVideoId] = useState('');
  const [label, setLabel] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await studioRequest<{ clips: MemeClipRow[] }>('/meme-clips');
      setClips(data.clips); setError(null);
    } catch (failure) {
      if (failure instanceof StudioAccessError) onForbidden();
      else setError('Could not load the clip library. Refresh to try again.');
    }
  }, [onForbidden]);

  async function addClip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = Number(videoId);
    if (!Number.isSafeInteger(id) || id <= 0) return setError('Enter the numeric video ID from the clip URL.');
    setBusy(true); setError(null);
    try {
      await studioRequest('/meme-clips', { method: 'POST', body: JSON.stringify({ provider, videoId: id, label: label.trim() }) });
      setVideoId(''); setLabel('');
      await load();
    } catch (failure) {
      if (failure instanceof StudioAccessError) onForbidden();
      else setError(failure instanceof Error ? failure.message : 'Could not add that clip.');
    } finally { setBusy(false); }
  }

  async function toggle(clip: MemeClipRow) {
    setBusy(true); setError(null);
    try {
      const data = await studioRequest<{ clip: MemeClipRow }>(`/meme-clips/${clip.id}`, { method: 'PATCH', body: JSON.stringify({ active: !clip.active }) });
      setClips((current) => current?.map((item) => item.id === data.clip.id ? data.clip : item) ?? current);
    } catch (failure) {
      if (failure instanceof StudioAccessError) onForbidden();
      else setError(failure instanceof Error ? failure.message : 'Could not update that clip.');
    } finally { setBusy(false); }
  }

  const active = clips?.filter((clip) => clip.active).length ?? 0;
  return (
    <section className="border border-border rounded-2xl mb-6">
      <button type="button" onClick={() => { const next = !open; setOpen(next); if (next && clips === null) void load(); }} aria-expanded={open} className="w-full p-4 flex items-center justify-between gap-2 text-sm font-semibold">
        <span>Funny clip library{clips ? ` · ${active} active` : ''}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="p-4 border-t border-border">
        <p className="text-xs text-foreground-muted mb-4">Generated memes use this library first — while any clip is unused, no other footage is searched. Add a Pixabay or Pexels video you have watched and know is funny; its creator credits are stored with it.</p>
        <form onSubmit={addClip} className="flex flex-wrap items-end gap-2 mb-4">
          <label className="text-xs text-foreground-muted">Source
            <select value={provider} disabled={busy} onChange={(event) => setProvider(event.target.value as 'pixabay' | 'pexels')} className="block mt-1.5 rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground">
              {PROVIDERS.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-foreground-muted">Video ID
            <input value={videoId} disabled={busy} onChange={(event) => setVideoId(event.target.value)} inputMode="numeric" placeholder="e.g. 325416" className="block mt-1.5 w-32 rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground" />
          </label>
          <label className="text-xs text-foreground-muted">Label
            <input value={label} disabled={busy} onChange={(event) => setLabel(event.target.value)} maxLength={80} required placeholder="Why it is funny" className="block mt-1.5 w-52 rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground" />
          </label>
          <button type="submit" disabled={busy || !label.trim() || !videoId.trim()} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-accent text-black disabled:opacity-40"><Plus className="w-4 h-4" />Add clip</button>
        </form>
        <p className="text-xs text-foreground-faint mb-4">The ID is the number in the clip URL: pixabay.com/videos/…-<span className="text-foreground-muted">325416</span>/ or pexels.com/video/…-<span className="text-foreground-muted">325416</span>/.</p>
        {error && <div className="flex flex-wrap items-center gap-3 mb-4"><p role="alert" className="text-sm text-red-400">{error}</p>{clips === null && <button type="button" onClick={() => { setError(null); void load(); }} className="text-xs font-semibold rounded-lg bg-white/5 border border-border px-3 py-2 hover:bg-white/10">Try again</button>}</div>}
        {clips === null ? (error ? null : <p className="text-sm text-foreground-muted flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading clips…</p>)
          : !clips.length ? <p className="text-sm text-foreground-muted">No clips yet. Memes fall back to stock search until you add some.</p>
            : <ul className="space-y-2">{clips.map((clip) => <li key={clip.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3 ${clip.active ? '' : 'opacity-60'}`}>
              <div className="min-w-0">
                <p className="text-sm font-medium break-words">{clip.label}</p>
                <p className="text-xs text-foreground-faint">{clip.provider === 'pixabay' ? 'Pixabay' : 'Pexels'} · {clip.video_id} · by {clip.author}{clip.active ? '' : ' · inactive'}</p>
              </div>
              <div className="flex items-center gap-3">
                {clip.page_url.startsWith('https://') && <a href={clip.page_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">Source<ExternalLink className="w-3 h-3" /></a>}
                <button type="button" disabled={busy} onClick={() => void toggle(clip)} className="text-xs font-semibold rounded-lg bg-white/5 border border-border px-3 py-2 hover:bg-white/10 disabled:opacity-40">{clip.active ? 'Deactivate' : 'Activate'}</button>
              </div>
            </li>)}</ul>}
      </div>}
    </section>
  );
}
