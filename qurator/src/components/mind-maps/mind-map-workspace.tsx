'use client';

import { PremiumUpsell } from '@/components/premium-upsell';
import { useAuth } from '@/lib/auth';
import {
  createMindMap,
  createMindMapSnapshot,
  mindMapFromDeck,
  mindMapFromRow,
  partiallyEraseStrokes,
  type MindMap,
  type MindMapConnection,
  type MindMapDeckCard,
  type MindMapNode,
  type MindMapSnapshot,
  type MindMapStroke,
} from '@/lib/mind-maps';
import {
  ArrowLeft,
  Circle,
  Folder,
  FolderOpen,
  Highlighter,
  Link2,
  Loader2,
  Maximize2,
  MousePointer2,
  Pencil,
  Plus,
  RefreshCw,
  Redo2,
  Save,
  Scissors,
  Search,
  Sparkles,
  Star,
  Trash2,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

const nodeColors = ['BFFF80', '80D4FF', 'FF80BF', 'FFD580', 'C080FF', '80FFD5', 'FF8080', '80FFFF', 'FFB380', 'B3FF80'];
const drawingColors = ['#FFFFFF', '#000000', '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#5856D6', '#FF2D55'];

type MapRow = Parameters<typeof mindMapFromRow>[0];
type Interaction =
  | { type: 'pan'; lastX: number; lastY: number }
  | { type: 'node'; id: string; lastX: number; lastY: number }
  | { type: 'image'; id: string; lastX: number; lastY: number }
  | { type: 'draw' }
  | { type: 'erase'; mode: 'stroke' | 'partial' }
  | null;

interface Deck {
  id: string;
  name: string;
  description: string | null;
}

function hex(hex: string) {
  return hex.startsWith('#') ? hex : `#${hex}`;
}

function downloadImageData(base64: string) {
  return `data:image/jpeg;base64,${base64}`;
}

function svgPath(points: MindMapStroke['points']) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function cubicPath(from: MindMapNode, to: MindMapNode) {
  const startX = from.x + from.width;
  const startY = from.y + from.height / 2;
  const endX = to.x;
  const endY = to.y + to.height / 2;
  const curve = Math.max(60, Math.abs(endX - startX) * 0.45);
  return `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;
}

function mapImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The image could not be read.'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const source = new Image();
      source.onerror = () => reject(new Error('The image could not be processed.'));
      source.onload = () => {
        const ratio = Math.min(1, 1600 / Math.max(source.width, source.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(source.width * ratio));
        canvas.height = Math.max(1, Math.round(source.height * ratio));
        canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82).split(',')[1] ?? '');
      };
      source.src = result;
    };
    reader.readAsDataURL(file);
  });
}

export function MindMapWorkspace({ mapId }: { mapId?: string }) {
  const { user, loading: authLoading, hasBillingPremium: isPremium, signIn } = useAuth();
  const router = useRouter();
  const [maps, setMaps] = useState<MindMap[]>([]);
  const [map, setMap] = useState<MindMap | null>(null);
  const [strokes, setStrokes] = useState<MindMapStroke[]>([]);
  const [imageData, setImageData] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState('All Mind Maps');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showDecks, setShowDecks] = useState(false);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [tool, setTool] = useState<'select' | 'pen' | 'highlighter' | 'eraser' | 'partialEraser'>('select');
  const [drawingColor, setDrawingColor] = useState('#FFFFFF');
  const [drawingWidth, setDrawingWidth] = useState(3);
  const [offset, setOffset] = useState({ x: 80, y: 80 });
  const [zoom, setZoom] = useState(1);
  const [interaction, setInteraction] = useState<Interaction>(null);
  const [draftStroke, setDraftStroke] = useState<MindMapStroke | null>(null);
  const canvasRef = useRef<SVGSVGElement>(null);
  const imagePickerRef = useRef<HTMLInputElement>(null);
  const autosaveRef = useRef<number | null>(null);
  const mapRef = useRef<MindMap | null>(null);
  const strokesRef = useRef<MindMapStroke[]>([]);
  const imageDataRef = useRef<string[]>([]);
  const draftStrokeRef = useRef<MindMapStroke | null>(null);
  const viewportRef = useRef({ x: 80, y: 80, zoom: 1 });
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingSaveCountRef = useRef(0);
  const undoStackRef = useRef<MindMapSnapshot[]>([]);
  const redoStackRef = useRef<MindMapSnapshot[]>([]);
  const gestureSnapshotRef = useRef<MindMapSnapshot | null>(null);
  const gestureRecordedRef = useRef(false);
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  const syncHistoryState = useCallback(() => {
    setHistoryState({ canUndo: undoStackRef.current.length > 0, canRedo: redoStackRef.current.length > 0 });
  }, []);

  const resetHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    syncHistoryState();
  }, [syncHistoryState]);

  const pushHistory = useCallback((snapshot: MindMapSnapshot) => {
    undoStackRef.current = [...undoStackRef.current.slice(-49), snapshot];
    redoStackRef.current = [];
    syncHistoryState();
  }, [syncHistoryState]);

  const recordHistory = useCallback(() => {
    const current = mapRef.current;
    if (!current) return;
    pushHistory(createMindMapSnapshot(current, strokesRef.current, imageDataRef.current));
  }, [pushHistory]);

  const beginHistoryGesture = useCallback(() => {
    const current = mapRef.current;
    gestureSnapshotRef.current = current ? createMindMapSnapshot(current, strokesRef.current, imageDataRef.current) : null;
    gestureRecordedRef.current = false;
  }, []);

  const commitHistoryGesture = useCallback(() => {
    if (gestureSnapshotRef.current && !gestureRecordedRef.current) {
      pushHistory(gestureSnapshotRef.current);
      gestureRecordedRef.current = true;
    }
  }, [pushHistory]);

  const endHistoryGesture = useCallback(() => {
    gestureSnapshotRef.current = null;
    gestureRecordedRef.current = false;
  }, []);

  const fetchMaps = useCallback(async () => {
    if (!user || !isPremium) return;
    setLoading(true);
    try {
      const response = await fetch('/api/mind-maps', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Could not load your mind maps.');
      const mapRows = (Array.isArray(payload.maps) ? payload.maps : []) as MapRow[];
      setError(null);
      setMaps(mapRows.map((row) => mindMapFromRow(row)));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Could not load your mind maps.');
    } finally {
      setLoading(false);
    }
  }, [isPremium, user]);

  useEffect(() => {
    if (authLoading || !user || !isPremium) return;
    const timer = window.setTimeout(() => { void fetchMaps(); }, 0);
    return () => window.clearTimeout(timer);
  }, [authLoading, fetchMaps, isPremium, user]);

  useEffect(() => {
    if (!mapId || !user || !isPremium) return;
    let active = true;
    const loadMap = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/mind-maps/${mapId}`, { cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.map) throw new Error(payload.error ?? 'Mind map not found.');
        if (!active) return;
        const loaded = mindMapFromRow(payload.map as MapRow);
        const loadedStrokes = Array.isArray(payload.strokes) ? payload.strokes as MindMapStroke[] : [];
        const imageValues: unknown[] = Array.isArray(payload.images) ? payload.images : [];
        const loadedImages = imageValues.filter((value): value is string => typeof value === 'string');
        mapRef.current = loaded;
        strokesRef.current = loadedStrokes;
        imageDataRef.current = loadedImages;
        resetHistory();
        setError(null);
        setMap(loaded);
        setStrokes(loadedStrokes);
        setImageData(loadedImages);
        const viewport = { x: loaded.canvasOffsetX || 80, y: loaded.canvasOffsetY || 80, zoom: loaded.canvasZoom || 1 };
        viewportRef.current = viewport;
        setOffset({ x: viewport.x, y: viewport.y });
        setZoom(viewport.zoom);
      } catch (fetchError) {
        if (active) setError(fetchError instanceof Error ? fetchError.message : 'Mind map not found.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadMap();
    return () => { active = false; };
  }, [isPremium, mapId, resetHistory, user]);

  const saveMap = useCallback((nextMap: MindMap, nextStrokes = strokesRef.current, nextImages = imageDataRef.current): Promise<boolean> => {
    if (!user || !isPremium) {
      setShowUpsell(true);
      return Promise.resolve(false);
    }
    const viewport = viewportRef.current;
    const updated = { ...nextMap, canvasOffsetX: viewport.x, canvasOffsetY: viewport.y, canvasZoom: viewport.zoom, updatedAt: new Date().toISOString() };
    pendingSaveCountRef.current += 1;
    setSaving(true);
    setError(null);
    const write = async () => {
      try {
        const response = await fetch('/api/mind-maps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ map: updated, strokes: nextStrokes, images: nextImages }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? 'Could not save this mind map.');
        setMaps((existing) => {
          const latest = mapRef.current?.id === updated.id ? mapRef.current : updated;
          return [latest, ...existing.filter((item) => item.id !== updated.id)];
        });
        return true;
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Could not save this mind map.');
        return false;
      } finally {
        pendingSaveCountRef.current -= 1;
        if (pendingSaveCountRef.current === 0) setSaving(false);
      }
    };
    const queued = saveQueueRef.current.then(write, write);
    saveQueueRef.current = queued.then(() => undefined, () => undefined);
    return queued;
  }, [isPremium, user]);

  const scheduleSave = useCallback((nextMap: MindMap, nextStrokes = strokesRef.current, nextImages = imageDataRef.current) => {
    if (autosaveRef.current) {
      window.clearTimeout(autosaveRef.current);
      autosaveRef.current = null;
    }
    autosaveRef.current = window.setTimeout(() => { void saveMap(nextMap, nextStrokes, nextImages); }, 700);
  }, [saveMap]);

  const restoreSnapshot = useCallback((snapshot: MindMapSnapshot) => {
    if (autosaveRef.current) {
      window.clearTimeout(autosaveRef.current);
      autosaveRef.current = null;
    }
    mapRef.current = snapshot.map;
    strokesRef.current = snapshot.strokes;
    imageDataRef.current = snapshot.images;
    setMap(snapshot.map);
    setStrokes(snapshot.strokes);
    setImageData(snapshot.images);
    void saveMap(snapshot.map, snapshot.strokes, snapshot.images);
  }, [saveMap]);

  const undo = useCallback(() => {
    const current = mapRef.current;
    const previous = undoStackRef.current.pop();
    if (!current || !previous) return;
    redoStackRef.current.push(createMindMapSnapshot(current, strokesRef.current, imageDataRef.current));
    syncHistoryState();
    restoreSnapshot(previous);
  }, [restoreSnapshot, syncHistoryState]);

  const redo = useCallback(() => {
    const current = mapRef.current;
    const next = redoStackRef.current.pop();
    if (!current || !next) return;
    undoStackRef.current.push(createMindMapSnapshot(current, strokesRef.current, imageDataRef.current));
    syncHistoryState();
    restoreSnapshot(next);
  }, [restoreSnapshot, syncHistoryState]);

  const createBlank = async () => {
    if (!isPremium) { setShowUpsell(true); return; }
    const created = createMindMap();
    mapRef.current = created;
    strokesRef.current = [];
    imageDataRef.current = [];
    setMap(created);
    setStrokes([]);
    setImageData([]);
    if (await saveMap(created, [], [])) router.push(`/mind-maps/${created.id}`);
  };

  const openDeckPicker = async () => {
    if (!isPremium) { setShowUpsell(true); return; }
    try {
      const response = await fetch('/api/mind-maps/decks', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Could not load your flashcard decks.');
      setDecks(Array.isArray(payload.decks) ? payload.decks as Deck[] : []);
      setShowDecks(true);
    } catch (deckError) {
      setError(deckError instanceof Error ? deckError.message : 'Could not load your flashcard decks.');
    }
  };

  const createFromDeck = async (deck: Deck) => {
    try {
      const response = await fetch(`/api/mind-maps/decks/${deck.id}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.deck) throw new Error(payload.error ?? 'Could not load this flashcard deck.');
      const created = mindMapFromDeck(crypto.randomUUID(), deck.id, payload.deck.name, (payload.cards ?? []) as MindMapDeckCard[]);
      setShowDecks(false);
      mapRef.current = created;
      strokesRef.current = [];
      imageDataRef.current = [];
      setMap(created);
      setStrokes([]);
      setImageData([]);
      if (await saveMap(created, [], [])) router.push(`/mind-maps/${created.id}`);
    } catch (cardError) {
      setError(cardError instanceof Error ? cardError.message : 'Could not load this flashcard deck.');
    }
  };

  const updateFromDeck = async () => {
    if (!map?.sourceDeckId || !window.confirm('This will regenerate the mind map from the current flashcards in the deck. Any manual edits will be lost.')) return;
    try {
      const response = await fetch(`/api/mind-maps/decks/${map.sourceDeckId}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.deck) throw new Error(payload.error ?? 'The source deck could not be found.');
      recordHistory();
      const generated = mindMapFromDeck(map.id, payload.deck.id, payload.deck.name, (payload.cards ?? []) as MindMapDeckCard[]);
      const next = { ...generated, folderName: map.folderName, isFavorite: map.isFavorite, createdAt: map.createdAt };
      mapRef.current = next;
      strokesRef.current = [];
      imageDataRef.current = [];
      setMap(next);
      setStrokes([]);
      setImageData([]);
      await saveMap(next, [], []);
    } catch (deckError) {
      setError(deckError instanceof Error ? deckError.message : 'The source deck could not be found.');
    }
  };

  const removeMap = async (target: MindMap) => {
    if (!window.confirm(`Delete “${target.title}”? This cannot be undone.`)) return;
    try {
      const response = await fetch(`/api/mind-maps/${target.id}`, { method: 'DELETE' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Could not delete this mind map.');
      setError(null);
      setMaps((items) => items.filter((item) => item.id !== target.id));
      router.push('/mind-maps');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete this mind map.');
    }
  };

  const folders = useMemo(() => ['All Mind Maps', ...Array.from(new Set(maps.map((item) => item.folderName).filter(Boolean))).filter((item) => item !== 'All Mind Maps').sort()], [maps]);
  const visibleMaps = useMemo(() => maps.filter((item) =>
    (folder === 'All Mind Maps' || item.folderName === folder) &&
    (!favoritesOnly || item.isFavorite) &&
    item.title.toLowerCase().includes(query.toLowerCase()),
  ), [favoritesOnly, folder, maps, query]);

  const coordinate = (event: PointerEvent<SVGSVGElement | SVGRectElement | SVGGElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const viewport = viewportRef.current;
    return { x: (event.clientX - rect.left - viewport.x) / viewport.zoom, y: (event.clientY - rect.top - viewport.y) / viewport.zoom };
  };

  const updateMap = (update: (current: MindMap) => MindMap) => {
    const current = mapRef.current;
    if (!current) return;
    recordHistory();
    const next = update(current);
    mapRef.current = next;
    setMap(next);
    scheduleSave(next);
  };

  const addNode = () => {
    const current = mapRef.current;
    if (!current) return;
    recordHistory();
    const viewport = viewportRef.current;
    const node: MindMapNode = { id: crypto.randomUUID(), text: '', detailText: '', x: 420 - viewport.x / viewport.zoom, y: 280 - viewport.y / viewport.zoom, colorHex: nodeColors[current.nodes.length % nodeColors.length]!, shapeRaw: 'Rounded', width: 160, height: 58 };
    const next = { ...current, nodes: [...current.nodes, node] };
    mapRef.current = next;
    setMap(next);
    setSelectedNodeId(node.id);
    scheduleSave(next);
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!map) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === 'select') setInteraction({ type: 'pan', lastX: event.clientX, lastY: event.clientY });
    else if (tool === 'eraser' || tool === 'partialEraser') {
      beginHistoryGesture();
      setInteraction({ type: 'erase', mode: tool === 'partialEraser' ? 'partial' : 'stroke' });
    } else {
      beginHistoryGesture();
      const point = coordinate(event);
      const stroke = { points: [{ ...point, pressure: event.pressure || 0.5 }], color: drawingColor, alpha: tool === 'highlighter' ? 0.4 : 1, width: drawingWidth, tool } satisfies MindMapStroke;
      draftStrokeRef.current = stroke;
      setDraftStroke(stroke);
      setInteraction({ type: 'draw' });
    }
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!map || !interaction) return;
    if (interaction.type === 'pan') {
      const dx = event.clientX - interaction.lastX;
      const dy = event.clientY - interaction.lastY;
      const viewport = viewportRef.current = { ...viewportRef.current, x: viewportRef.current.x + dx, y: viewportRef.current.y + dy };
      setOffset({ x: viewport.x, y: viewport.y });
      setInteraction({ ...interaction, lastX: event.clientX, lastY: event.clientY });
    } else if (interaction.type === 'node') {
      const current = mapRef.current ?? map;
      const dx = (event.clientX - interaction.lastX) / viewportRef.current.zoom;
      const dy = (event.clientY - interaction.lastY) / viewportRef.current.zoom;
      if (dx !== 0 || dy !== 0) commitHistoryGesture();
      const next = { ...current, nodes: current.nodes.map((node) => node.id === interaction.id ? { ...node, x: node.x + dx, y: node.y + dy } : node) };
      mapRef.current = next;
      setMap(next);
      setInteraction({ ...interaction, lastX: event.clientX, lastY: event.clientY });
    } else if (interaction.type === 'image') {
      const current = mapRef.current ?? map;
      const dx = (event.clientX - interaction.lastX) / viewportRef.current.zoom;
      const dy = (event.clientY - interaction.lastY) / viewportRef.current.zoom;
      if (dx !== 0 || dy !== 0) commitHistoryGesture();
      const next = { ...current, images: current.images.map((image) => image.id === interaction.id ? { ...image, x: image.x + dx, y: image.y + dy } : image) };
      mapRef.current = next;
      setMap(next);
      setInteraction({ ...interaction, lastX: event.clientX, lastY: event.clientY });
    } else if (interaction.type === 'draw') {
      const point = coordinate(event);
      const stroke = draftStrokeRef.current;
      if (stroke) {
        const next = { ...stroke, points: [...stroke.points, { ...point, pressure: event.pressure || 0.5 }] };
        draftStrokeRef.current = next;
        setDraftStroke(next);
      }
    } else if (interaction.type === 'erase') {
      const point = coordinate(event);
      const radius = drawingWidth * 2;
      const nextStrokes = interaction.mode === 'partial'
        ? partiallyEraseStrokes(strokesRef.current, point, radius)
        : strokesRef.current.filter((stroke) => !stroke.points.some((strokePoint) =>
          Math.hypot(strokePoint.x - point.x, strokePoint.y - point.y) <= radius + stroke.width / 2,
        ));
      if (nextStrokes.length !== strokesRef.current.length || nextStrokes.some((stroke, index) => stroke !== strokesRef.current[index])) {
        commitHistoryGesture();
        strokesRef.current = nextStrokes;
        setStrokes(nextStrokes);
      }
    }
  };

  const onPointerUp = () => {
    const current = mapRef.current;
    if (!current || !interaction) return;
    if (interaction.type === 'node' || interaction.type === 'image' || interaction.type === 'pan') scheduleSave(current);
    const stroke = draftStrokeRef.current;
    if (interaction.type === 'draw' && stroke && stroke.points.length > 1) {
      commitHistoryGesture();
      const nextStrokes = [...strokesRef.current, stroke];
      strokesRef.current = nextStrokes;
      setStrokes(nextStrokes);
      scheduleSave(current, nextStrokes);
    }
    if (interaction.type === 'erase') scheduleSave(current, strokesRef.current);
    draftStrokeRef.current = null;
    setDraftStroke(null);
    endHistoryGesture();
    setInteraction(null);
  };

  const onNodePointerDown = (event: PointerEvent<SVGGElement>, node: MindMapNode) => {
    event.stopPropagation();
    const current = mapRef.current;
    if (!current) return;
    if (connectingFrom && connectingFrom !== node.id) {
      recordHistory();
      const connection: MindMapConnection = { id: crypto.randomUUID(), fromNodeId: connectingFrom, toNodeId: node.id, colorHex: node.colorHex, lineStyleRaw: 'Curved' };
      const next = { ...current, connections: [...current.connections, connection] };
      mapRef.current = next;
      setMap(next);
      setConnectingFrom(null);
      scheduleSave(next);
      return;
    }
    setSelectedNodeId(node.id);
    if (tool === 'select') {
      beginHistoryGesture();
      event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
      setInteraction({ type: 'node', id: node.id, lastX: event.clientX, lastY: event.clientY });
    }
  };

  const onImagePointerDown = (event: PointerEvent<SVGGElement>, imageId: string) => {
    event.stopPropagation();
    beginHistoryGesture();
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
    setInteraction({ type: 'image', id: imageId, lastX: event.clientX, lastY: event.clientY });
  };

  const addImage = async (file: File) => {
    try {
      const base64 = await mapImageToBase64(file);
      const current = mapRef.current;
      if (!current) return;
      recordHistory();
      const nextImages = [...imageDataRef.current, base64];
      const viewport = viewportRef.current;
      const next = { ...current, images: [...current.images, { id: crypto.randomUUID(), x: 380 - viewport.x / viewport.zoom, y: 360 - viewport.y / viewport.zoom, width: 240, height: 180 }] };
      imageDataRef.current = nextImages;
      mapRef.current = next;
      setImageData(nextImages);
      setMap(next);
      await saveMap(next, strokesRef.current, nextImages);
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : 'The image could not be added.');
    }
  };

  if (authLoading || (user && isPremium && loading)) return <WorkspaceLoading />;
  if (!user) return <SignInGate onSignIn={() => signIn('google')} />;
  if (!isPremium) return <PremiumGate onUpgrade={() => setShowUpsell(true)} />;
  if (!mapId) return (
    <MindMapLibrary
      maps={visibleMaps}
      query={query}
      folder={folder}
      folders={folders}
      favoritesOnly={favoritesOnly}
      error={error}
      onQuery={setQuery}
      onFolder={setFolder}
      onFavorites={() => setFavoritesOnly((value) => !value)}
      onOpen={(item) => router.push(`/mind-maps/${item.id}`)}
      onCreate={createBlank}
      onDeck={openDeckPicker}
      onDelete={(item) => void removeMap(item)}
    >
      {showDecks && <DeckPicker decks={decks} onClose={() => setShowDecks(false)} onSelect={(deck) => void createFromDeck(deck)} />}
    </MindMapLibrary>
  );
  if (!map) return <WorkspaceLoading />;

  const selected = map.nodes.find((node) => node.id === selectedNodeId) ?? null;
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0b0d14] text-foreground flex flex-col">
      <header className="h-16 shrink-0 px-4 border-b border-white/10 bg-background/90 backdrop-blur flex items-center gap-3">
        <Link href="/mind-maps" className="p-2 rounded-lg text-foreground-muted hover:bg-white/5 hover:text-foreground" aria-label="Back to mind maps"><ArrowLeft className="w-4 h-4" /></Link>
        <input value={map.title} onChange={(event) => updateMap((current) => ({ ...current, title: event.target.value }))} onBlur={() => { if (mapRef.current) void saveMap(mapRef.current); }} className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none border-b border-transparent focus:border-accent" aria-label="Mind map title" />
        <input value={map.folderName} onChange={(event) => updateMap((current) => ({ ...current, folderName: event.target.value }))} onBlur={() => { if (mapRef.current) void saveMap(mapRef.current); }} className="hidden lg:block w-32 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent" aria-label="Mind map folder" />
        <IconButton icon={<Undo2 />} onClick={undo} label="Undo" disabled={!historyState.canUndo} />
        <IconButton icon={<Redo2 />} onClick={redo} label="Redo" disabled={!historyState.canRedo} />
        <button onClick={() => updateMap((current) => ({ ...current, isFavorite: !current.isFavorite }))} className={`p-2 rounded-lg ${map.isFavorite ? 'text-yellow-400 bg-yellow-400/10' : 'text-foreground-muted hover:bg-white/5'}`} aria-label="Toggle favourite"><Star className="w-4 h-4" fill={map.isFavorite ? 'currentColor' : 'none'} /></button>
        {map.sourceDeckId && <button onClick={() => void updateFromDeck()} className="hidden sm:inline-flex items-center gap-2 px-3 py-2 text-xs rounded-lg border border-white/10 text-foreground-muted hover:text-foreground hover:bg-white/5"><RefreshCw className="w-3.5 h-3.5" /> Update from deck</button>}
        <span className="hidden md:flex items-center gap-1.5 text-[11px] text-foreground-faint">{saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}{saving ? 'Saving' : 'Saved'}</span>
        <button onClick={() => void removeMap(map)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10" aria-label="Delete mind map"><Trash2 className="w-4 h-4" /></button>
      </header>
      {error && <p className="mx-4 mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">{error}</p>}
      <div className="flex-1 min-h-0 flex">
        <aside className="w-[220px] shrink-0 hidden lg:flex flex-col gap-3 border-r border-white/10 p-3 bg-[#11131d]">
          <ToolButton active={tool === 'select'} icon={<MousePointer2 />} label="Select" onClick={() => setTool('select')} />
          <ToolButton active={tool === 'pen'} icon={<Pencil />} label="Pen" onClick={() => setTool('pen')} />
          <ToolButton active={tool === 'highlighter'} icon={<Highlighter />} label="Highlighter" onClick={() => setTool('highlighter')} />
          <ToolButton active={tool === 'eraser'} icon={<X />} label="Erase stroke" onClick={() => setTool('eraser')} />
          <ToolButton active={tool === 'partialEraser'} icon={<Scissors />} label="Partial eraser" onClick={() => setTool('partialEraser')} />
          <div className="h-px bg-white/10 my-1" />
          <ToolButton icon={<Plus />} label="Add node" onClick={addNode} />
          <ToolButton active={!!connectingFrom} icon={<Link2 />} label={connectingFrom ? 'Cancel connection' : 'Connect nodes'} onClick={() => setConnectingFrom((current) => current ? null : selectedNodeId)} disabled={!selectedNodeId} />
          <ToolButton icon={<Upload />} label="Add image" onClick={() => imagePickerRef.current?.click()} />
          <input ref={imagePickerRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void addImage(file); event.target.value = ''; }} />
          {tool !== 'select' && <>
            <div className="h-px bg-white/10 my-1" />
            <div className="grid grid-cols-3 gap-2 px-1">{drawingColors.map((color) => <button key={color} onClick={() => setDrawingColor(color)} className={`w-8 h-8 rounded-full border-2 ${drawingColor === color ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: color }} aria-label={`Use ${color}`} />)}</div>
            <label className="px-1 text-xs text-foreground-muted">Stroke width<input type="range" min="1" max="14" value={drawingWidth} onChange={(event) => setDrawingWidth(Number(event.target.value))} className="w-full accent-accent" /></label>
          </>}
        </aside>
        <main className="relative flex-1 min-w-0 overflow-hidden">
          <svg ref={canvasRef} className="w-full h-full touch-none select-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={(event) => { event.preventDefault(); const nextZoom = Math.min(2.5, Math.max(0.35, viewportRef.current.zoom - event.deltaY * 0.001)); viewportRef.current = { ...viewportRef.current, zoom: nextZoom }; setZoom(nextZoom); scheduleSave(mapRef.current ?? map); }}>
            <defs><pattern id="mind-map-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth="1" /></pattern></defs>
            <rect width="100%" height="100%" fill="url(#mind-map-grid)" />
            <g transform={`translate(${offset.x} ${offset.y}) scale(${zoom})`}>
              {map.images.map((image, index) => imageData[index] ? <g key={image.id} transform={`translate(${image.x} ${image.y})`} onPointerDown={(event) => onImagePointerDown(event, image.id)} className="cursor-move"><image href={downloadImageData(imageData[index]!)} width={image.width} height={image.height} preserveAspectRatio="xMidYMid meet" /><rect width={image.width} height={image.height} fill="transparent" stroke="rgba(255,255,255,.25)" /></g> : null)}
              {map.connections.map((connection) => {
                const from = map.nodes.find((node) => node.id === connection.fromNodeId);
                const to = map.nodes.find((node) => node.id === connection.toNodeId);
                if (!from || !to) return null;
                return <path key={connection.id} d={connection.lineStyleRaw === 'Straight' ? `M ${from.x + from.width} ${from.y + from.height / 2} L ${to.x} ${to.y + to.height / 2}` : cubicPath(from, to)} fill="none" stroke={hex(connection.colorHex)} strokeWidth="2.5" opacity="0.8" />;
              })}
              {strokes.map((stroke, index) => <path key={index} d={svgPath(stroke.points)} fill="none" stroke={stroke.color} strokeOpacity={stroke.alpha} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />)}
              {draftStroke && <path d={svgPath(draftStroke.points)} fill="none" stroke={draftStroke.color} strokeOpacity={draftStroke.alpha} strokeWidth={draftStroke.width} strokeLinecap="round" strokeLinejoin="round" />}
              {map.nodes.map((node) => <g key={node.id} transform={`translate(${node.x} ${node.y})`} onPointerDown={(event) => onNodePointerDown(event, node)} className="cursor-move">
                {node.shapeRaw === 'Circle' ? <ellipse cx={node.width / 2} cy={node.height / 2} rx={node.width / 2} ry={node.height / 2} fill={hex(node.colorHex)} stroke={selectedNodeId === node.id ? '#FFFFFF' : 'rgba(0,0,0,.2)'} strokeWidth={selectedNodeId === node.id ? 3 : 1} /> : <rect width={node.width} height={node.height} rx={node.shapeRaw === 'Pill' ? node.height / 2 : 14} fill={hex(node.colorHex)} stroke={selectedNodeId === node.id ? '#FFFFFF' : 'rgba(0,0,0,.2)'} strokeWidth={selectedNodeId === node.id ? 3 : 1} />}
                <text x={node.width / 2} y={node.detailText ? node.height / 2 - 5 : node.height / 2 + 5} textAnchor="middle" className="fill-black text-[14px] font-semibold pointer-events-none">{node.text || 'Untitled node'}</text>
                {node.detailText && <text x={node.width / 2} y={node.height / 2 + 15} textAnchor="middle" className="fill-black/70 text-[10px] pointer-events-none">{node.detailText}</text>}
              </g>)}
            </g>
          </svg>
          <div className="absolute bottom-4 left-4 flex lg:hidden gap-2 rounded-xl bg-[#161927]/95 border border-white/10 p-2 shadow-xl"><IconButton active={tool === 'select'} icon={<MousePointer2 />} onClick={() => setTool('select')} label="Select" /><IconButton active={tool === 'pen'} icon={<Pencil />} onClick={() => setTool('pen')} label="Pen" /><IconButton icon={<Plus />} onClick={addNode} label="Add node" /><IconButton icon={<Upload />} onClick={() => imagePickerRef.current?.click()} label="Add image" /></div>
          <div className="absolute bottom-4 right-4 flex gap-2 rounded-xl bg-[#161927]/95 border border-white/10 p-2 shadow-xl"><IconButton icon={<ZoomOut />} onClick={() => { const nextZoom = Math.max(0.35, viewportRef.current.zoom - 0.15); viewportRef.current = { ...viewportRef.current, zoom: nextZoom }; setZoom(nextZoom); scheduleSave(mapRef.current ?? map); }} label="Zoom out" /><button onClick={() => { viewportRef.current = { x: 80, y: 80, zoom: 1 }; setZoom(1); setOffset({ x: 80, y: 80 }); scheduleSave(mapRef.current ?? map); }} className="px-2 text-xs text-foreground-muted hover:text-foreground">{Math.round(zoom * 100)}%</button><IconButton icon={<ZoomIn />} onClick={() => { const nextZoom = Math.min(2.5, viewportRef.current.zoom + 0.15); viewportRef.current = { ...viewportRef.current, zoom: nextZoom }; setZoom(nextZoom); scheduleSave(mapRef.current ?? map); }} label="Zoom in" /><IconButton icon={<Maximize2 />} onClick={() => { viewportRef.current = { x: 80, y: 80, zoom: 1 }; setZoom(1); setOffset({ x: 80, y: 80 }); scheduleSave(mapRef.current ?? map); }} label="Reset canvas" /></div>
        </main>
        <NodeInspector node={selected} onChange={(update) => updateMap((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === update.id ? update : node) }))} onDelete={() => updateMap((current) => ({ ...current, nodes: current.nodes.filter((node) => node.id !== selected?.id), connections: current.connections.filter((connection) => connection.fromNodeId !== selected?.id && connection.toNodeId !== selected?.id) }))} />
      </div>
      {showUpsell && <PremiumUpsell onClose={() => setShowUpsell(false)} feature="Mind Maps on desktop" />}
    </div>
  );
}

function MindMapLibrary({ maps, query, folder, folders, favoritesOnly, error, onQuery, onFolder, onFavorites, onOpen, onCreate, onDeck, onDelete, children }: { maps: MindMap[]; query: string; folder: string; folders: string[]; favoritesOnly: boolean; error: string | null; onQuery: (value: string) => void; onFolder: (value: string) => void; onFavorites: () => void; onOpen: (map: MindMap) => void; onCreate: () => void; onDeck: () => void; onDelete: (map: MindMap) => void; children: React.ReactNode }) {
  return <div className="max-w-6xl mx-auto px-6 py-12"><div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-8"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent mb-2">Quobby Premium</p><h1 className="text-3xl font-bold text-foreground">Mind Maps</h1><p className="text-sm text-foreground-muted mt-2">Create and continue your maps on a larger canvas.</p></div><div className="flex gap-2"><button onClick={onDeck} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-foreground-muted hover:text-foreground hover:bg-white/5"><Sparkles className="w-4 h-4 text-yellow-400" /> From deck</button><button onClick={onCreate} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-black font-semibold text-sm hover:bg-accent-light"><Plus className="w-4 h-4" /> New mind map</button></div></div>{error && <p className="mb-5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">{error}</p>}<div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6"><aside className="space-y-2"><label className="relative block"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-faint" /><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search maps" className="w-full rounded-xl bg-white/[0.04] border border-white/10 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent" /></label><button onClick={onFavorites} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm ${favoritesOnly ? 'bg-yellow-400/10 text-yellow-400' : 'text-foreground-muted hover:bg-white/5'}`}><Star className="w-4 h-4" fill={favoritesOnly ? 'currentColor' : 'none'} /> Favourites</button><p className="px-3 pt-3 text-[10px] uppercase tracking-wider font-semibold text-foreground-faint">Folders</p>{folders.map((item) => <button key={item} onClick={() => onFolder(item)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left ${folder === item ? 'bg-white/8 text-foreground' : 'text-foreground-muted hover:bg-white/5'}`}>{item === 'All Mind Maps' ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}{item}</button>)}</aside><section>{maps.length === 0 ? <div className="min-h-[320px] rounded-2xl border border-dashed border-white/15 flex flex-col items-center justify-center text-center p-8"><Circle className="w-9 h-9 text-accent mb-4" /><h2 className="font-semibold">No mind maps yet</h2><p className="text-sm text-foreground-muted mt-2 max-w-sm">Create a blank map or generate one from a flashcard deck to see it here.</p></div> : <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{maps.map((item) => <article key={item.id} className="group rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden hover:border-accent/40 transition-colors"><button onClick={() => onOpen(item)} className="w-full text-left"><div className="h-32 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,.11)_1px,transparent_0)] bg-[size:16px_16px] relative overflow-hidden"><span className="absolute inset-0 flex items-center justify-center text-xs text-foreground-faint">{item.nodes.length} nodes · {item.connections.length} links</span></div><div className="p-4"><div className="flex gap-2 items-center"><h2 className="flex-1 truncate font-semibold text-sm">{item.title}</h2>{item.isFavorite && <Star className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" />}</div><p className="text-xs text-foreground-faint mt-1">{item.folderName} · {new Date(item.updatedAt).toLocaleDateString()}</p></div></button><div className="px-4 pb-3 flex justify-end opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"><button onClick={() => onDelete(item)} className="text-xs text-red-400 hover:text-red-300">Delete</button></div></article>)}</div>}</section></div>{children}</div>;
}

function NodeInspector({ node, onChange, onDelete }: { node: MindMapNode | null; onChange: (node: MindMapNode) => void; onDelete: () => void }) { if (!node) return <aside className="hidden xl:flex w-72 shrink-0 border-l border-white/10 p-4 bg-[#11131d] text-sm text-foreground-faint items-center text-center">Select a node to edit its content, colour, and shape.</aside>; return <aside className="hidden xl:block w-72 shrink-0 border-l border-white/10 p-4 bg-[#11131d] overflow-auto"><div className="flex items-center justify-between mb-4"><h2 className="font-semibold text-foreground">Edit node</h2><button onClick={onDelete} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10" aria-label="Delete node"><Trash2 className="w-4 h-4" /></button></div><label className="block text-xs text-foreground-muted mb-3">Title<input value={node.text} onChange={(event) => onChange({ ...node, text: event.target.value })} className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus:border-accent" /></label><label className="block text-xs text-foreground-muted mb-4">Detail<input value={node.detailText} onChange={(event) => onChange({ ...node, detailText: event.target.value })} className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus:border-accent" /></label><p className="text-xs text-foreground-muted mb-2">Colour</p><div className="grid grid-cols-5 gap-2 mb-4">{nodeColors.map((color) => <button key={color} onClick={() => onChange({ ...node, colorHex: color })} className={`w-8 h-8 rounded-full border-2 ${node.colorHex === color ? 'border-white' : 'border-transparent'}`} style={{ background: hex(color) }} aria-label={`Use ${color}`} />)}</div><label className="block text-xs text-foreground-muted">Shape<select value={node.shapeRaw} onChange={(event) => onChange({ ...node, shapeRaw: event.target.value as MindMapNode['shapeRaw'] })} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#171927] px-3 py-2 text-sm text-foreground outline-none"><option>Rounded</option><option>Pill</option><option>Circle</option></select></label></aside>; }

function DeckPicker({ decks, onClose, onSelect }: { decks: Deck[]; onClose: () => void; onSelect: (deck: Deck) => void }) { return <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"><div className="w-full max-w-md rounded-2xl bg-[#161927] border border-white/10 shadow-2xl p-5"><div className="flex items-center justify-between mb-4"><div><h2 className="font-semibold">Create from a deck</h2><p className="text-xs text-foreground-muted mt-1">The current flashcards will become connected map nodes.</p></div><button onClick={onClose} className="p-2 text-foreground-muted hover:text-foreground"><X className="w-4 h-4" /></button></div><div className="max-h-[55vh] overflow-auto space-y-1">{decks.length === 0 ? <p className="py-8 text-center text-sm text-foreground-muted">No flashcard decks available.</p> : decks.map((deck) => <button key={deck.id} onClick={() => onSelect(deck)} className="w-full text-left rounded-xl px-3 py-3 hover:bg-white/5"><p className="text-sm font-medium">{deck.name}</p>{deck.description && <p className="text-xs text-foreground-faint mt-1 truncate">{deck.description}</p>}</button>)}</div></div></div>; }

function ToolButton({ active, icon, label, onClick, disabled }: { active?: boolean; icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) { return <button disabled={disabled} onClick={onClick} className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors disabled:opacity-35 ${active ? 'bg-accent text-black font-semibold' : 'text-foreground-muted hover:text-foreground hover:bg-white/5'}`}><span className="w-4 h-4">{icon}</span>{label}</button>; }
function IconButton({ active, icon, onClick, label, disabled }: { active?: boolean; icon: React.ReactNode; onClick: () => void; label: string; disabled?: boolean }) { return <button disabled={disabled} onClick={onClick} aria-label={label} className={`p-2 rounded-lg disabled:opacity-35 ${active ? 'bg-accent text-black' : 'text-foreground-muted hover:text-foreground hover:bg-white/5'}`}>{icon}</button>; }
function WorkspaceLoading() { return <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>; }
function SignInGate({ onSignIn }: { onSignIn: () => void }) { return <div className="max-w-md mx-auto px-6 py-28 text-center"><h1 className="text-3xl font-bold">Your mind maps, on a bigger canvas.</h1><p className="text-foreground-muted mt-3">Sign in with the same Quobby account you use on your phone.</p><button onClick={onSignIn} className="mt-7 px-5 py-3 rounded-xl bg-accent text-black font-semibold">Sign in to continue</button></div>; }
function PremiumGate({ onUpgrade }: { onUpgrade: () => void }) { return <div className="max-w-lg mx-auto px-6 py-24 text-center"><div className="w-14 h-14 rounded-2xl bg-yellow-400/10 text-yellow-400 flex items-center justify-center mx-auto mb-5"><Sparkles className="w-7 h-7" /></div><h1 className="text-3xl font-bold">Mind maps on desktop</h1><p className="text-foreground-muted mt-3">Open, create, and edit your mobile mind maps on a larger canvas with Quobby Premium.</p><button onClick={onUpgrade} className="mt-7 px-5 py-3 rounded-xl bg-yellow-400 text-black font-semibold">Unlock with Premium</button></div>; }
