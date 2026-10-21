/*
 * Purpose: the ordering operations of the offer photo organizer — grouping by event, moving whole
 * events, dropping before/after a photo, swapping and replacing selected photos.
 */
import { describe, expect, test } from "vitest";
import {
  addBesideEvent, eventSwitches, eventsInOrder, formatEventLabel, groupByEvent, moveBeside, moveEvent, moveToEdge, replaceAt, swapSelected,
} from "src/client/features/admin/components/offerOrganizerOrder";

const photo = (id: string, event?: string) => ({ id, sourceAlbumSlug: event });
const ids = (list: Array<{ id: string }>) => list.map((item) => item.id).join(",");

// a = event A, b = event B, x = no event
const mixed = [photo("a1", "A"), photo("b1", "B"), photo("a2", "A"), photo("x1"), photo("b2", "B"), photo("a3", "A")];

describe("offer organizer order", () => {
  test("a library photo goes right after the last photo of its album; a new album goes at the end", () => {
    const list = [photo("a1", "A"), photo("a2", "A"), photo("b1", "B"), photo("x1")];
    expect(ids(addBesideEvent(list, [photo("a3", "A")]))).toBe("a1,a2,a3,b1,x1");
    expect(ids(addBesideEvent(list, [photo("b2", "B"), photo("b3", "B")]))).toBe("a1,a2,b1,b2,b3,x1");
    expect(ids(addBesideEvent(list, [photo("c1", "C"), photo("c2", "C")]))).toBe("a1,a2,b1,x1,c1,c2");
    expect(ids(addBesideEvent(list, [photo("a1", "A")]))).toBe("a1,a2,b1,x1");
  });

  test("groups each event's photos together, keeping the order of first appearance", () => {
    expect(eventsInOrder(mixed)).toEqual(["A", "B", "Alte poze"]);
    expect(eventSwitches(mixed)).toBe(3);
    const grouped = groupByEvent(mixed);
    expect(ids(grouped)).toBe("a1,a2,a3,b1,b2,x1");
    expect(eventSwitches(grouped)).toBe(0);
  });

  test("moves a whole event earlier or later", () => {
    expect(ids(moveEvent(mixed, "B", -1))).toBe("b1,b2,a1,a2,a3,x1");
    expect(ids(moveEvent(mixed, "A", 1))).toBe("b1,b2,a1,a2,a3,x1");
    expect(ids(moveEvent(mixed, "A", -1))).toBe("a1,a2,a3,b1,b2,x1");
  });

  test("drops photos before or after a photo, including after the last one", () => {
    expect(ids(moveBeside(mixed, ["a3"], "a1", "before"))).toBe("a3,a1,b1,a2,x1,b2");
    expect(ids(moveBeside(mixed, ["a1", "a2"], "a3", "after"))).toBe("b1,x1,b2,a3,a1,a2");
    expect(ids(moveToEdge(mixed, ["x1", "b2"], "start"))).toBe("x1,b2,a1,b1,a2,a3");
  });

  test("swaps in selection order: 2 trade places, 2N swap first half with second half", () => {
    expect(ids(swapSelected(mixed, ["a1", "a3"]))).toBe("a3,b1,a2,x1,b2,a1");
    expect(ids(swapSelected(mixed, ["a1", "b1", "b2", "a3"]))).toBe("b2,a3,a2,x1,a1,b1");
    expect(ids(swapSelected(mixed, ["a1", "b1", "b2"]))).toBe(ids(mixed));
  });

  test("replaces photos exactly in their positions", () => {
    const next = replaceAt(mixed, ["b1", "x1"], [photo("c1", "C"), photo("c2", "C")]);
    expect(ids(next)).toBe("a1,c1,a2,c2,b2,a3");
  });

  test("labels dated albums readably", () => {
    expect(formatEventLabel("21martie2026")).toBe("21 martie 2026");
    expect(formatEventLabel("rebeca-florea")).toBe("rebeca florea");
  });
});

describe("desktop photos missing on mobile", () => {
  test("lists them in desktop order", async () => {
    const { missingFrom } = await import("src/client/features/admin/components/offerOrganizerOrder");
    const desktop = [photo("a1", "A"), photo("b1", "B"), photo("a2", "A"), photo("c1", "C")];
    const mobile = [photo("a2", "A"), photo("a1", "A")];
    expect(missingFrom(desktop, mobile).map((item) => item.id)).toEqual(["b1", "c1"]);
  });
});

describe("take the order from the other device", () => {
  test("events and photos follow the other list; nothing is added or removed", async () => {
    const { adoptOrder } = await import("src/client/features/admin/components/offerOrganizerOrder");
    // mobile: A first; desktop: B first, a2 before a1, plus c1 only on desktop
    const mobile = [photo("a1", "A"), photo("a2", "A"), photo("a3", "A"), photo("b1", "B"), photo("m1", "M")];
    const desktop = [photo("b1", "B"), photo("c1", "C"), photo("a2", "A"), photo("a1", "A")];
    // B, then A (a2, a1 as on desktop, a3 only here after them), then M (only on mobile) at the end
    expect(ids(adoptOrder(mobile, desktop))).toBe("b1,a2,a1,a3,m1");
  });
});
