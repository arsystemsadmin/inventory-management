/** Shown instantly while a variation's page loads. */
export default function Loading() {
  return (
    <div className="mx-auto grid w-full max-w-3xl animate-pulse gap-4" aria-busy="true">
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="flex gap-4">
        <div className="size-28 rounded-xl bg-muted sm:size-36" />
        <div className="grid flex-1 content-start gap-2">
          <div className="h-7 w-2/3 rounded bg-muted" />
          <div className="h-5 w-1/3 rounded bg-muted" />
          <div className="h-6 w-20 rounded bg-muted" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => <div key={i} className="h-11 rounded-md bg-muted" />)}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted" />)}
      </div>
      <div className="h-40 rounded-xl bg-muted" />
    </div>
  );
}
