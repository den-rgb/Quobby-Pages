'use client';

import { useAuth } from '@/lib/auth';
import { videoRawMaxBytes, videoRawMaxLabel } from '@/lib/premium';
import { useEditorStore } from '@/lib/store';
import type {
  CodeBlock,
  ContentStepPayload,
  InteractiveElement,
  LogicCondition,
  LogicStepPayload,
  MediaAttachment,
  MediaCrop,
} from '@/lib/types';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code,
  Crop,
  ExternalLink,
  FileText,
  Film,
  GitBranch,
  Grid3X3,
  HelpCircle,
  Image as ImageIcon,
  Lightbulb,
  Package,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactCrop, { type Crop as CropType } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

const VideoProcessDialog = dynamic(
  () =>
    import('./video-process-dialog').then((m) => ({
      default: m.VideoProcessDialog,
    })),
  { ssr: false },
);

export function ContentPanel() {
  const {
    steps,
    variables,
    selectedStepId,
    selectStep,
    updateStepContent,
    updateStepLogic,
  } = useEditorStore();

  useEffect(() => {
    if (!selectedStepId && steps.length > 0) {
      selectStep(steps[0].id);
    }
  }, [selectedStepId, steps, selectStep]);

  const selectedStep = steps.find((s) => s.id === selectedStepId);
  const stepIndex = steps.findIndex((s) => s.id === selectedStepId);

  const goToPrev = () => {
    if (stepIndex > 0) selectStep(steps[stepIndex - 1].id);
  };
  const goToNext = () => {
    if (stepIndex < steps.length - 1) selectStep(steps[stepIndex + 1].id);
  };

  if (steps.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <FileText className="w-8 h-8 text-foreground-faint mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground mb-1">
            No steps yet
          </p>
          <p className="text-xs text-foreground-muted">
            Add steps in the flow canvas, then double-click to edit.
          </p>
        </div>
      </div>
    );
  }

  if (!selectedStep) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-sm text-foreground-muted mb-1">
            No step selected
          </p>
          <p className="text-xs text-foreground-faint">
            Click a step in the flow canvas or use the arrows below.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
            {steps.map((step, i) => (
              <button
                key={step.id}
                onClick={() => selectStep(step.id)}
                className="px-2.5 py-1 text-xs rounded-lg border border-border hover:border-accent/30 text-foreground-muted hover:text-foreground transition-all"
              >
                {i + 1}. {step.step_type === 'content' ? (step.content_json?.heading || 'Untitled') : 'Logic'}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Step navigator */}
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 shrink-0">
        <button
          onClick={goToPrev}
          disabled={stepIndex <= 0}
          className="p-1 text-foreground-faint hover:text-foreground disabled:opacity-20 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {selectedStep.step_type === 'content' ? (
            <FileText className="w-3.5 h-3.5 text-accent shrink-0" />
          ) : (
            <GitBranch className="w-3.5 h-3.5 text-green shrink-0" />
          )}
          <span className="text-xs font-medium text-foreground truncate">
            Step {stepIndex + 1} of {steps.length}
            {selectedStep.step_type === 'content'
              ? ` — ${selectedStep.content_json?.heading || 'Untitled'}`
              : ' — Logic'}
          </span>
        </div>
        <button
          onClick={goToNext}
          disabled={stepIndex >= steps.length - 1}
          className="p-1 text-foreground-faint hover:text-foreground disabled:opacity-20 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto">
        {selectedStep.step_type === 'content' ? (
          <ContentEditor
            step={selectedStep}
            updateStepContent={updateStepContent}
          />
        ) : (
          <LogicEditor
            step={selectedStep}
            allSteps={steps}
            variables={variables}
            updateStepLogic={updateStepLogic}
          />
        )}
      </div>
    </div>
  );
}

