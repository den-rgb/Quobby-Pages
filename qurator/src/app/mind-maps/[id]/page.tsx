import { MindMapWorkspace } from '@/components/mind-maps/mind-map-workspace';

export default async function MindMapEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MindMapWorkspace mapId={id} />;
}
