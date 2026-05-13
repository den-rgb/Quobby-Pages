'use client';


export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="h-full dark">
      <body className="min-h-full flex flex-col bg-black text-white antialiased">
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-md text-center">
            <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
            <pre className="text-xs text-red-400 bg-white/[0.05] border border-white/10 rounded-lg p-4 mb-4 text-left overflow-auto max-h-60 whitespace-pre-wrap">
              {error.message}
              {'\n\n'}
              {error.stack}
            </pre>
            <button
              onClick={reset}
              className="px-6 py-2.5 bg-pink-700 text-white text-sm font-semibold rounded-lg hover:bg-pink-600 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
