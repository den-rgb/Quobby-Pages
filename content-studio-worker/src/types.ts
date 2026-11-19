export type TemplateId = 'focus-blocker-problem-solution' | 'flashcards-before-exam' | 'study-streak-meme' | 'meme-classic';

// This immutable JSON contract mirrors Qurator's RenderSpec without coupling packages.
export interface RenderSpec {
  templateId: TemplateId;
  templateVersion: number;
  title: string;
  hook: string;
  cta: string;
  voiceText: string;
  sourceAssetIds: string[];
}

export interface RenderAsset {
  id: string;
  path: string;
  mimeType: string;
}

export interface RenderRequest {
  spec: RenderSpec;
  assets: RenderAsset[];
  outputDirectory: string;
  // Null for templates without a voice-over (meme-classic uses the clip's audio).
  voicePath: string | null;
}

export interface RenderResult {
  outputPath: string;
  durationMs: number;
}

export interface VoiceRequest {
  text: string;
  outputDirectory: string;
}

export type ProcessRunner = (command: string, args: string[]) => Promise<void>;
export type ProcessCapture = (command: string, args: string[]) => Promise<string>;
