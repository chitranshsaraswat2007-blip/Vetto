export default function WorkspaceLoading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading workspace</span>
      <div
        aria-hidden="true"
        className="mb-10 animate-pulse border-b border-line pb-8 motion-reduce:animate-none"
      >
        <div className="h-2.5 w-24 rounded bg-surface-strong" />
        <div className="mt-4 h-9 w-64 max-w-full rounded bg-surface-strong" />
        <div className="mt-4 h-3.5 w-full max-w-xl rounded bg-surface-muted" />
        <div className="mt-2 h-3.5 w-2/3 max-w-md rounded bg-surface-muted" />
      </div>
      <div
        aria-hidden="true"
        className="grid animate-pulse gap-6 motion-reduce:animate-none xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]"
      >
        <div className="h-80 rounded-lg border border-line bg-surface" />
        <div className="h-80 rounded-lg border border-line bg-surface" />
      </div>
    </div>
  );
}
