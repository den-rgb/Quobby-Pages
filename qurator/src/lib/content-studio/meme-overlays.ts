'use client';

// Canvas-rendered overlays for the browser meme renderer. Using the page's own
// fonts gives identical results to the site without bundling a TTF for ffmpeg.

import { MEME_BAND_HEIGHT, MEME_FEATURES, MEME_HEIGHT, MEME_WIDTH } from './meme-render';

const FONT_STACK = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
const LOGO_URL = '/brand/quobby-logo.png';

function canvas(width: number, height: number): { ctx: CanvasRenderingContext2D; element: HTMLCanvasElement } {
  const element = document.createElement('canvas');
  element.width = width; element.height = height;
  const ctx = element.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  return { ctx, element };
}

function lines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 8): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = '';
  for (const word of words) {
    // A single token wider than the band is hard-split rather than clipped.
    let rest = word;
    while (ctx.measureText(rest).width > maxWidth && out.length < maxLines - 1) {
      let cut = rest.length;
      while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > maxWidth) cut--;
      out.push(rest.slice(0, cut)); rest = rest.slice(cut);
    }
    const candidate = line ? `${line} ${rest}` : rest;
    if (ctx.measureText(candidate).width > maxWidth && line) { out.push(line); line = rest; }
    else line = candidate;
    if (out.length >= maxLines - 1) break;
  }
  if (line) out.push(line);
  const capped = out.slice(0, maxLines);
  if (out.length > maxLines) capped[maxLines - 1] = `${capped[maxLines - 1].slice(0, -1)}…`;
  return capped.length ? capped : [''];
}

async function toPng(element: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => element.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not encode the overlay.')), 'image/png'));
}

let logo: Promise<HTMLImageElement> | null = null;
function loadLogo(): Promise<HTMLImageElement> {
  logo ??= new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => { logo = null; reject(new Error('Could not load the Quobby logo.')); };
    image.src = LOGO_URL;
  });
  return logo;
}

// White band with the hook, drawn above the clip.
export async function renderTopOverlay(hook: string): Promise<Blob> {
  await document.fonts.ready.catch(() => {});
  const { ctx, element } = canvas(MEME_WIDTH, MEME_BAND_HEIGHT);
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, MEME_WIDTH, MEME_BAND_HEIGHT);
  ctx.fillStyle = '#101014'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 78px ${FONT_STACK}`;
  const rows = lines(ctx, hook, 940, 5);
  const lineHeight = 92;
  const top = MEME_BAND_HEIGHT / 2 - (rows.length - 1) * lineHeight / 2;
  rows.forEach((row, index) => ctx.fillText(row, MEME_WIDTH / 2, top + index * lineHeight));
  return toPng(element);
}

// Full-frame end card: rounded logo, wordmark, campaign CTA and the fixed list of
// Quobby features, matching the worker's render.
export async function renderEndCard(cta: string): Promise<Blob> {
  await document.fonts.ready.catch(() => {});
  const { ctx, element } = canvas(MEME_WIDTH, MEME_HEIGHT);
  ctx.fillStyle = '#101014'; ctx.fillRect(0, 0, MEME_WIDTH, MEME_HEIGHT);

  const image = await loadLogo();
  const size = 300;
  const x = (MEME_WIDTH - size) / 2;
  const y = 520;
  ctx.save();
  ctx.beginPath();
  // 22% radius matches the rounded app icon; older Safari lacks roundRect.
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, size, size, size * 0.22);
  else ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.drawImage(image, x, y, size, size);
  ctx.restore();

  const centre = (text: string, font: string, colour: string, at: number, maxWidth: number): number => {
    ctx.font = font; ctx.fillStyle = colour; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const rows = lines(ctx, text, maxWidth);
    rows.forEach((row, index) => ctx.fillText(row, MEME_WIDTH / 2, at + index * parseInt(font.match(/(\d+)px/)?.[1] ?? '56', 10) * 1.25));
    return at + rows.length * parseInt(font.match(/(\d+)px/)?.[1] ?? '56', 10) * 1.25;
  };

  centre('Quobby', `900 112px ${FONT_STACK}`, '#DEB4FF', 1000, 920);
  const afterCta = centre(cta, `800 56px ${FONT_STACK}`, '#FFFFFF', 1110, 920);
  const featureTop = Math.max(afterCta + 60, 1330);
  MEME_FEATURES.forEach((feature, index) => {
    ctx.font = `700 40px ${FONT_STACK}`; ctx.fillStyle = '#C0B8B8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`• ${feature}`, MEME_WIDTH / 2, featureTop + index * 58);
  });
  return toPng(element);
}