function ContentEditor({
  step,
  updateStepContent,
}: {
  step: { id: string; content_json: ContentStepPayload | null };
  updateStepContent: (id: string, content: ContentStepPayload) => void;
}) {
  const category = useEditorStore((s) => s.category);
  const isBoardGames = category?.slug === 'board-games';
  const content = step.content_json ?? { heading: '', body: '' };

  const updateField = (field: keyof ContentStepPayload, value: unknown) => {
    updateStepContent(step.id, { ...content, [field]: value });
  };

  const handleBoardRemove = () => {
    const { board_view: _, ...rest } = content;
    updateStepContent(step.id, rest as ContentStepPayload);
  };

  const addQuiz = () => {
    updateStepContent(step.id, {
      ...content,
      interactive: {
        type: 'multiple_choice',
        question: '',
        options: [
          { label: '', correct: true },
          { label: '', correct: false },
        ],
        explanation: '',
      },
    });
  };

  const removeQuiz = () => {
    const { interactive: _, ...rest } = content;
    updateStepContent(step.id, rest as ContentStepPayload);
  };

  const updateQuiz = (updates: Partial<InteractiveElement>) => {
    if (!content.interactive) return;
    updateStepContent(step.id, {
      ...content,
      interactive: { ...content.interactive, ...updates },
    });
  };

  return (
    <div className="p-5 space-y-5">
      <div>
        <label className="block text-xs font-medium text-foreground-muted mb-1">
          Heading
        </label>
        <input
          type="text"
          value={content.heading ?? ''}
          onChange={(e) => updateField('heading', e.target.value)}
          className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30 transition-colors"
          placeholder="Step heading..."
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground-muted mb-1">
          Body
        </label>
        <textarea
          value={content.body ?? ''}
          onChange={(e) => updateField('body', e.target.value)}
          rows={6}
          className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30 transition-colors resize-y font-mono leading-relaxed"
          placeholder="Step content... Use **bold** for emphasis."
        />
        <p className="text-[10px] text-foreground-faint mt-0.5">
          Supports **bold** markdown.
        </p>
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-foreground-muted mb-1">
          <Lightbulb className="w-3.5 h-3.5 text-accent" />
          Tip (optional)
        </label>
        <input
          type="text"
          value={content.tip ?? ''}
          onChange={(e) =>
            updateField('tip', e.target.value || undefined)
          }
          className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30 transition-colors"
          placeholder="A helpful hint for the player..."
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground-muted mb-1">
          Image URL (optional)
        </label>
        <input
          type="url"
          value={content.image_url ?? ''}
          onChange={(e) =>
            updateField('image_url', e.target.value || undefined)
          }
          className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30 transition-colors"
          placeholder="https://example.com/image.jpg"
        />
      </div>

      <MediaUploadSection
        media={content.media ?? []}
        onChange={(media) => updateField('media', media.length > 0 ? media : undefined)}
        stepId={step.id}
      />

      <CodeBlockSection
        codeBlock={content.code_block}
        onChange={(cb) => updateField('code_block', cb)}
      />

      {/* Setup step toggle */}
      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <button
          onClick={() => updateField('is_setup_step', !content.is_setup_step)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${content.is_setup_step ? 'bg-accent' : 'bg-white/10'
            }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${content.is_setup_step ? 'translate-x-[18px]' : 'translate-x-[3px]'
              }`}
          />
        </button>
        <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Package className="w-3.5 h-3.5 text-accent" />
          Setup Step
        </label>
      </div>

      {/* Board view section — only for board games */}
      {isBoardGames && (
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Grid3X3 className="w-3.5 h-3.5 text-accent" />
              Board View
            </label>
            {!content.board_view && (
              <Link
                href={`/create/new/board-setup?step=${step.id}`}
                className="flex items-center gap-1 text-[10px] text-accent hover:text-accent-light transition-colors"
              >
                <Plus className="w-3 h-3" />
                Design Board
              </Link>
            )}
          </div>

          {content.board_view && (
            <div className="space-y-3">
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="p-3 bg-white/[0.02]">
                  <p className="text-[10px] text-foreground-faint mb-1">
                    {content.board_view.canvas_elements?.length ?? 0} element
                    {(content.board_view.canvas_elements?.length ?? 0) !== 1 ? 's' : ''}
                    {content.board_view.title && ` · ${content.board_view.title}`}
                  </p>
                  <div className="flex gap-2">
                    <Link
                      href={`/create/new/board-setup?step=${step.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-lg text-[11px] text-foreground hover:border-accent/30 transition-all"
                    >
                      <Pencil className="w-3 h-3 text-accent" />
                      Edit Board
                      <ExternalLink className="w-2.5 h-2.5 text-foreground-faint" />
                    </Link>
                    <button
                      onClick={handleBoardRemove}
                      className="flex items-center gap-1 px-3 py-1.5 text-[11px] text-red-400 hover:text-red-300 border border-border rounded-lg hover:border-red-400/30 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quiz section */}
      <div className="pt-4 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <HelpCircle className="w-3.5 h-3.5 text-accent" />
            Comprehension Check
          </label>
          {!content.interactive ? (
            <button
              onClick={addQuiz}
              className="flex items-center gap-1 text-[10px] text-accent hover:text-accent-light transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add Quiz
            </button>
          ) : (
            <button
              onClick={removeQuiz}
              className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Remove
            </button>
          )}
        </div>

        {content.interactive && (
          <div className="space-y-3 p-3 bg-white/[0.02] border border-border rounded-xl">
            <div>
              <label className="block text-[10px] font-medium text-foreground-faint mb-0.5">
                Question
              </label>
              <input
                type="text"
                value={content.interactive.question ?? ''}
                onChange={(e) => updateQuiz({ question: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30"
                placeholder="What would you do?"
              />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-foreground-faint mb-1.5">
                Options
              </label>
              <div className="space-y-1.5">
                {content.interactive.options?.map((opt, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const newOpts = content.interactive!.options!.map(
                          (o, j) => ({ ...o, correct: j === i })
                        );
                        updateQuiz({ options: newOpts });
                      }}
                      className={`shrink-0 ${opt.correct ? 'text-green' : 'text-foreground-faint'
                        }`}
                      title={opt.correct ? 'Correct answer' : 'Mark correct'}
                    >
                      {opt.correct ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => {
                        const newOpts = [...content.interactive!.options!];
                        newOpts[i] = { ...newOpts[i], label: e.target.value };
                        updateQuiz({ options: newOpts });
                      }}
                      className="flex-1 px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30"
                      placeholder={`Option ${i + 1}`}
                    />
                    {(content.interactive?.options?.length ?? 0) > 2 && (
                      <button
                        onClick={() => {
                          const newOpts = content.interactive!.options!.filter(
                            (_, j) => j !== i
                          );
                          updateQuiz({ options: newOpts });
                        }}
                        className="text-foreground-faint hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  const newOpts = [
                    ...(content.interactive!.options ?? []),
                    { label: '', correct: false },
                  ];
                  updateQuiz({ options: newOpts });
                }}
                className="mt-1.5 flex items-center gap-1 text-[10px] text-accent hover:text-accent-light transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add option
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-foreground-faint mb-0.5">
                Explanation
              </label>
              <input
                type="text"
                value={content.interactive.explanation ?? ''}
                onChange={(e) => updateQuiz({ explanation: e.target.value })}
                className="w-full px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30"
                placeholder="Why this is the correct answer..."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

function MediaUploadSection({
  media,
  onChange,
  stepId,
}: {
  media: MediaAttachment[];
  onChange: (media: MediaAttachment[]) => void;
  stepId: string;
}) {
  const { isPremium } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [processFile, setProcessFile] = useState<File | null>(null);
  const [cropTarget, setCropTarget] = useState<MediaAttachment | null>(null);
  const [crop, setCrop] = useState<CropType>({ unit: '%', x: 10, y: 10, width: 80, height: 80 });
  const inputRef = useRef<HTMLInputElement>(null);

  const rawMax = videoRawMaxBytes(isPremium);

  const uploadFile = useCallback(async (file: File) => {
    setError(null);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);

    if (!isVideo && !isImage) {
      setError('Unsupported file type');
      return;
    }

    if (isImage && file.size > IMAGE_MAX_BYTES) {
      setError(`Image exceeds ${IMAGE_MAX_BYTES / (1024 * 1024)} MB limit`);
      return;
    }

    if (isVideo && file.size > rawMax) {
      setError(`Video exceeds ${videoRawMaxLabel(isPremium)} limit`);
      return;
    }

    if (isVideo && file.size > VIDEO_MAX_BYTES) {
      setProcessFile(file);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Upload failed (${res.status})`);
      }
      const data = await res.json();
      const attachment: MediaAttachment = {
        id: crypto.randomUUID(),
        url: data.url,
        type: data.type,
        filename: data.filename,
        size_bytes: data.size_bytes,
      };
      onChange([...media, attachment]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }, [media, onChange, rawMax, isPremium]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const removeMedia = (id: string) => {
    onChange(media.filter((m) => m.id !== id));
  };

  return (
    <div className="pt-4 border-t border-border">
      <label className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-2">
        <Upload className="w-3.5 h-3.5 text-accent" />
        Media (images &amp; videos)
      </label>

      {media.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {media.map((m) => (
            <div key={m.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-white/[0.02] border border-border rounded-lg">
              {m.type === 'video' ? (
                <Film className="w-3.5 h-3.5 text-accent shrink-0" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5 text-accent shrink-0" />
              )}
              <span className="text-xs text-foreground truncate flex-1">{m.filename}</span>
              <span className="text-[10px] text-foreground-faint shrink-0">
                {(m.size_bytes / (1024 * 1024)).toFixed(1)} MB
              </span>
              {m.type === 'image' && (
                <button
                  onClick={() => {
                    const existing = m.crop;
                    setCrop(existing
                      ? { unit: '%', x: existing.x, y: existing.y, width: existing.width, height: existing.height }
                      : { unit: '%', x: 10, y: 10, width: 80, height: 80 });
                    setCropTarget(m);
                  }}
                  className="text-foreground-faint hover:text-accent transition-colors shrink-0"
                  title="Crop image"
                >
                  <Crop className="w-3 h-3" />
                </button>
              )}
              <button onClick={() => removeMedia(m.id)} className="text-foreground-faint hover:text-red-400 transition-colors shrink-0">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${dragOver ? 'border-accent/50 bg-accent/5' : 'border-border hover:border-accent/20'
          }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
            e.target.value = '';
          }}
        />
        {uploading ? (
          <p className="text-xs text-foreground-muted">Uploading...</p>
        ) : (
          <>
            <Upload className="w-5 h-5 text-foreground-faint mx-auto mb-1" />
            <p className="text-xs text-foreground-muted">
              Drop file or click to upload
            </p>
            <p className="text-[10px] text-foreground-faint mt-0.5">
              Images up to 5 MB · Videos up to {videoRawMaxLabel(isPremium)}
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="text-[10px] text-red-400 mt-1.5">{error}</p>
      )}

      {processFile && (
        <VideoProcessDialog
          file={processFile}
          currentStepId={stepId}
          isPremium={isPremium}
          onClose={() => setProcessFile(null)}
          onComplete={() => setProcessFile(null)}
        />
      )}

      {cropTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Crop Image</h3>
              <button onClick={() => setCropTarget(null)} className="text-foreground-faint hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center max-h-[60vh] overflow-auto">
              <ReactCrop crop={crop} onChange={(c) => setCrop(c)} aspect={undefined}>
                <img src={cropTarget.url} alt="Crop preview" style={{ maxHeight: '50vh', maxWidth: '100%' }} />
              </ReactCrop>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
              <button
                onClick={() => {
                  onChange(media.map((m) =>
                    m.id === cropTarget.id
                      ? { ...m, crop: undefined }
                      : m
                  ));
                  setCropTarget(null);
                }}
                className="px-3 py-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors"
              >
                Reset
              </button>
              <button
                onClick={() => {
                  const mediaCrop: MediaCrop = {
                    x: crop.x,
                    y: crop.y,
                    width: crop.width,
                    height: crop.height,
                  };
                  onChange(media.map((m) =>
                    m.id === cropTarget.id
                      ? { ...m, crop: mediaCrop }
                      : m
                  ));
                  setCropTarget(null);
                }}
                className="px-4 py-1.5 bg-accent text-black text-xs font-semibold rounded-lg hover:bg-accent-light transition-colors"
              >
                Apply Crop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CODE_LANGUAGES = [
  'javascript', 'typescript', 'python', 'bash', 'html', 'css',
  'json', 'sql', 'swift', 'kotlin', 'java', 'c', 'cpp', 'rust', 'go', 'ruby', 'php', 'other',
];

function CodeBlockSection({
  codeBlock,
  onChange,
}: {
  codeBlock: CodeBlock | undefined;
  onChange: (cb: CodeBlock | undefined) => void;
}) {
  if (!codeBlock) {
    return (
      <div className="pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Code className="w-3.5 h-3.5 text-accent" />
            Code Block
          </label>
          <button
            onClick={() => onChange({ code: '', language: 'javascript' })}
            className="flex items-center gap-1 text-[10px] text-accent hover:text-accent-light transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add Code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 border-t border-border">
      <div className="flex items-center justify-between mb-3">
        <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Code className="w-3.5 h-3.5 text-accent" />
          Code Block
        </label>
        <button
          onClick={() => onChange(undefined)}
          className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          Remove
        </button>
      </div>

      <div className="space-y-2.5 p-3 bg-white/[0.02] border border-border rounded-xl">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-[10px] font-medium text-foreground-faint mb-0.5">
              Language
            </label>
            <select
              value={codeBlock.language}
              onChange={(e) => onChange({ ...codeBlock, language: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-accent/30"
            >
              {CODE_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-medium text-foreground-faint mb-0.5">
              Filename (optional)
            </label>
            <input
              type="text"
              value={codeBlock.filename ?? ''}
              onChange={(e) => onChange({ ...codeBlock, filename: e.target.value || undefined })}
              className="w-full px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-accent/30"
              placeholder="e.g. index.js"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-foreground-faint mb-0.5">
            Code
          </label>
          <textarea
            value={codeBlock.code}
            onChange={(e) => onChange({ ...codeBlock, code: e.target.value })}
            rows={8}
            className="w-full px-2.5 py-2 bg-[#1a1a2e] border border-border rounded-lg text-xs text-green-300 font-mono leading-relaxed focus:outline-none focus:border-accent/30 resize-y"
            placeholder="Enter code..."
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}

const OPERATORS: { value: LogicCondition['operator']; label: string }[] = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '!=' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'gte', label: '>=' },
  { value: 'lte', label: '<=' },
];

function LogicEditor({
  step,
  allSteps,
  variables,
  updateStepLogic,
}: {
  step: { id: string; logic_json: LogicStepPayload | null };
  allSteps: {
    id: string;
    step_type: string;
    content_json: ContentStepPayload | null;
    sort_order: number;
  }[];
  variables: { id: string; name: string; variable_type: string }[];
  updateStepLogic: (id: string, logic: LogicStepPayload) => void;
}) {
  const logic: LogicStepPayload = {
    prompt: '',
    conditions: [],
    default_target_step_id: '',
    default_label: '',
    ...step.logic_json,
  };

  const otherSteps = allSteps.filter((s) => s.id !== step.id);

  const stepLabel = (id: string) => {
    const s = allSteps.find((x) => x.id === id);
    if (!s) return 'Select step...';
    if (s.step_type === 'content')
      return s.content_json?.heading || 'Untitled';
    return `Logic (${s.sort_order + 1})`;
  };

  const update = (patch: Partial<LogicStepPayload>) => {
    updateStepLogic(step.id, { ...logic, ...patch });
  };

  const addCondition = () => {
    update({
      conditions: [
        ...logic.conditions,
        {
          label: '',
          condition: {
            variable: '',
            operator: 'eq',
            value: '',
          },
          target_step_id: otherSteps[0]?.id ?? '',
        },
      ],
    });
  };

  const updateCondition = (idx: number, patch: Partial<LogicCondition>) => {
    const newConds = [...logic.conditions];
    newConds[idx] = {
      ...newConds[idx],
      condition: { ...newConds[idx].condition, ...patch },
    };
    update({ conditions: newConds });
  };

  const updateConditionTarget = (idx: number, targetId: string) => {
    const newConds = [...logic.conditions];
    newConds[idx] = { ...newConds[idx], target_step_id: targetId };
    update({ conditions: newConds });
  };

  const removeCondition = (idx: number) => {
    update({ conditions: logic.conditions.filter((_, i) => i !== idx) });
  };

  return (
    <div className="p-5 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
          <GitBranch className="w-4 h-4 text-green" />
          Logic Step
          <span className="relative group">
            <HelpCircle className="w-3.5 h-3.5 text-foreground-faint cursor-help" />
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2.5 bg-card border border-border rounded-xl text-[10px] text-foreground-muted leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 shadow-lg">
              Logic steps let players choose a path. Set a <strong className="text-foreground">Prompt</strong> (the question shown), add options with <strong className="text-foreground">Labels</strong> (what players see), and assign each to a target step. Leave the default empty to show a Next button instead.
            </span>
          </span>
        </h3>
        <p className="text-xs text-foreground-muted">
          Define conditions to branch the tutorial flow.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground mb-1">
          Prompt Title
        </label>
        <input
          type="text"
          value={logic.prompt ?? ''}
          onChange={(e) => update({ prompt: e.target.value })}
          className="w-full px-2.5 py-2 bg-card border border-border rounded-xl text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-green/30 transition-colors"
          placeholder="e.g. How many players?"
        />
        <p className="text-[10px] text-foreground-faint mt-1">
          Shown to the player when they reach this decision point.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-medium text-foreground">Options</h4>
          <button
            onClick={addCondition}
            className="flex items-center gap-1 text-[10px] text-green hover:text-green/80 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>

        {logic.conditions.length === 0 ? (
          <p className="text-xs text-foreground-faint py-3 text-center">
            No options added yet. Add options for players to choose from.
          </p>
        ) : (
          <div className="space-y-2">
            {logic.conditions.map((cond, i) => (
              <div
                key={i}
                className="p-3 bg-white/[0.02] border border-border rounded-xl space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-foreground-faint uppercase tracking-wider">
                    Rule {i + 1}
                  </span>
                  <button
                    onClick={() => removeCondition(i)}
                    className="text-foreground-faint hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] text-foreground-faint mb-0.5">
                    Option Label
                  </label>
                  <input
                    type="text"
                    value={cond.label ?? ''}
                    onChange={(e) => {
                      const newConds = [...logic.conditions];
                      newConds[i] = { ...newConds[i], label: e.target.value };
                      update({ conditions: newConds });
                    }}
                    className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-green/30"
                    placeholder="e.g. 2 players"
                  />
                </div>

                {variables.length > 0 && (
                  <details className="group">
                    <summary className="text-[10px] text-foreground-faint cursor-pointer hover:text-foreground-muted transition-colors">
                      Advanced: condition rule
                    </summary>
                    <div className="flex gap-1.5 items-end mt-1.5">
                      <div className="flex-1">
                        <label className="block text-[10px] text-foreground-faint mb-0.5">
                          Variable
                        </label>
                        <select
                          value={cond.condition.variable}
                          onChange={(e) =>
                            updateCondition(i, { variable: e.target.value })
                          }
                          className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-green/30"
                        >
                          <option value="">Select...</option>
                          {variables.map((v) => (
                            <option key={v.id} value={v.name}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-14">
                        <label className="block text-[10px] text-foreground-faint mb-0.5">
                          Op
                        </label>
                        <select
                          value={cond.condition.operator}
                          onChange={(e) =>
                            updateCondition(i, {
                              operator: e.target
                                .value as LogicCondition['operator'],
                            })
                          }
                          className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-green/30"
                        >
                          {OPERATORS.map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex-1">
                        <label className="block text-[10px] text-foreground-faint mb-0.5">
                          Value
                        </label>
                        <input
                          type="text"
                          value={String(cond.condition.value)}
                          onChange={(e) =>
                            updateCondition(i, { value: e.target.value })
                          }
                          className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-green/30"
                          placeholder="val"
                        />
                      </div>
                    </div>
                  </details>
                )}

                {variables.length > 0 && (
                  <div className="flex gap-1.5 items-end">
                    <div className="flex-1">
                      <label className="block text-[10px] text-foreground-faint mb-0.5">
                        Sets variable
                      </label>
                      <select
                        value={cond.sets_variable?.name ?? ''}
                        onChange={(e) => {
                          const newConds = [...logic.conditions];
                          const name = e.target.value;
                          newConds[i] = {
                            ...newConds[i],
                            sets_variable: name
                              ? { name, value: cond.sets_variable?.value ?? '' }
                              : undefined,
                          };
                          update({ conditions: newConds });
                        }}
                        className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-green/30"
                      >
                        <option value="">None</option>
                        {variables.map((v) => (
                          <option key={v.id} value={v.name}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {cond.sets_variable?.name && (
                      <div className="flex-1">
                        <label className="block text-[10px] text-foreground-faint mb-0.5">
                          To value
                        </label>
                        <input
                          type="text"
                          value={String(cond.sets_variable?.value ?? '')}
                          onChange={(e) => {
                            const newConds = [...logic.conditions];
                            newConds[i] = {
                              ...newConds[i],
                              sets_variable: {
                                name: cond.sets_variable!.name,
                                value: e.target.value,
                              },
                            };
                            update({ conditions: newConds });
                          }}
                          className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-green/30"
                          placeholder="value"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] text-foreground-faint mb-0.5">
                    Then go to
                  </label>
                  <select
                    value={cond.target_step_id}
                    onChange={(e) =>
                      updateConditionTarget(i, e.target.value)
                    }
                    className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-green/30"
                  >
                    <option value="">Select step...</option>
                    {otherSteps.map((s, j) => (
                      <option key={s.id} value={s.id}>
                        {j + 1}. {stepLabel(s.id)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-border space-y-3">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Default Option Label
          </label>
          <input
            type="text"
            value={logic.default_label || ''}
            onChange={(e) => update({ default_label: e.target.value })}
            className="w-full px-2.5 py-2 bg-card border border-border rounded-xl text-xs text-foreground placeholder:text-foreground-faint focus:outline-none focus:border-green/30 transition-colors"
            placeholder="e.g. Other"
          />
          <p className="text-[10px] text-foreground-faint mt-1">
            Leave empty to show a &quot;Next&quot; button instead of a selectable option.
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Default Target
          </label>
          <select
            value={logic.default_target_step_id}
            onChange={(e) => update({ default_target_step_id: e.target.value })}
            className="w-full px-2.5 py-2 bg-card border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-green/30 transition-colors"
          >
            <option value="">Select step...</option>
            {otherSteps.map((s, j) => (
              <option key={s.id} value={s.id}>
                {j + 1}. {stepLabel(s.id)}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-foreground-faint mt-1">
            Used when no conditions match.
          </p>
        </div>
      </div>
    </div>
  );
}
