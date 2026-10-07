/** Placeholder while a topic's lessons load. */
export function ShowSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1040px] animate-pulse px-4 pt-8 sm:px-6" aria-hidden>
      <div className="flex items-center gap-3">
        <div className="size-12 rounded-xl bg-hover" />
        <div className="h-5 w-48 rounded bg-hover" />
      </div>
      <div className="mt-8 h-9 w-2/3 rounded-lg bg-hover" />
      <div className="mt-3 h-4 w-1/2 rounded bg-hover" />
      <div className="mt-6 h-[360px] rounded-2xl border border-line bg-raised" />
    </div>
  );
}
