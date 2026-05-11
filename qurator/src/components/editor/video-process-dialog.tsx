'use client';

import { PremiumUpsell } from '@/components/premium-upsell';
import { useEditorStore } from '@/lib/store';
import type { MediaAttachment } from '@/lib/types';
import {
  compressVideo,
  getVideoDuration,
  splitVideo,
} from '@/lib/video-processor';
import {
  Crown,
  Film,
  Loader2,
  Minimize2,
  Plus,
  Scissors,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  file: File;
  currentStepId: string;
  isPremium: boolean;
  onClose: () => void;
  onComplete: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VideoProcessDialog({
  file,
  currentStepId,
  isPremium,
  onClose,
  onComplete,
}: Props) {
  const { steps, updateStepContent, addContentStep, addConnection } = useEditorStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl] = useState(() => URL.createObjectURL(file));
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [splitPoints, setSplitPoints] = useState<number[]>([]);
  const [mode, setMode] = useState<'compress' | 'split'>('compress');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [loadingEngine, setLoadingEngine] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);

  useEffect(() => {
    return () => URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  useEffect(() => {
    getVideoDuration(file).then(setDuration).catch(() => { });
  }, [file]);

  const addSplitPoint = useCallback(() => {
    if (currentTime > 0.5 && currentTime < duration - 0.5) {
      setSplitPoints((prev) => {
        if (prev.some((p) => Math.abs(p - currentTime) < 1)) return prev;
        return [...prev, currentTime].sort((a, b) => a - b);
      });
    }
  }, [currentTime, duration]);

  const removeSplitPoint = (index: number) => {
    setSplitPoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = pct * duration;
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const uploadBlob = async (
    blob: Blob,
    name: string,
  ): Promise<MediaAttachment> => {
    const f = new File([blob], name, { type: 'video/mp4' });
    const formData = new FormData();
    formData.append('file', f);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Upload failed (${res.status})`);
    }
    const data = await res.json();
    return {
      id: crypto.randomUUID(),
      url: data.url,
      type: 'video',
      filename: data.filename,
      size_bytes: data.size_bytes,
    };
  };

  const addMediaToStep = (stepId: string, attachment: MediaAttachment) => {
    const step = steps.find((s) => s.id === stepId);
    if (!step) return;
    const content = step.content_json ?? { heading: '', body: '' };
    updateStepContent(stepId, {
      ...content,
      media: [...(content.media ?? []), attachment],
    });
  };

  const handleCompress = async () => {
    setProcessing(true);
    setError(null);
    setLoadingEngine(true);
    setProgressLabel('Loading video processor...');

    try {
      const blob = await compressVideo(file, (p) => {
        setLoadingEngine(false);
        setProgress(p * 0.8);
        setProgressLabel('Compressing...');
      });

      setProgress(0.85);
      setProgressLabel('Uploading...');

      const name = `compressed_${file.name.replace(/\.\w+$/, '')}.mp4`;
      const attachment = await uploadBlob(blob, name);
      addMediaToStep(currentStepId, attachment);

      setProgress(1);
      setProgressLabel('Done!');
      setTimeout(onComplete, 600);
    } catch (err) {
      setError((err as Error).message);
      setProcessing(false);
    }
  };

  const handleSplit = async () => {
    if (splitPoints.length === 0) {
      setError('Add at least one split point on the timeline');
      return;
    }

    setProcessing(true);
    setError(null);
    setLoadingEngine(true);
    setProgressLabel('Loading video processor...');

    try {
      const needsCompress = file.size > 50 * 1024 * 1024;

      const segments = await splitVideo(
        file,
        splitPoints,
        needsCompress,
        (p, label) => {
          setLoadingEngine(false);
          setProgress(p * 0.7);
          setProgressLabel(label);
        },
      );

      const attachments: MediaAttachment[] = [];
      for (let i = 0; i < segments.length; i++) {
        setProgress(0.7 + (i / segments.length) * 0.25);
        setProgressLabel(
          `Uploading segment ${i + 1} of ${segments.length}...`,
        );

        const name = `${file.name.replace(/\.\w+$/, '')}_part${i + 1}.mp4`;
        attachments.push(await uploadBlob(segments[i].blob, name));
      }

      setProgress(0.95);
      setProgressLabel('Creating steps...');

      const currentStep = steps.find((s) => s.id === currentStepId);
      const baseX = currentStep?.position_x ?? 300;
      const baseY = currentStep?.position_y ?? 200;

      addMediaToStep(currentStepId, attachments[0]);

      let prevStepId = currentStepId;
      for (let i = 1; i < attachments.length; i++) {
        const seg = segments[i];
        const newStep = addContentStep(baseX, baseY + i * 160);
        const heading = `Part ${i + 1} (${formatTime(seg.startTime)}–${formatTime(seg.endTime)})`;
        updateStepContent(newStep.id, {
          heading,
          body: '',
          media: [attachments[i]],
        });
        addConnection(prevStepId, newStep.id);
        prevStepId = newStep.id;
      }

      setProgress(1);
      setProgressLabel('Done!');
      setTimeout(onComplete, 600);
    } catch (err) {
      setError((err as Error).message);
      setProcessing(false);
    }
  };

  const segmentRanges = (() => {
    if (duration <= 0) return [];
    const pts = [0, ...splitPoints, duration];
    return pts.slice(0, -1).map((start, i) => ({
      start,
      end: pts[i + 1],
    }));
  })();

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#16162a] border border-white/10 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Film className="w-4 h-4 text-accent" />
            Process Video
          </h2>
          <button
            onClick={onClose}
            disabled={processing}
            className="p-1 text-foreground-faint hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Video preview */}
          {previewFailed ? (
            <div className="w-full rounded-xl bg-black/40 flex flex-col items-center justify-center py-8 gap-2">
              <Film className="w-8 h-8 text-foreground-faint" />
              <p className="text-xs text-foreground-muted">
                Preview unavailable — FFmpeg can still process this file
              </p>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              onTimeUpdate={() =>
                setCurrentTime(videoRef.current?.currentTime ?? 0)
              }
              onLoadedMetadata={() =>
                setDuration(videoRef.current?.duration ?? 0)
              }
              onError={() => setPreviewFailed(true)}
              className="w-full rounded-xl bg-black max-h-52"
            />
          )}

          {/* Info */}
          <div className="flex items-center gap-3 text-xs text-foreground-muted">
            <span>Duration: {formatTime(duration)}</span>
            <span className="text-foreground-faint">·</span>
            <span>Size: {(file.size / (1024 * 1024)).toFixed(1)} MB</span>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-1 bg-white/10 rounded-xl p-1">
            <button
              onClick={() => setMode('compress')}
              disabled={processing}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${mode === 'compress'
                ? 'bg-accent/20 text-accent'
                : 'text-foreground-muted hover:text-foreground'
                }`}
            >
              <Minimize2 className="w-3.5 h-3.5" />
              Compress
            </button>
            <button
              onClick={() => {
                if (!isPremium) {
                  setShowUpsell(true);
                  return;
                }
                setMode('split');
              }}
              disabled={processing}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${mode === 'split'
                ? 'bg-accent/20 text-accent'
                : 'text-foreground-muted hover:text-foreground'
                }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              Split &amp; Distribute
              {!isPremium && <Crown className="w-3 h-3 text-yellow-400" />}
            </button>
          </div>

          {/* Compress mode */}
          {mode === 'compress' && (
            <p className="text-xs text-foreground-muted leading-relaxed">
              Compress the video to fit under 50 MB and add it to the current
              step. Resolution will be capped at 720p.
            </p>
          )}

          {/* Split mode */}
          {mode === 'split' && (
            <div className="space-y-4">
              <p className="text-xs text-foreground-muted leading-relaxed">
                Play the video, then click &ldquo;Split&rdquo; to mark cut
                points. The first segment stays on the current step; each
                additional segment creates a new step linked in order.
              </p>

              {/* Timeline */}
              {duration > 0 && (
                <div>
                  <div
                    className="relative h-8 bg-white/10 rounded-lg cursor-pointer overflow-hidden"
                    onClick={handleTimelineClick}
                  >
                    {segmentRanges.map((seg, i) => (
                      <div
                        key={i}
                        className={`absolute top-0 bottom-0 ${i % 2 === 0 ? 'bg-accent/15' : 'bg-green/15'
                          }`}
                        style={{
                          left: `${(seg.start / duration) * 100}%`,
                          width: `${((seg.end - seg.start) / duration) * 100}%`,
                        }}
                      />
                    ))}
                    {splitPoints.map((pt, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10"
                        style={{ left: `${(pt / duration) * 100}%` }}
                      />
                    ))}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white z-20"
                      style={{
                        left: `${(currentTime / duration) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-foreground-faint mt-1">
                    <span>0:00</span>
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              )}

              {/* Add split button */}
              <button
                onClick={addSplitPoint}
                disabled={
                  processing ||
                  currentTime <= 0.5 ||
                  currentTime >= duration - 0.5
                }
                className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-light disabled:opacity-30 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Split at {formatTime(currentTime)}
              </button>

              {/* Segments list */}
              {segmentRanges.length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-foreground-faint uppercase tracking-wider">
                    Segments ({segmentRanges.length})
                  </label>
                  {segmentRanges.map((seg, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg"
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${i % 2 === 0 ? 'bg-accent' : 'bg-green'
                          }`}
                      />
                      <span className="text-xs text-foreground flex-1">
                        {formatTime(seg.start)} – {formatTime(seg.end)}
                      </span>
                      <span className="text-[10px] text-foreground-faint truncate max-w-[10rem]">
                        {i === 0
                          ? `→ Current step`
                          : `→ New step (Part ${i + 1})`}
                      </span>
                      {i > 0 && i <= splitPoints.length && (
                        <button
                          onClick={() => removeSplitPoint(i - 1)}
                          disabled={processing}
                          className="text-foreground-faint hover:text-red-400 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Progress */}
          {processing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                <span className="text-xs text-foreground-muted">
                  {progressLabel}
                </span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              {loadingEngine && (
                <p className="text-[10px] text-foreground-faint">
                  Downloading video processor (~25 MB, cached after first
                  use)...
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              disabled={processing}
              className="px-4 py-2 text-xs text-foreground-muted hover:text-foreground border border-white/10 rounded-xl transition-colors disabled:opacity-30"
            >
              Cancel
            </button>
            <button
              onClick={mode === 'compress' ? handleCompress : handleSplit}
              disabled={
                processing ||
                (mode === 'split' && splitPoints.length === 0)
              }
              className="px-4 py-2 text-xs font-medium text-white bg-accent rounded-xl hover:bg-accent-light transition-colors disabled:opacity-30 flex items-center gap-1.5"
            >
              {processing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Processing...
                </>
              ) : mode === 'compress' ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  Compress &amp; Upload
                </>
              ) : (
                <>
                  <Scissors className="w-3.5 h-3.5" />
                  Split &amp; Upload
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {showUpsell && (
        <PremiumUpsell
          feature="Video splitting"
          onClose={() => setShowUpsell(false)}
        />
      )}
    </div>
  );
}
