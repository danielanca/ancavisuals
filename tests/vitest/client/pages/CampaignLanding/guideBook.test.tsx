/*
 * Purpose: while on screen the wedding-guide book opens, bolds each chapter in turn,
 * closes, and reopens 15 seconds later.
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import GuideBook from "src/client/pages/CampaignLanding/GuideBook";

let fire: (visible: boolean) => void = () => {};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(cb: (entries: { isIntersecting: boolean }[]) => void) { fire = (v) => cb([{ isIntersecting: v }]); }
    observe() {} disconnect() {}
  });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const book = () => screen.getByRole("button", { name: "Răsfoiește Ghidul Mirilor" });
const bold = () => screen.getAllByRole("listitem").filter((li) => li.className.includes("font-bold")).map((li) => li.textContent);

describe("GuideBook", () => {
  test("opens on screen, walks the chapters once, closes, reopens after 15s", () => {
    render(<GuideBook />);
    expect(book().className).not.toContain("guide-book--open");

    act(() => { fire(true); vi.advanceTimersByTime(600); });
    expect(book().className).toContain("guide-book--open");

    act(() => { vi.advanceTimersByTime(450 + 9 * 70 + 300); });
    expect(bold()).toEqual(["01Primii pași"]);
    act(() => { vi.advanceTimersByTime(650); });
    expect(bold()).toEqual(["02Furnizorii și ordinea rezervărilor"]);

    act(() => { vi.advanceTimersByTime(650 * 8); });
    expect(bold()).toEqual([]);
    expect(book().className).not.toContain("guide-book--open");

    act(() => { vi.advanceTimersByTime(15_000); });
    expect(book().className).toContain("guide-book--open");
  });

  test("closes when scrolled away", () => {
    render(<GuideBook />);
    act(() => { fire(true); vi.advanceTimersByTime(600); });
    act(() => { fire(false); });
    expect(book().className).not.toContain("guide-book--open");
  });

  test("a click opens the book at once and is not a download link", () => {
    render(<GuideBook />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    act(() => { fireEvent.click(book()); });
    expect(book().className).toContain("guide-book--open");
  });

  // Owner's rule: on phones there is no room for the open book — it never opens, it only spins.
  test("on phones it never opens — not on screen, not on tap, not on hover", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("max-width") }));
    render(<GuideBook />);
    act(() => { fire(true); vi.advanceTimersByTime(5_000); });
    expect(book().className).not.toContain("guide-book--open");
    act(() => { fireEvent.click(book()); fireEvent.mouseEnter(book()); vi.advanceTimersByTime(5_000); });
    expect(book().className).not.toContain("guide-book--open");
  });
});
