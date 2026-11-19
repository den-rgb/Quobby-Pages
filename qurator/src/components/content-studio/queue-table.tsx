'use client';

import { useAuth } from '@/lib/auth';
import { StudioAccessError, studioRequest } from '@/lib/content-studio/client';
import { templateLabel } from '@/lib/content-studio/templates';
import type { QueueCampaign, WorkerHeartbeat } from '@/lib/content-studio/types';
import { Loader2, Plus, RefreshCw, ShieldAlert, Sparkles, Video } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CampaignForm } from './campaign-form';
import { ClipLibrary } from './clip-library';
import { ReviewPanel } from './review-panel';

interface QueueResponse { campaigns: QueueCampaign[]; workers: WorkerHeartbeat[] }

function AdminOnly() {
  return <div className="max-w-lg mx-auto px-6 py-24 text-center">
    <ShieldAlert className="w-8 h-8 text-red-400 mx-auto mb-3" />
    <h1 className="text-lg font-semibold text-foreground mb-2">Admin only</h1>
    <p className="text-sm text-foreground-muted mb-6">You need an admin account to view Content Studio.</p>
    <Link href="/" className="text-sm text-accent hover:underline">Back home</Link>
  </div>;
}

// Unmount the entire data-owning subtree whenever identity or admin access changes.
export function QueueTable({ adminId }: { adminId: string }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="p-16 flex items-center justify-center gap-2 text-sm text-foreground-muted"><Loader2 className="w-4 h-4 animate-spin" />Checking admin access…</div>;
  if (!user || user.id !== adminId || !isAdmin) return <AdminOnly />;
  return <AuthorizedStudio key={user.id} adminId={adminId} />;
}

function AuthorizedStudio({ adminId }: { adminId: string }) {
  const [data, setData] = useState<QueueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [creating, setCreating] = useState<false | 'upload' | 'meme'>(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const deny = useCallback(() => { setData(null); setForbidden(true); }, []);
  const reload = useCallback(() => setRefresh((value) => value + 1), []);

  useEffect(() => {
    if (forbidden) return;
    const controller = new AbortController();
    let pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      setLoading(true);
      try {
        const response = await studioRequest<QueueResponse>('/campaigns', { signal: controller.signal });
        if (controller.signal.aborted) return;
        setData(response); setError(null); setUpdatedAt(Date.now());
      } catch (failure) {
        if (controller.signal.aborted) return;
        if (failure instanceof StudioAccessError) deny();
        else setError('Could not refresh the queue. Displayed data may be out of date.');
      } finally {
        pending = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    const poll = setInterval(() => void load(), 30_000);
    return () => { controller.abort(); clearInterval(poll); };
  }, [refresh, forbidden, deny]);

  if (forbidden) return <AdminOnly />;
  const selected = data?.campaigns.find((campaign) => campaign.id === selectedId);

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1"><Video className="w-4 h-4 text-accent" /><h1 className="text-xl font-bold">Content Studio</h1></div>
          <p className="text-sm text-foreground-muted">Create Quobby videos, review renders, and follow publishing progress.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Link href="/admin" className="text-xs text-foreground-muted hover:text-foreground px-2 py-2">Analytics</Link>
          <button type="button" onClick={reload} disabled={loading} aria-label="Refresh campaign queue" className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-40"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button type="button" onClick={() => setCreating('upload')} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-border hover:bg-white/5"><Plus className="w-4 h-4" />New campaign</button>
          <button type="button" onClick={() => setCreating('meme')} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-accent text-black"><Sparkles className="w-4 h-4" />Generate meme</button>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-white/[0.03] px-4 py-3 mb-6 text-xs" role="status">
        <p className="text-foreground-muted">Videos render in this browser when you generate or re-render them, and publishing is manual. Nothing runs in the background.</p>
      </div>
      {creating && <CampaignForm key={creating} mode={creating} onCreated={(id) => { setCreating(false); setSelectedId(id); reload(); }} onClose={() => setCreating(false)} onForbidden={deny} />}
      <ClipLibrary onForbidden={deny} />
      {error && <p role="alert" className="text-sm text-red-400 mb-4">{error}</p>}
      <section aria-labelledby="campaign-queue-title" className="border border-border rounded-2xl overflow-hidden">
        <div className="p-4 flex flex-wrap items-center justify-between gap-2 border-b border-border">
          <h2 id="campaign-queue-title" className="text-sm font-semibold">Campaign queue &amp; history</h2>
          <p className="text-xs text-foreground-faint">Latest 100 campaigns · refreshes every 30 seconds{updatedAt ? ` · Updated ${new Date(updatedAt).toLocaleTimeString()}` : ''}</p>
        </div>
        {!data && loading ? <p className="text-sm text-foreground-muted p-6">Loading campaigns…</p>
          : !data ? <p className="text-sm text-foreground-muted p-6">Queue unavailable. Refresh to try again.</p>
            : !data.campaigns.length ? <p className="text-sm text-foreground-muted p-6">No campaigns yet. Choose a template to create your first video.</p>
              : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                <thead className="text-xs text-foreground-faint bg-white/[0.02]"><tr><th scope="col" className="p-4 font-medium">Campaign</th><th scope="col" className="p-4 font-medium">Status</th><th scope="col" className="p-4 font-medium">Platforms</th><th scope="col" className="p-4 font-medium">Created</th><th scope="col" className="p-4 font-medium"><span className="sr-only">Review</span></th></tr></thead>
                <tbody className="divide-y divide-border">{data.campaigns.map((campaign) => {
                  const publications = campaign.content_studio_renders.flatMap((render) => render.content_studio_publications);
                  return <tr key={campaign.id} className={campaign.id === selectedId ? 'bg-accent/5' : 'hover:bg-white/[0.02]'}>
                    <td className="p-4 min-w-48"><p className="font-medium break-words">{campaign.title}</p><p className="text-xs text-foreground-faint mt-1">{templateLabel(campaign.template_id)}</p></td>
                    <td className="p-4"><span className={`inline-block px-2 py-1 rounded-lg text-xs capitalize ${campaign.status === 'failed' ? 'bg-red-400/10 text-red-400' : campaign.status === 'review' ? 'bg-accent/10 text-accent' : 'bg-white/5 text-foreground-muted'}`}>{campaign.status}</span></td>
                    <td className="p-4"><ul className="space-y-1">{publications.map((publication) => <li key={publication.id} className={`text-xs capitalize ${publication.status === 'failed' ? 'text-red-400' : 'text-foreground-muted'}`}>{publication.platform} · {publication.status}</li>)}</ul></td>
                    <td className="p-4 text-xs text-foreground-faint whitespace-nowrap">{new Date(campaign.created_at).toLocaleString()}</td>
                    <td className="p-4"><button type="button" onClick={() => setSelectedId(campaign.id)} aria-label={`Review ${campaign.title}`} className="text-xs text-accent hover:underline">Review</button></td>
                  </tr>;
                })}</tbody>
              </table></div>}
      </section>
      {selected && <ReviewPanel key={selected.id} campaign={selected} adminId={adminId} onClose={() => setSelectedId(null)} onChanged={reload} onForbidden={deny} />}
    </div>
  );
}
