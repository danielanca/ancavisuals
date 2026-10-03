/**
 * Fixed-height stand-in for a section that is not on screen yet (LazySection) or whose
 * code is still downloading (lazyParts fallbacks). The page keeps its length while the
 * visitor scrolls; when the real section mounts, its own height takes over once.
 */
export default function SectionSkeleton({ height }: { height: string }) {
  return (
    <div aria-hidden="true" className="bg-neutral-950 px-6 py-16" style={{ height }}>
      <div className="mx-auto flex h-full max-w-5xl animate-pulse flex-col gap-4 motion-reduce:animate-none">
        <div className="mx-auto h-3 w-24 rounded-full bg-white/10" />
        <div className="mx-auto h-7 w-64 max-w-full rounded-full bg-white/10" />
        <div className="mt-4 flex-1 rounded-2xl bg-white/[0.06]" />
      </div>
    </div>
  );
}
