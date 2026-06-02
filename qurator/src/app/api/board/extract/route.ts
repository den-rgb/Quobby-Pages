import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import type { BoardCell, BoardPiece, CanvasElement, CanvasShape } from '@/lib/types';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, Output } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const CANVAS_W = 800;
const CANVAS_H = 600;
const MARGIN = 20;
const SAFE_W = CANVAS_W - MARGIN * 2;
const SAFE_H = CANVAS_H - MARGIN * 2;
const MAX_BASE64_BYTES = 7 * 1024 * 1024;

const VALID_SHAPES: CanvasShape[] = [
  'rectangle', 'circle', 'triangle', 'diamond', 'star', 'hexagon',
  'meeple', 'dice', 'card', 'token', 'pawn', 'cube', 'flag', 'crown',
];

const extractedElementSchema = z.object({
  elements: z.array(
    z.object({
      type: z.enum(['shape', 'text']),
      x: z.number(),
      y: z.number(),
      width: z.number().min(10),
      height: z.number().min(10),
      rotation: z.number().default(0),
      opacity: z.number().min(0).max(1).default(1),
      label: z.string().optional(),
      shape: z.enum(VALID_SHAPES as [string, ...string[]]).optional(),
      fill: z.string().optional(),
      stroke: z.string().optional(),
      strokeWidth: z.number().optional(),
      text: z.string().optional(),
      fontSize: z.number().optional(),
      fontWeight: z.number().optional(),
      textColor: z.string().optional(),
      textAlign: z.enum(['left', 'center', 'right']).optional(),
    })
  ),
  title: z.string().optional(),
  suggestedBoardType: z.enum(['hex_grid', 'rect_grid', 'row_layout', 'custom']).optional(),
  gridDimensions: z.object({
    rows: z.number(),
    cols: z.number(),
  }).optional(),
  gridCells: z.array(
    z.object({
      label: z.string().optional(),
      color: z.string(),
      icon: z.string().optional(),
      tooltip: z.string().optional(),
    })
  ).optional(),
  gridPieces: z.array(
    z.object({
      cellIndex: z.number(),
      label: z.string().optional(),
      color: z.string(),
      shape: z.enum(['circle', 'triangle', 'square', 'diamond', 'star']),
      tooltip: z.string().optional(),
    })
  ).optional(),
});

