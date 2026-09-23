import { useLayoutEffect, useRef } from "react";

const DURATION_MS = 220;
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

// Clasicul FLIP (First, Last, Invert, Play): când ordinea cardurilor din
// container se schimbă, animăm tranziția de la poziția veche la cea nouă în
// loc să lăsăm browserul să sară direct — așa se vede clar cum se dau
// pozele la o parte ca să facă loc celei trase.
//
// Important: "Last" trebuie măsurat mereu dintr-o stare de repaus (fără nicio
// tranziție/transform activ) — altfel, dacă o tranziție anterioară e încă în
// desfășurare când măsori din nou, prinzi o poziție intermediară în loc de
// cea reală, iar delta calculată e greșită. Rezultatul e exact tremuratul
// vizibil raportat: fiecare update nou pornea de la o bază coruptă.
export function useFlipAnimation<T extends string>(
  orderKey: T[],
  containerRef: React.RefObject<HTMLElement | null>,
  excludeIds?: Set<string> | string[],
) {
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  const exclude = excludeIds instanceof Set ? excludeIds : new Set(excludeIds ?? []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const nodes = Array.from(container.querySelectorAll<HTMLElement>("[data-reorder-id]"));

    // 1) Anulează orice tranziție în curs și readu elementele la poziția lor
    // de repaus (fără transform), ÎNAINTE de a măsura — altfel "Last" nu e
    // de încredere.
    for (const node of nodes) {
      node.style.transition = "none";
      node.style.transform = "none";
    }
    void container.offsetHeight; // forțează reflow, ca reset-ul de mai sus să se aplice

    // 2) "Last" — poziția reală, de repaus, a fiecărui element acum.
    const nextRects = new Map<string, DOMRect>();
    for (const node of nodes) {
      const id = node.dataset.reorderId;
      if (id) nextRects.set(id, node.getBoundingClientRect());
    }

    // 3) "Invert" — pentru fiecare element care chiar și-a schimbat poziția
    // față de ultima măsurătoare, aplică translate-ul care îl duce vizual
    // înapoi la poziția veche (fără ca layout-ul să se schimbe).
    // Cardul aflat curent sub degetul/mouse-ul utilizatorului e exclus —
    // rămâne pe loc, fără animație, ca să nu intre în conflict cu stilul lui
    // de "ridicat" (scale + umbră).
    for (const node of nodes) {
      const id = node.dataset.reorderId;
      if (!id || exclude.has(id)) continue;
      const prev = prevRects.current.get(id);
      const next = nextRects.get(id);
      if (!prev || !next) continue;
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      node.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    void container.offsetHeight; // forțează reflow, ca "invert"-ul să se aplice înainte de tranziție

    // 4) "Play" — animă înapoi spre poziția reală (transform: none).
    for (const node of nodes) {
      const id = node.dataset.reorderId;
      if (!id || exclude.has(id)) continue;
      if (node.style.transform === "none" || node.style.transform === "") continue;
      node.style.transition = `transform ${DURATION_MS}ms ${EASING}`;
      node.style.transform = "";
    }

    prevRects.current = nextRects;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- orderKey (join de id-uri) + setul de excludere sunt dependențele reale, nu containerRef
  }, [orderKey.join("|"), [...exclude].sort().join("|")]);
}
