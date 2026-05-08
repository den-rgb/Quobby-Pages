'use client';

import { CanvasBoardDesigner } from '@/components/editor/canvas-board-designer';
import { Suspense } from 'react';

export default function BoardSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center text-foreground-muted">
          Loading board designer...
        </div>
      }
    >
      <CanvasBoardDesigner />
    </Suspense>
  );
}
