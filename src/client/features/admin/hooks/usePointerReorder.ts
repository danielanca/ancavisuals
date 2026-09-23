import { useRef, useState } from "react";
import type React from "react";

type UsePointerReorderOptions<T> = {
  items: T[];
  getId: (item: T) => string;
  onReorder: (nextItems: T[]) => void;
  longPressMs?: number;
};

function reorderArray<T>(items: T[], getId: (item: T) => string, movingIds: string[], targetId: string): T[] | null {
  if (movingIds.includes(targetId) || movingIds.length === 0) return null;
  const movingSet = new Set(movingIds);
  const moving = items.filter((item) => movingSet.has(getId(item)));
  const rest = items.filter((item) => !movingSet.has(getId(item)));
  const targetIndex = rest.findIndex((item) => getId(item) === targetId);
  if (targetIndex === -1) return null;
  rest.splice(targetIndex, 0, ...moving);
  return rest;
}

// Pointer-based drag (not native HTML5 drag-and-drop) so this works with
// touch as well as mouse. A short hold without movement toggles the card
// into the multi-select set; movement past a small threshold starts a
// drag instead — of the whole multi-selection if the dragged item is part
// of it, otherwise just that one item. Mirrors the pattern proven in
// OfferTemplateOrganizerPage.tsx.
export function usePointerReorder<T>({ items, getId, onReorder, longPressMs = 450 }: UsePointerReorderOptions<T>) {
  const [draggingIds, setDraggingIds] = useState<string[]>([]);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const draggingIdsRef = useRef<string[]>([]);
  const dragOverIdRef = useRef<string | null>(null);

  function toggleMultiSelect(id: string) {
    setMultiSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Ordinea "live" cât timp tragi — celelalte poze se dau la o parte ca să
  // facă loc, exact unde va ateriza poza trasă. La ridicarea degetului/mouse-ului
  // se salvează exact ordinea deja afișată, fără niciun salt vizual.
  const previewItems = draggingIds.length > 0 && dragOverId
    ? reorderArray(items, getId, draggingIds, dragOverId) ?? items
    : items;

  function handlePointerDown(event: React.PointerEvent, id: string) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;

    const longPressTimer = window.setTimeout(() => {
      toggleMultiSelect(id);
    }, longPressMs);

    function onMove(moveEvent: PointerEvent) {
      if (!moved) {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (Math.hypot(dx, dy) < 6) return;
        moved = true;
        window.clearTimeout(longPressTimer);
        const group = multiSelected.has(id) && multiSelected.size > 1
          ? items.filter((item) => multiSelected.has(getId(item))).map(getId)
          : [id];
        draggingIdsRef.current = group;
        setDraggingIds(group);
      }
      const overEl = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      const cardEl = overEl?.closest<HTMLElement>("[data-reorder-id]");
      const overId = cardEl?.dataset.reorderId;
      const nextOverId = overId && !draggingIdsRef.current.includes(overId) ? overId : null;
      if (nextOverId !== dragOverIdRef.current) {
        dragOverIdRef.current = nextOverId;
        setDragOverId(nextOverId);
      }
    }

    function onUp() {
      window.clearTimeout(longPressTimer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (moved && draggingIdsRef.current.length > 0 && dragOverIdRef.current) {
        const next = reorderArray(items, getId, draggingIdsRef.current, dragOverIdRef.current);
        if (next) onReorder(next);
      }
      draggingIdsRef.current = [];
      dragOverIdRef.current = null;
      setDraggingIds([]);
      setDragOverId(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  return {
    previewItems,
    draggingIds,
    dragOverId,
    multiSelected,
    setMultiSelected,
    toggleMultiSelect,
    handlePointerDown,
  };
}
