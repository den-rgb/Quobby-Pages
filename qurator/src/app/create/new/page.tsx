'use client';

import { EditorShell } from '@/components/editor/editor-shell';
import { Suspense } from 'react';

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center text-foreground-muted">
          Loading editor...
        </div>
      }
    >
      <EditorShell />
    </Suspense>
  );
}
