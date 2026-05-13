'use client';


export default function TutorialError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
        <pre className="text-xs text-red-400 bg-white/[0.03] border border-border rounded-lg p-4 mb-4 text-left overflow-auto max-h-60 whitespace-pre-wrap">
          {error.message}
          {'\n\n'}
          {error.stack}
        </pre>
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-accent text-black text-sm font-semibold rounded-lg hover:bg-accent-light transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
