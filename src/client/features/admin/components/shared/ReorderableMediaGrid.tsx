import { useRef, useState } from "react";
import { usePointerReorder } from "../../hooks/usePointerReorder";
import { useFlipAnimation } from "../../hooks/useFlipAnimation";

export type ReorderableMediaItem = {
  id: string;
  url: string;
  kind?: "image" | "video";
  label?: string;
};

type ReorderableMediaGridProps = {
  items: ReorderableMediaItem[];
  onReorder: (nextItems: ReorderableMediaItem[]) => void;
  onRemove: (id: string) => void;
  emptyLabel?: string;
  columnsClassName?: string;
  // "masonry" (implicit): coloane CSS, înălțime naturală, se umple de sus în
  // jos pe fiecare coloană — bun pentru galerii cu poze de proporții variate.
  // "grid": grid clasic, carduri mici pătrate, ordine strict de la stânga la
  // dreapta — potrivit pentru o fâșie/footer unde toate pozele au aceeași
  // dimensiune vizuală.
  layout?: "masonry" | "grid";
};

const DEFAULT_COLUMNS_CLASS: Record<"masonry" | "grid", string> = {
  masonry: "columns-2 gap-3 sm:columns-3 lg:columns-4",
  grid: "grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10",
};

export default function ReorderableMediaGrid({
  items,
  onReorder,
  onRemove,
  emptyLabel = "Nimic selectat.",
  columnsClassName,
  layout = "masonry",
}: ReorderableMediaGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [swapSelectedId, setSwapSelectedId] = useState<string | null>(null);
  const { previewItems, draggingIds, multiSelected, setMultiSelected, handlePointerDown } = usePointerReorder({
    items,
    getId: (item) => item.id,
    onReorder,
  });

  // Ordinea afișată (previewItems) se schimbă live cât tragi — animăm fiecare
  // schimbare de poziție, ca pozele să alunece vizibil una lângă alta în loc
  // să sară instant în locul nou. Cardul aflat sub mână e exclus din animație
  // (rămâne pe loc, stilizat "ridicat"), ca să nu intre în conflict cu scale-ul lui.
  useFlipAnimation(previewItems.map((item) => item.id), containerRef, draggingIds);

  function handleDoubleClick(id: string) {
    if (!swapSelectedId) {
      setSwapSelectedId(id);
      return;
    }
    if (swapSelectedId === id) {
      setSwapSelectedId(null);
      return;
    }
    const a = items.findIndex((item) => item.id === swapSelectedId);
    const b = items.findIndex((item) => item.id === id);
    setSwapSelectedId(null);
    if (a === -1 || b === -1) return;
    const next = [...items];
    [next[a], next[b]] = [next[b], next[a]];
    onReorder(next);
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 px-4 py-6 text-sm text-neutral-600">
        {emptyLabel}
      </div>
    );
  }

  const isDraggingAny = draggingIds.length > 0;

  return (
    <>
      {(multiSelected.size > 0 || swapSelectedId) && (
        <p className="mb-3 text-xs text-violet-400">
          {swapSelectedId
            ? "O poză e selectată pentru schimb — dublu-click pe alta ca să facă schimb de locuri."
            : (
              <>
                {multiSelected.size} marcate ·{" "}
                <button
                  type="button"
                  onClick={() => setMultiSelected(new Set())}
                  className="text-neutral-500 underline hover:text-neutral-300"
                >
                  deselecteaza
                </button>
              </>
            )}
        </p>
      )}
      <div ref={containerRef} className={columnsClassName ?? DEFAULT_COLUMNS_CLASS[layout]}>
        {previewItems.map((item, index) => {
          const isSelected = multiSelected.has(item.id);
          const isDragging = draggingIds.includes(item.id);
          const isSwapSelected = swapSelectedId === item.id;
          return (
            <article
              key={item.id}
              data-reorder-id={item.id}
              onPointerDown={(event) => handlePointerDown(event, item.id)}
              onDoubleClick={() => handleDoubleClick(item.id)}
              style={{ touchAction: "none" }}
              className={`group ${layout === "masonry" ? "mb-3 break-inside-avoid" : ""} overflow-hidden rounded-2xl border bg-neutral-950 cursor-grab select-none active:cursor-grabbing ${
                isDragging ? "" : "transition-[opacity,transform,box-shadow,border-color] duration-150"
              } ${
                isDragging
                  ? "z-10 scale-[1.06] opacity-90 border-violet-500 shadow-2xl shadow-violet-950/60"
                  : isSwapSelected
                  ? "z-10 border-sky-400 ring-2 ring-sky-400"
                  : isDraggingAny
                  ? "opacity-70 border-neutral-800"
                  : isSelected
                  ? "border-violet-500"
                  : "border-neutral-800"
              }`}
            >
              <div className="relative bg-neutral-900">
                {item.kind === "video" ? (
                  <video
                    src={item.url}
                    className={`block w-full object-cover ${layout === "grid" ? "aspect-square" : "aspect-video"}`}
                    muted
                    draggable={false}
                  />
                ) : (
                  <img
                    src={item.url}
                    alt={item.label ?? ""}
                    className={layout === "grid" ? "block aspect-square w-full object-cover" : "block h-auto w-full"}
                    loading="lazy"
                    draggable={false}
                  />
                )}
                <div className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-white pointer-events-none">
                  #{index + 1}
                </div>
                {isSwapSelected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-sky-500/20 pointer-events-none">
                    <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-semibold text-white">⇄</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className="absolute right-2 top-2 rounded-full bg-red-900/80 px-2 py-0.5 text-[10px] text-red-300 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
