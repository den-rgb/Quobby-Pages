import { isAbsolute, join, parse, resolve } from 'node:path';
import type { RenderRequest, TemplateId } from './types.ts';

interface TemplateManifest {
  version: number;
  durationSeconds: number;
  requiredSlot: string;
  accent: string;
  fontSize: number;
  voiceOver: boolean;
}

export const TEMPLATES: Readonly<Record<TemplateId, Readonly<TemplateManifest>>> = {
  'focus-blocker-problem-solution': { version: 1, durationSeconds: 15, requiredSlot: 'Focus blocker recording', accent: '&H0067E7FF', fontSize: 74, voiceOver: true },
  'flashcards-before-exam': { version: 1, durationSeconds: 15, requiredSlot: 'Flashcard recording', accent: '&H00C6F49C', fontSize: 72, voiceOver: true },
  'study-streak-meme': { version: 1, durationSeconds: 12, requiredSlot: 'Study streak or reward recording', accent: '&H00FFB4DE', fontSize: 78, voiceOver: true },
  // Classic top-text meme over a stock clip, clip audio only, then a CTA end card.
  'meme-classic': { version: 1, durationSeconds: 12, requiredSlot: 'Stock meme clip', accent: '&H00FFB4DE', fontSize: 80, voiceOver: false },
};

export function requireLocalPath(path: unknown): asserts path is string {
  if (typeof path !== 'string' || !isAbsolute(path) || path.includes('\0') || path === parse(path).root) {
    throw new Error('Media and output paths must be absolute local paths.');
  }
}

export function validateRenderRequest(request: RenderRequest): void {
  const spec = request?.spec;
  if (!spec || !Object.hasOwn(TEMPLATES, spec.templateId)) throw new Error('Unsupported template.');
  const template = TEMPLATES[spec.templateId];
  if (spec.templateVersion !== template.version) throw new Error('Unsupported template version.');
  for (const [field, max, label] of [['title', 100, 'Title'], ['hook', 120, 'Hook'], ['cta', 80, 'CTA'], ['voiceText', 500, 'Voice text']] as const) {
    if (field === 'voiceText' && !template.voiceOver) {
      if (spec.voiceText !== '') throw new Error('This template has no voice-over text.');
      continue;
    }
    if (typeof spec[field] !== 'string' || !spec[field].trim() || spec[field].length > max) throw new Error(`${label} must be between 1 and ${max} characters.`);
  }
  if (!Array.isArray(request.assets) || !Array.isArray(spec.sourceAssetIds) || spec.sourceAssetIds.length === 0) throw new Error(`${template.requiredSlot} is required.`);
  const ids = request.assets.map((asset) => asset.id);
  if (new Set(ids).size !== ids.length || new Set(spec.sourceAssetIds).size !== spec.sourceAssetIds.length) throw new Error('Duplicate source asset.');
  if (ids.some((id) => !spec.sourceAssetIds.includes(id))) throw new Error('Source asset is not in the immutable snapshot.');
  const source = request.assets.find((asset) => asset.id === spec.sourceAssetIds[0]);
  if (!source || !['video/mp4', 'video/quicktime'].includes(source.mimeType)) throw new Error(`${template.requiredSlot} is required.`);
  if (spec.sourceAssetIds.some((id) => !ids.includes(id))) throw new Error('A source asset is missing.');
  const extras = request.assets.filter((asset) => asset.id !== source.id);
  if (extras.some((asset) => !['image/jpeg', 'image/png', 'image/webp', 'audio/wav', 'audio/mpeg', 'audio/aac'].includes(asset.mimeType))) throw new Error('Unsupported optional source asset.');
  if (extras.filter((asset) => asset.mimeType.startsWith('audio/')).length > 1) throw new Error('Choose at most one optional background audio file.');
  if (extras.filter((asset) => asset.mimeType.startsWith('image/')).length > 8) throw new Error('Choose at most eight optional images.');
  for (const asset of request.assets) requireLocalPath(asset.path);
  if (template.voiceOver) requireLocalPath(request.voicePath);
  else if (request.voicePath !== null) throw new Error('This template has no voice-over.');
  requireLocalPath(request.outputDirectory);
  const outputs = ['output.mp4', 'captions.ass'].map((name) => resolve(join(request.outputDirectory, name)));
  const inputs = [...request.assets.map((asset) => asset.path), ...(request.voicePath === null ? [] : [request.voicePath])];
  if (inputs.some((path) => outputs.includes(resolve(path)))) throw new Error('Render output must not overlap source or voice files.');
}