const SYSTEM_PROMPT = `You are an expert board game diagram creator. You analyze top-down photos of board games and produce clean, well-proportioned schematic diagrams.

CANVAS: ${SAFE_W}×${SAFE_H} usable area (offset ${MARGIN},${MARGIN} from origin). Place all elements within x:${MARGIN}-${CANVAS_W - MARGIN}, y:${MARGIN}-${CANVAS_H - MARGIN}.

CRITICAL RULES — FOLLOW EXACTLY:

1. FOCUS ON THE BOARD ONLY. Ignore the box, rulebooks, reference cards, loose components, and anything NOT printed on the board itself. Only include elements that are part of the board's surface.

2. LAYOUT AND PROPORTIONS:
   - The board diagram should fill most of the canvas (at least 70% of the area).
   - Start with a large background rectangle for the board surface.
   - Position elements proportionally to where they appear on the actual board.
   - Leave a ${MARGIN}px margin on all sides — no element should touch the canvas edge.

3. ELEMENT SIZING:
   - Board background: 700-760 wide, 500-560 tall.
   - Location markers (cities, spaces, nodes): small circles, 12-20px diameter.
   - Zone/region backgrounds: rectangles sized to cover the zone area.
   - Text labels: use type:"text" with fontSize 8-12 for location names, 14-18 for section titles.
   - Tracks (score, turn, etc.): thin rectangles, 15-25px tall.
   - Card slots on the board: rectangles 40-60px wide, 50-75px tall.
   - Game pieces ON the board: use appropriate game shapes (meeple, pawn, cube, token), 15-30px.

4. COLORS:
   - Use rgba() format. Match the board's actual color regions.
   - Use distinct colors for different zones (e.g. Pandemic: blue, yellow, black, red disease zones).
   - Board background: use the dominant board color at ~0.8 opacity.
   - Location markers: solid colors at 0.7-0.9 opacity matching their zone.
   - Text: white or light colored at 0.8-0.9 opacity for readability.

5. LABELING:
   - Add text labels for every named location, zone, or section visible on the board.
   - Set the "label" field on shapes to describe what they represent (for hover tooltips).
   - Major sections (e.g. "Outbreaks Track", "Score Track") get text elements with fontSize 12-14.
   - Individual spaces/cities get smaller text labels, fontSize 8-10.

6. STRUCTURE:
   - Layer order matters: board background first (lowest zIndex), then zones, then spaces/nodes, then pieces on top.
   - For map-style boards (Pandemic, Ticket to Ride): use circles for cities and label each one.
   - For track-based sections: use a thin rectangle for the track with small circles/rectangles for spaces.
   - For card areas printed on the board: use card-sized rectangles with labels.

7. CONNECTIONS:
   - For boards with connected locations (network maps), use thin rectangles (width: 2-3px, rotated) to represent paths between adjacent cities. Or approximate route clusters with rectangles.

AVAILABLE SHAPES: rectangle, circle, triangle, diamond, star, hexagon, meeple, pawn, dice, card, token, cube, flag, crown.

TARGET: 30-80 elements. Prioritize board layout accuracy over element count.

GRID DETECTION:
If the board is grid-based, also provide:
- suggestedBoardType: "hex_grid" | "rect_grid" | "row_layout" | "custom"
- gridDimensions: { rows, cols }
- gridCells: ordered array with color, label, icon, tooltip
- gridPieces: pieces on cells with cellIndex, color, shape, tooltip

Always provide canvas elements even if grid data is also provided.`;

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 5, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { imageBase64, prompt: userHint } = body as {
      imageBase64?: string;
      prompt?: string;
    };

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'Provide imageBase64' },
        { status: 400 },
      );
    }

    if (imageBase64.length > MAX_BASE64_BYTES) {
      return NextResponse.json(
        { error: 'Image too large (max 5 MB)' },
        { status: 400 },
      );
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 },
      );
    }

    const google = createGoogleGenerativeAI({ apiKey });

    const userPrompt = userHint
      ? `Analyze this board game photo and create a simplified board diagram. Focus ONLY on the board itself. Additional context: ${userHint}`
      : 'Analyze this board game photo and create a clean, well-proportioned schematic of the board. Focus ONLY on the board surface — ignore the box, loose cards, and table.';

    const { output } = await generateText({
      model: google('gemini-2.5-flash'),
      output: Output.object({ schema: extractedElementSchema }),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image' as const, image: imageBase64 },
            { type: 'text', text: userPrompt },
          ],
        },
      ],
    });

    if (!output) {
      return NextResponse.json(
        { error: 'Failed to extract board elements from image' },
        { status: 422 },
      );
    }

    // Scale all elements to fit within the safe canvas area
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of output.elements) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }
    const rawW = maxX - minX;
    const rawH = maxY - minY;
    const needsScale = rawW > SAFE_W || rawH > SAFE_H || rawW < 1 || rawH < 1;
    const scaleX = rawW > 0 ? SAFE_W / rawW : 1;
    const scaleY = rawH > 0 ? SAFE_H / rawH : 1;
    const scale = needsScale ? Math.min(scaleX, scaleY, 1.5) : 1;

    let zIdx = 0;
    const canvasElements: CanvasElement[] = output.elements.map((el) => {
      const sx = needsScale ? MARGIN + (el.x - minX) * scale : el.x;
      const sy = needsScale ? MARGIN + (el.y - minY) * scale : el.y;
      const sw = el.width * (needsScale ? scale : 1);
      const sh = el.height * (needsScale ? scale : 1);

      return {
        id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: el.type as CanvasElement['type'],
        x: Math.max(0, Math.min(sx, CANVAS_W - sw)),
        y: Math.max(0, Math.min(sy, CANVAS_H - sh)),
        width: Math.max(10, Math.min(sw, CANVAS_W)),
        height: Math.max(10, Math.min(sh, CANVAS_H)),
        rotation: el.rotation ?? 0,
        zIndex: zIdx++,
        opacity: el.opacity ?? 1,
        label: el.label,
        shape: el.shape as CanvasShape | undefined,
        fill: el.fill ?? 'rgba(161, 48, 107, 0.5)',
        stroke: el.stroke ?? 'rgba(255, 255, 255, 0.3)',
        strokeWidth: el.strokeWidth ?? 2,
        text: el.text,
        fontSize: el.fontSize ? el.fontSize * (needsScale ? scale : 1) : undefined,
        fontWeight: el.fontWeight,
        textColor: el.textColor,
        textAlign: el.textAlign as CanvasElement['textAlign'],
      };
    });

    const gridCells: BoardCell[] | undefined = output.gridCells?.map((c, i) => ({
      id: `cell-${Date.now()}-${i}`,
      label: c.label,
      color: c.color,
      icon: c.icon,
      tooltip: c.tooltip,
    }));

    const gridPieces: BoardPiece[] | undefined = output.gridPieces
      ?.filter((p) => gridCells && p.cellIndex >= 0 && p.cellIndex < gridCells.length)
      .map((p, i) => ({
        id: `piece-${Date.now()}-${i}`,
        cell_id: gridCells![p.cellIndex].id,
        label: p.label,
        color: p.color,
        shape: p.shape,
        tooltip: p.tooltip,
      }));

    return NextResponse.json({
      elements: canvasElements,
      title: output.title,
      suggestedBoardType: output.suggestedBoardType,
      gridDimensions: output.gridDimensions,
      gridCells: gridCells?.length ? gridCells : undefined,
      gridPieces: gridPieces?.length ? gridPieces : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Board extraction failed:', msg);
    const isRateLimit = msg.includes('429') || msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('quota');
    return NextResponse.json(
      { error: isRateLimit ? 'AI rate limit exceeded — try again in a minute' : `Board extraction failed: ${msg.slice(0, 120)}` },
      { status: isRateLimit ? 429 : 500 },
    );
  }
}
