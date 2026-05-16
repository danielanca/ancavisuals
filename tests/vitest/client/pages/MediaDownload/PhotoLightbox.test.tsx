import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach } from "vitest";
import PhotoLightbox from "src/client/pages/MediaDownload/PhotoLightbox";

const PHOTOS = [
  "https://cdn.example.com/photo1.jpg",
  "https://cdn.example.com/photo2.jpg",
  "https://cdn.example.com/photo3.jpg",
];

function renderLightbox(overrides: Partial<React.ComponentProps<typeof PhotoLightbox>> = {}) {
  return render(
    <PhotoLightbox
      photos={PHOTOS}
      currentIndex={1}
      onClose={vi.fn()}
      onNext={vi.fn()}
      onPrev={vi.fn()}
      {...overrides}
    />,
  );
}

describe("PhotoLightbox", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("renders the current photo", () => {
    renderLightbox();
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("photo2.jpg");
  });

  test("shows counter with correct position", () => {
    renderLightbox({ currentIndex: 1 });
    expect(screen.getByText("2 / 3")).toBeTruthy();
  });

  test("calls onNext when next button clicked", () => {
    const onNext = vi.fn();
    renderLightbox({ onNext });
    fireEvent.click(screen.getByLabelText("Poza următoare"));
    expect(onNext).toHaveBeenCalledOnce();
  });

  test("calls onPrev when prev button clicked", () => {
    const onPrev = vi.fn();
    renderLightbox({ onPrev });
    fireEvent.click(screen.getByLabelText("Poza anterioară"));
    expect(onPrev).toHaveBeenCalledOnce();
  });

  test("prev button is disabled on first photo", () => {
    renderLightbox({ currentIndex: 0 });
    expect(screen.getByLabelText("Poza anterioară")).toBeDisabled();
  });

  test("next button is disabled on last photo", () => {
    renderLightbox({ currentIndex: 2 });
    expect(screen.getByLabelText("Poza următoare")).toBeDisabled();
  });

  test("print button not rendered without onTogglePrint prop", () => {
    renderLightbox();
    expect(screen.queryByLabelText(/imprimare/i)).toBeNull();
  });

  test("print button text is wrapped in span for mobile hiding", () => {
    const { container } = renderLightbox({
      selectedPrint: new Set(),
      onTogglePrint: vi.fn(),
      getFileName: (_src, index) => `photo${index + 1}.jpg`,
    });

    const printBtn = screen.getByLabelText("Adaugă la imprimare");
    const span = printBtn.querySelector("span");
    expect(span).toBeTruthy();
    expect(span!.textContent).toContain("Adaugă la imprimare");
  });

  test("print button shows active label when photo is in print set", () => {
    renderLightbox({
      selectedPrint: new Set(["photo2.jpg"]),
      onTogglePrint: vi.fn(),
      getFileName: (_src, index) => `photo${index + 1}.jpg`,
    });

    expect(screen.getByLabelText("Elimină din imprimare")).toBeTruthy();
  });

  test("onTogglePrint called with correct filename when print button clicked", () => {
    const onTogglePrint = vi.fn();
    renderLightbox({
      selectedPrint: new Set(),
      onTogglePrint,
      getFileName: (_src, index) => `photo${index + 1}.jpg`,
    });

    fireEvent.click(screen.getByLabelText("Adaugă la imprimare"));
    expect(onTogglePrint).toHaveBeenCalledWith("photo2.jpg");
  });

  test("Escape key calls onClose", () => {
    const onClose = vi.fn();
    renderLightbox({ onClose });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
