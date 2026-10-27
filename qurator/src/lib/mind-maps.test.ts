import assert from 'node:assert/strict';
import test from 'node:test';
// @ts-expect-error Node's strip-types test runner needs the explicit .ts extension.
import { createMindMap, createMindMapSnapshot, mindMapFromDeck, mindMapFromRow, mindMapUpsert, partiallyEraseStrokes, portableDrawingJson } from './mind-maps.ts';

test('creates a mobile-compatible blank mind map', () => {
  const map = createMindMap('Map id');

  assert.equal(map.id, 'Map id');
  assert.equal(map.title, 'Untitled Mind Map');
  assert.equal(map.folderName, 'All Mind Maps');
  assert.equal(map.canvasZoom, 1);
  assert.deepEqual(map.nodes, []);
  assert.deepEqual(map.connections, []);
});

test('reads mobile JSON columns and writes portable drawing JSON', () => {
  const map = mindMapFromRow({
    id: 'map-1',
    title: 'Cell biology',
    folder_name: 'Study',
    is_favorite: true,
    canvas_offset_x: 42,
    canvas_offset_y: -18,
    canvas_zoom: 1.5,
    nodes_json: [{ id: 'node-1', text: 'Cell', x: 20, y: 30, colorHex: '80D4FF', shapeRaw: 'Pill', width: 140, height: 50 }],
    connections_json: [],
    images_meta_json: [],
    source_deck_id: null,
    created_at: '2026-11-17T10:00:00.000Z',
    updated_at: '2026-11-17T11:00:00.000Z',
  });

  assert.equal(map.folderName, 'Study');
  assert.equal(map.nodes[0]?.shapeRaw, 'Pill');
  assert.deepEqual(JSON.parse(portableDrawingJson([{ points: [{ x: 1, y: 2, pressure: 0.5 }], color: '#FFFFFF', alpha: 1, width: 3, tool: 'pen' }])), {
    version: 1,
    platform: 'web',
    strokes: [{ points: [{ x: 1, y: 2, pressure: 0.5 }], color: '#FFFFFF', alpha: 1, width: 3, tool: 'pen' }],
  });
});

test('generates a linked mind map from a flashcard deck', () => {
  const map = mindMapFromDeck('map-2', 'deck-1', 'Spanish basics', [
    { front_text: 'Hola', back_text: 'Hello', part_of_speech: 'Greetings' },
    { front_text: 'Adiós', back_text: 'Goodbye', part_of_speech: 'Greetings' },
  ]);

  assert.equal(map.sourceDeckId, 'deck-1');
  assert.equal(map.title, 'Spanish basics');
  assert.equal(map.nodes.length, 4);
  assert.equal(map.connections.length, 3);
  assert.equal(map.nodes[0]?.text, 'Spanish basics');
  assert.equal(map.nodes[1]?.text, 'Greetings');
});

test('clears the native drawing path so phones restore the shared portable drawing', () => {
  const row = mindMapUpsert(createMindMap('map-3'), 'user-3');

  assert.equal(row.drawing_storage_path, null);
  assert.equal(row.image_data_storage_path, 'user-3/mind-maps/map-3/images.data');
});

test('partially erases only the dragged-through portion of a stroke', () => {
  const strokes = partiallyEraseStrokes([
    {
      points: [{ x: 0, y: 0, pressure: 0.5 }, { x: 10, y: 0, pressure: 0.5 }],
      color: '#FFFFFF',
      alpha: 1,
      width: 2,
      tool: 'pen',
    },
  ], { x: 5, y: 0 }, 2);

  assert.equal(strokes.length, 2);
  assert.deepEqual(strokes.map((stroke) => stroke.points.map((point) => point.x)), [[0, 3], [7, 10]]);
});

test('leaves untouched strokes unchanged during a partial erase', () => {
  const stroke = {
    points: [{ x: 0, y: 0, pressure: 0.5 }, { x: 10, y: 0, pressure: 0.5 }],
    color: '#FFFFFF',
    alpha: 1,
    width: 2,
    tool: 'pen' as const,
  };

  const strokes = partiallyEraseStrokes([stroke], { x: 30, y: 0 }, 2);

  assert.strictEqual(strokes[0], stroke);
});

test('captures immutable editor state for undo and redo', () => {
  const map = createMindMap('map-4');
  map.nodes = [{ id: 'node-1', text: 'Before', detailText: '', x: 10, y: 20, colorHex: '80D4FF', shapeRaw: 'Rounded', width: 140, height: 56 }];
  const strokes = [{ points: [{ x: 1, y: 2, pressure: 0.5 }], color: '#FFFFFF', alpha: 1, width: 3, tool: 'pen' as const }];
  const snapshot = createMindMapSnapshot(map, strokes, ['image-data']);

  map.nodes[0]!.x = 99;
  strokes[0]!.points[0]!.x = 88;

  assert.equal(snapshot.map.nodes[0]!.x, 10);
  assert.equal(snapshot.strokes[0]!.points[0]!.x, 1);
  assert.deepEqual(snapshot.images, ['image-data']);
});
