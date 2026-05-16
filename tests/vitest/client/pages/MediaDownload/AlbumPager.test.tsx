import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach } from "vitest";
import AlbumPager from "src/client/pages/Portfolio/AlbumPager";

function renderPager(overrides: Partial<React.ComponentProps<typeof AlbumPager>> = {}) {
  return render(
    <AlbumPager
      mode="none"
      currentPage={2}
      totalPages={5}
      pageSize={20}
      totalItems={100}
      shownCount={20}
      allOnPageSelected={false}
      onFirst={vi.fn()}
      onPrev={vi.fn()}
      onNext={vi.fn()}
      onLast={vi.fn()}
      onGoTo={vi.fn()}
      onToggleSelectPage={vi.fn()}
      {...overrides}
    />,
  );
}

describe("AlbumPager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("renders prev and next buttons", () => {
    renderPager();
    expect(screen.getByLabelText("Mergi la pagina")).toBeTruthy();
    expect(screen.getByText("Anterior")).toBeTruthy();
    expect(screen.getByText("Următorul")).toBeTruthy();
  });

  test("calls onNext when next button clicked", () => {
    const onNext = vi.fn();
    renderPager({ onNext });
    fireEvent.click(screen.getByText("Următorul").closest("button")!);
    expect(onNext).toHaveBeenCalledOnce();
  });

  test("calls onPrev when prev button clicked", () => {
    const onPrev = vi.fn();
    renderPager({ onPrev });
    fireEvent.click(screen.getByText("Anterior").closest("button")!);
    expect(onPrev).toHaveBeenCalledOnce();
  });

  test("prev button disabled on first page", () => {
    renderPager({ currentPage: 1 });
    const prevBtn = screen.getByText("Anterior").closest("button")!;
    expect(prevBtn).toBeDisabled();
  });

  test("next button disabled on last page", () => {
    renderPager({ currentPage: 5, totalPages: 5 });
    const nextBtn = screen.getByText("Următorul").closest("button")!;
    expect(nextBtn).toBeDisabled();
  });

  test("data-onboarding prop forwarded to root element", () => {
    const { container } = renderPager({ "data-onboarding": "pager" });
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("data-onboarding")).toBe("pager");
  });

  test("pager-prev attribute on prev button", () => {
    renderPager();
    const prevBtn = screen.getByText("Anterior").closest("button")!;
    expect(prevBtn.getAttribute("data-onboarding")).toBe("pager-prev");
  });

  test("pager-next attribute on next button", () => {
    renderPager();
    const nextBtn = screen.getByText("Următorul").closest("button")!;
    expect(nextBtn.getAttribute("data-onboarding")).toBe("pager-next");
  });

  test("pager-first attribute on first button", () => {
    renderPager();
    const firstBtn = screen.getByText("Primul").closest("button")!;
    expect(firstBtn.getAttribute("data-onboarding")).toBe("pager-first");
  });

  test("pager-last attribute on last button", () => {
    renderPager();
    const lastBtn = screen.getByText("Ultimul").closest("button")!;
    expect(lastBtn.getAttribute("data-onboarding")).toBe("pager-last");
  });

  test("page input has pager-input data attribute", () => {
    renderPager();
    const input = screen.getByLabelText("Mergi la pagina");
    const wrapper = input.closest("[data-onboarding='pager-input']");
    expect(wrapper).toBeTruthy();
  });

  test("calls onGoTo with correct page on Enter", () => {
    const onGoTo = vi.fn();
    renderPager({ onGoTo });
    const input = screen.getByLabelText("Mergi la pagina");
    fireEvent.change(input, { target: { value: "4" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onGoTo).toHaveBeenCalledWith(4);
  });

  test("shows correct range info", () => {
    renderPager({ currentPage: 2, pageSize: 20, totalItems: 100, shownCount: 20 });
    expect(screen.getByText("21-40 din 100")).toBeTruthy();
  });

  test("shows select page button in print mode", () => {
    renderPager({ mode: "print" });
    expect(screen.getByText("Selectează pagina")).toBeTruthy();
  });
});
