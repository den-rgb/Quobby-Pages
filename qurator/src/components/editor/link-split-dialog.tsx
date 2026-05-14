'use client';

import { useEditorStore } from '@/lib/store';
import type { MediaAttachment } from '@/lib/types';
import {
  Plus,
  Scissors,
  Trash2,
  X,
} from 'lucide-react';
import { useState } from 'react';

interface Props {
  media: MediaAttachment;
  currentStepId: string;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function parseTime(input: string): number | null {
  const parts = input.trim().split(':');
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (!isNaN(m) && !isNaN(s) && m >= 0 && s >= 0 && s < 60) return m * 60 + s;
  }
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parseInt(parts[2], 10);
    if (!isNaN(h) && !isNaN(m) && !isNaN(s) && h >= 0 && m >= 0 && m < 60 && s >= 0 && s < 60)
      return h * 3600 + m * 60 + s;
  }
  return null;
}

export function LinkSplitDialog({ media, currentStepId, onClose }: Props) {
  const { steps, updateStepContent, addContentStep, addConnection } = useEditorStore();
  const [splitPoints, setSplitPoints] = useState<number[]>([]);
  const [timeInput, setTimeInput] = useState('');
  const [durationInput, setDurationInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const duration = parseTime(durationInput);

  const addSplitPoint = () => {
    const t = parseTime(timeInput);
    if (t === null || t <= 0) {
      setError('Enter a valid time (m:ss or h:mm:ss)');
      return;
    }
    if (duration !== null && t >= duration) {
      setError('Split point must be before the video duration');
      return;
    }
    if (splitPoints.some((p) => Math.abs(p - t) < 1)) {
      setError('Split point already exists near that time');
      return;
    }
    setError(null);
    setSplitPoints((prev) => [...prev, t].sort((a, b) => a - b));
    setTimeInput('');
  };

  const removeSplitPoint = (index: number) => {
    setSplitPoints((prev) => prev.filter((_, i) => i !== index));
  };

  const segmentRanges = (() => {
    const end = duration ?? splitPoints[splitPoints.length - 1] + 60;
    const pts = [0, ...splitPoints, end];
    return pts.slice(0, -1).map((start, i) => ({
      start,
      end: i === pts.length - 2 && duration === null ? undefined : pts[i + 1],
    }));
  })();

  const handleSplit = () => {
    if (splitPoints.length === 0) {
      setError('Add at least one split point');
      return;
    }

    const currentStep = steps.find((s) => s.id === currentStepId);
    const baseX = currentStep?.position_x ?? 300;
    const baseY = currentStep?.position_y ?? 200;
    const content = currentStep?.content_json ?? { heading: '', body: '' };

    const firstSeg = segmentRanges[0];
    const firstAttachment: MediaAttachment = {
      ...media,
      id: crypto.randomUUID(),
      video_start: firstSeg.start > 0 ? firstSeg.start : undefined,
      video_end: firstSeg.end,
    };
    updateStepContent(currentStepId, {
      ...content,
      media: [...(content.media ?? []).filter((m) => m.id !== media.id), firstAttachment],
    });

    let prevStepId = currentStepId;
    for (let i = 1; i < segmentRanges.length; i++) {
      const seg = segmentRanges[i];
      const newStep = addContentStep(baseX, baseY + i * 160);
      const startLabel = formatTime(seg.start);
      const endLabel = seg.end !== undefined ? formatTime(seg.end) : 'end';
      const heading = `Part ${i + 1} (${startLabel}–${endLabel})`;
      const attachment: MediaAttachment = {
        ...media,
        id: crypto.randomUUID(),
        video_start: seg.start,
        video_end: seg.end,
      };
      updateStepContent(newStep.id, {
        heading,
        body: '',
        media: [attachment],
      });
      addConnection(prevStepId, newStep.id);
      prevStepId = newStep.id;
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#16162a] border border-white/10 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Scissors className="w-4 h-4 text-accent" />
            Split Linked Video
          </h2>
          <button onClick={onClose} className="p-1 text-foreground-faint hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <iframe
            src={media.url}
            className="w-full rounded-xl aspect-video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />

          <p className="text-xs text-foreground-muted leading-relaxed">
            Watch the video and enter timestamps where you want to split. Each segment
            becomes its own tutorial step — the video will auto-start and auto-stop at
            the selected times.
          </p>

          <div>
            <label className="block text-[10px] font-medium text-foreground-faint mb-1">
              Total duration (optional, e.g. 5:30)
            </label>
            <input
              type="text"
              value={durationInput}
              onChange={(e) => setDurationInput(e.target.value)}
              className="w-32 px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30"
              placeholder="m:ss"
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-foreground-faint mb-1">
              Add split point
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSplitPoint()}
                className="w-32 px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30"
                placeholder="m:ss"
              />
              <button
                onClick={addSplitPoint}
                disabled={!timeInput.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-accent hover:text-accent-light transition-colors disabled:opacity-30"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>

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
                  <span className={`w-2 h-2 rounded-full shrink-0 ${i % 2 === 0 ? 'bg-accent' : 'bg-green'}`} />
                  <span className="text-xs text-foreground flex-1">
                    {formatTime(seg.start)} – {seg.end !== undefined ? formatTime(seg.end) : 'end'}
                  </span>
                  <span className="text-[10px] text-foreground-faint truncate max-w-[10rem]">
                    {i === 0 ? '→ Current step' : `→ New step (Part ${i + 1})`}
                  </span>
                  {i > 0 && i <= splitPoints.length && (
                    <button
                      onClick={() => removeSplitPoint(i - 1)}
                      className="text-foreground-faint hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-foreground-muted hover:text-foreground border border-white/10 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSplit}
              disabled={splitPoints.length === 0}
              className="px-4 py-2 text-xs font-medium text-white bg-accent rounded-xl hover:bg-accent-light transition-colors disabled:opacity-30 flex items-center gap-1.5"
            >
              <Scissors className="w-3.5 h-3.5" />
              Split into {segmentRanges.length} steps
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
