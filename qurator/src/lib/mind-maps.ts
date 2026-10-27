export type MindMapNodeShape = 'Rounded' | 'Pill' | 'Circle';
export type MindMapConnectionStyle = 'Straight' | 'Curved';
export type MindMapTool = 'pen' | 'highlighter' | 'eraser';

export interface MindMapNode {
  id: string;
  text: string;
  detailText: string;
  x: number;
  y: number;
  colorHex: string;
  shapeRaw: MindMapNodeShape;
  width: number;
  height: number;
}

export interface MindMapConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  colorHex: string;
  lineStyleRaw: MindMapConnectionStyle;
}

export interface MindMapImage {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MindMapStrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export interface MindMapStroke {
  points: MindMapStrokePoint[];
  color: string;
  alpha: number;
  width: number;
  tool: MindMapTool;
}

export interface MindMap {
  id: string;
  title: string;
  folderName: string;
  isFavorite: boolean;
  canvasOffsetX: number;
  canvasOffsetY: number;
  canvasZoom: number;
  sourceDeckId: string | null;
  nodes: MindMapNode[];
  connections: MindMapConnection[];
  images: MindMapImage[];
  createdAt: string;
  updatedAt: string;
}

export interface MindMapSnapshot {
  map: MindMap;
  strokes: MindMapStroke[];
  images: string[];
}

export interface MindMapRow {
  id: string;
  title?: string | null;
  folder_name?: string | null;
  is_favorite?: boolean | null;
  canvas_offset_x?: number | null;
  canvas_offset_y?: number | null;
  canvas_zoom?: number | null;
  source_deck_id?: string | null;
  nodes_json?: unknown;
  connections_json?: unknown;
  images_meta_json?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface MindMapDeckCard {
  front_text: string | null;
  back_text: string | null;
  part_of_speech: string | null;
}

const asArray = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

export function createMindMap(id: string = crypto.randomUUID()): MindMap {
  const now = new Date().toISOString();
  return {
    id,
    title: 'Untitled Mind Map',
    folderName: 'All Mind Maps',
    isFavorite: false,
    canvasOffsetX: 0,
    canvasOffsetY: 0,
    canvasZoom: 1,
    sourceDeckId: null,
    nodes: [],
    connections: [],
    images: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createMindMapSnapshot(map: MindMap, strokes: MindMapStroke[], images: string[]): MindMapSnapshot {
  return {
    map: {
      ...map,
      nodes: map.nodes.map((node) => ({ ...node })),
      connections: map.connections.map((connection) => ({ ...connection })),
      images: map.images.map((image) => ({ ...image })),
    },
    strokes: strokes.map((stroke) => ({ ...stroke, points: stroke.points.map((point) => ({ ...point })) })),
    images: [...images],
  };
}

const branchColors = ['80D4FF', 'FF80BF', 'FFD580', 'C080FF', '80FFD5', 'FF8080', '80FFFF', 'FFB380'];

function sizeForText(text: string, detailText = '') {
  const longest = Math.max(text.length, detailText.length * 0.8);
  const width = Math.min(320, Math.max(140, longest * 7 + 40));
  const titleLines = Math.max(1, Math.ceil((text.length * 7) / (width - 32)));
  const detailLines = detailText ? Math.max(1, Math.ceil((detailText.length * 5.6) / (width - 32))) : 0;
  return { width, height: Math.max(56, 32 + titleLines * 18 + (detailLines ? 4 + detailLines * 14 : 0)) };
}

const newNode = (text: string, detailText: string, x: number, y: number, colorHex: string, shapeRaw: MindMapNodeShape = 'Rounded'): MindMapNode => {
  const size = sizeForText(text, detailText);
  return { id: crypto.randomUUID(), text, detailText, x, y, colorHex, shapeRaw, ...size };
};

export function mindMapFromDeck(id: string, deckId: string, deckName: string, cards: MindMapDeckCard[]): MindMap {
  const map = createMindMap(id);
  const central = newNode(deckName, '', 40, 40, 'BFFF80');
  const nodes = [central];
  const connections: MindMapConnection[] = [];
  const groups = new Map<string, MindMapDeckCard[]>();
  const ungrouped: MindMapDeckCard[] = [];

  for (const card of cards) {
    if (card.part_of_speech) groups.set(card.part_of_speech, [...(groups.get(card.part_of_speech) ?? []), card]);
    else ungrouped.push(card);
  }

  let branchY = 40;
  const addRows = (items: MindMapDeckCard[], parentId: string, startX: number, colorFor: (index: number) => string) => {
    for (let rowStart = 0; rowStart < items.length; rowStart += 3) {
      let rowHeight = 0;
      for (const [column, card] of items.slice(rowStart, rowStart + 3).entries()) {
        const node = newNode(card.front_text ?? '', card.back_text ?? '', startX + column * 360, branchY, colorFor(nodes.length));
        nodes.push(node);
        connections.push({ id: crypto.randomUUID(), fromNodeId: parentId, toNodeId: node.id, colorHex: node.colorHex, lineStyleRaw: 'Curved' });
        rowHeight = Math.max(rowHeight, node.height);
      }
      branchY += rowHeight + 32;
    }
    branchY += 64;
  };

  [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([group, groupCards], index) => {
    const color = branchColors[index % branchColors.length]!;
    const category = newNode(group, '', central.x + central.width + 40, branchY, color, 'Pill');
    nodes.push(category);
    connections.push({ id: crypto.randomUUID(), fromNodeId: central.id, toNodeId: category.id, colorHex: color, lineStyleRaw: 'Curved' });
    addRows(groupCards, category.id, category.x + category.width + 40, () => color);
  });

  if (ungrouped.length) {
    addRows(ungrouped, central.id, central.x + central.width + 40, (index) => branchColors[(groups.size + index) % branchColors.length]!);
  }

  return { ...map, title: deckName, sourceDeckId: deckId, nodes, connections };
}

export function mindMapFromRow(row: MindMapRow): MindMap {
  const fallback = createMindMap(row.id);
  return {
    ...fallback,
    title: row.title ?? fallback.title,
    folderName: row.folder_name ?? fallback.folderName,
    isFavorite: row.is_favorite ?? false,
    canvasOffsetX: row.canvas_offset_x ?? 0,
    canvasOffsetY: row.canvas_offset_y ?? 0,
    canvasZoom: row.canvas_zoom ?? 1,
    sourceDeckId: row.source_deck_id ?? null,
    nodes: asArray<MindMapNode>(row.nodes_json),
    connections: asArray<MindMapConnection>(row.connections_json),
    images: asArray<MindMapImage>(row.images_meta_json),
    createdAt: row.created_at ?? fallback.createdAt,
    updatedAt: row.updated_at ?? fallback.updatedAt,
  };
}

export function mindMapUpsert(map: MindMap, userId: string) {
  const storage = mindMapStoragePaths(userId, map.id);
  return {
    id: map.id,
    user_id: userId,
    title: map.title.trim() || 'Untitled Mind Map',
    folder_name: map.folderName.trim() || 'All Mind Maps',
    is_favorite: map.isFavorite,
    canvas_offset_x: map.canvasOffsetX,
    canvas_offset_y: map.canvasOffsetY,
    canvas_zoom: map.canvasZoom,
    source_deck_id: map.sourceDeckId,
    nodes_json: map.nodes,
    connections_json: map.connections,
    images_meta_json: map.images,
    drawing_storage_path: null,
    image_data_storage_path: storage.images,
    created_at: map.createdAt,
    updated_at: map.updatedAt,
  };
}

export function portableDrawingJson(strokes: MindMapStroke[]): string {
  return JSON.stringify({ version: 1, platform: 'web', strokes });
}

export function parsePortableDrawing(value: string): MindMapStroke[] {
  try {
    const decoded = JSON.parse(value) as { strokes?: unknown };
    return asArray<MindMapStroke>(decoded.strokes);
  } catch {
    return [];
  }
}

function pointAlong(from: MindMapStrokePoint, to: MindMapStrokePoint, progress: number): MindMapStrokePoint {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    pressure: from.pressure + (to.pressure - from.pressure) * progress,
  };
}

function pointsMatch(first: MindMapStrokePoint, second: MindMapStrokePoint): boolean {
  return Math.abs(first.x - second.x) < 0.001 && Math.abs(first.y - second.y) < 0.001;
}

function outsideIntervals(from: MindMapStrokePoint, to: MindMapStrokePoint, center: Pick<MindMapStrokePoint, 'x' | 'y'>, radius: number): Array<[number, number]> {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const fx = from.x - center.x;
  const fy = from.y - center.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(fx, fy) > radius ? [[0, 1]] : [];

  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const discriminant = b * b - 4 * lengthSquared * c;
  if (discriminant <= 0) return c >= 0 ? [[0, 1]] : [];

  const root = Math.sqrt(discriminant);
  const boundaries = [0, (-b - root) / (2 * lengthSquared), (-b + root) / (2 * lengthSquared), 1]
    .filter((value) => value >= 0 && value <= 1)
    .sort((first, second) => first - second);
  const intervals: Array<[number, number]> = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index]!;
    const end = boundaries[index + 1]!;
    const midpoint = (start + end) / 2;
    const x = from.x + dx * midpoint - center.x;
    const y = from.y + dy * midpoint - center.y;
    if (x * x + y * y > radius * radius) intervals.push([start, end]);
  }
  return intervals;
}

export function partiallyEraseStrokes(strokes: MindMapStroke[], center: Pick<MindMapStrokePoint, 'x' | 'y'>, radius: number): MindMapStroke[] {
  if (radius <= 0) return strokes;
  return strokes.flatMap((stroke) => {
    if (stroke.points.length < 2) return [stroke];
    const fragments: MindMapStroke[] = [];
    let fragment: MindMapStrokePoint[] = [];
    const finishFragment = () => {
      if (fragment.length > 1) fragments.push({ ...stroke, points: fragment });
      fragment = [];
    };

    for (let index = 1; index < stroke.points.length; index += 1) {
      const from = stroke.points[index - 1]!;
      const to = stroke.points[index]!;
      const intervals = outsideIntervals(from, to, center, radius);
      if (intervals.length === 0) {
        finishFragment();
        continue;
      }
      for (const [start, end] of intervals) {
        const segmentStart = pointAlong(from, to, start);
        const segmentEnd = pointAlong(from, to, end);
        if (fragment.length > 0 && pointsMatch(fragment[fragment.length - 1]!, segmentStart)) fragment.push(segmentEnd);
        else {
          finishFragment();
          fragment = [segmentStart, segmentEnd];
        }
      }
    }
    finishFragment();
    if (fragments.length === 1 && fragments[0]!.points.length === stroke.points.length && fragments[0]!.points.every((point, index) => {
      const original = stroke.points[index]!;
      return pointsMatch(point, original) && Math.abs(point.pressure - original.pressure) < 0.001;
    })) return [stroke];
    return fragments;
  });
}

export function mindMapStoragePaths(userId: string, mapId: string) {
  const base = `${userId}/mind-maps/${mapId}`;
  return {
    drawing: `${base}/drawing.strokes.json`,
    images: `${base}/images.data`,
  };
}
