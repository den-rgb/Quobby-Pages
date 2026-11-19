'use client';

// Caption overlays for the voice-over templates: three full-frame transparent
// PNGs (hook, title, CTA) enabled by time in the ffmpeg graph.

const FONT_STACK = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
const WIDTH = 1080;
const HEIGHT = 1920;

export interface CaptionInput { hook: string; title: string; cta: string; accent: string; fontSize: number }

function canvas(): { ctx: CanvasRenderingContext2D; element: HTMLCanvasElement } {
  const element = document.createElement('canvas');
  element.width = WIDTH; element.height = HEIGHT;
  const ctx = element.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  return { ctx, element };
}

function lines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) { out.push(line); line = word; }
    else line = candidate;
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}

async function toPng(element: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => element.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not encode a caption.')), 'image/png'));
}

// ASS BorderStyle 3 look: text drawn on a translucent dark box.
function block(ctx: CanvasRenderingContext2D, rows: string[], font: string, colour: string, top: number): number {
  const size = parseInt(font.match(/(\d+)px/)?.[1] ?? '64', 10);
  const lineHeight = Math.round(size * 1.35);
  const height = rows.length * lineHeight;
  let widest = 0;
  ctx.font = font;
  for (const row of rows) widest = Math.max(widest, ctx.measureText(row).width);
  const pad = Math.round(size * 0.35);
  const boxWidth = Math.min(WIDTH - 80, widest + pad * 2);
  ctx.fillStyle = 'rgba(16,16,20,0.78)';
  ctx.beginPath();
  const radius = Math.round(size * 0.2);
  if (typeof ctx.roundRect === 'function') ctx.roundRect((WIDTH - boxWidth) / 2, top - pad, boxWidth, height + pad * 2, radius);
  else ctx.rect((WIDTH - boxWidth) / 2, top - pad, boxWidth, height + pad * 2);
  ctx.fill();
  ctx.font = font; ctx.fillStyle = colour; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  rows.forEach((row, index) => ctx.fillText(row, WIDTH / 2, top + lineHeight * index + lineHeight / 2));
  return height;
}

async function caption(rows: string[], font: string, colour: string, top: number): Promise<Blob> {
  const { ctx, element } = canvas();
  block(ctx, rows, font, colour, top);
  return toPng(element);
}

// Hook at the top, title and CTA at the bottom, matching the worker's ASS styles.
export async function renderCaptionOverlays(input: CaptionInput): Promise<[Blob, Blob, Blob]> {
  await document.fonts.ready.catch(() => {});
  const measure = canvas();
  const hookFont = `900 ${input.fontSize}px ${FONT_STACK}`;
  const titleFont = `800 64px ${FONT_STACK}`;
  const ctaFont = `800 68px ${FONT_STACK}`;
  measure.ctx.font = hookFont;
  const hookRows = lines(measure.ctx, input.hook, 920);
  measure.ctx.font = titleFont;
  const titleRows = lines(measure.ctx, input.title, 920);
  measure.ctx.font = ctaFont;
  const ctaRows = lines(measure.ctx, input.cta, 920);
  const bottom = HEIGHT - 300;
  const titleTop = bottom - titleRows.length * Math.round(64 * 1.35);
  const ctaTop = bottom - ctaRows.length * Math.round(68 * 1.35);
  return [
    await caption(hookRows, hookFont, '#FFFFFF', 200),
    await caption(titleRows, titleFont, '#FFFFFF', titleTop),
    await caption(ctaRows, ctaFont, input.accent, ctaTop),
  ];
}
