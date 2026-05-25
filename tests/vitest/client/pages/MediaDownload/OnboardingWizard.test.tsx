import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import OnboardingWizard from "src/client/pages/MediaDownload/Onboardingwizard";

const STORAGE_KEY = "av:onboarding:done";

// DOM targets managed by afterEach — prevents leakage when assertions throw
let mountedElements: Element[] = [];

function mountEl(tag: string, attr: string, rect: Partial<DOMRect> = {}) {
  const el = document.createElement(tag);
  el.setAttribute("data-onboarding", attr);
  el.getBoundingClientRect = () =>
    ({ top: 100, bottom: 200, left: 50, right: 250, width: 200, height: 100, ...rect } as DOMRect);
  (el as HTMLElement).scrollIntoView = vi.fn();
  document.body.appendChild(el);
  mountedElements.push(el);
  return el;
}

function mountAllTargets() {
  mountEl("div", "photo");
  mountEl("div", "pager", { top: 300, bottom: 340 });
  mountEl("div", "subscribe", { top: 400, bottom: 440 });
  mountEl("button", "download-btn", { top: 500, bottom: 540 });
  mountEl("button", "print-btn", { top: 600, bottom: 640 });
  mountEl("div", "print-section", { top: 700, bottom: 840, height: 140 });
}

describe("OnboardingWizard", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    mountedElements = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    mountedElements.forEach(el => el.parentNode?.removeChild(el));
    mountedElements = [];
  });

  test("does not render without forceShow", () => {
    mountAllTargets();
    render(<OnboardingWizard />);
    expect(screen.queryByText(/sari peste tutorial/i)).toBeNull();
  });

  test("does not start when forceShow=false", () => {
    mountAllTargets();
    const onStart = vi.fn();
    render(<OnboardingWizard forceShow={false} onStart={onStart} />);
    act(() => { vi.runAllTimers(); });
    expect(onStart).not.toHaveBeenCalled();
  });

  test("starts and calls onStart when forceShow=true", () => {
    mountAllTargets();
    const onStart = vi.fn();
    render(<OnboardingWizard forceShow={true} onStart={onStart} />);
    act(() => { vi.runAllTimers(); });
    expect(onStart).toHaveBeenCalledOnce();
  });

  test("shows the red skip button when tutorial is active", () => {
    mountAllTargets();
    render(<OnboardingWizard forceShow={true} />);
    act(() => { vi.runAllTimers(); });
    expect(screen.getByText(/sari peste tutorial/i)).toBeTruthy();
  });

  test("step counter starts at 1 / 6", () => {
    mountAllTargets();
    render(<OnboardingWizard forceShow={true} />);
    act(() => { vi.runAllTimers(); });
    expect(screen.getByText(/1\s*\/\s*6/)).toBeTruthy();
  });

  test("Următorul button advances step counter", () => {
    mountAllTargets();
    render(<OnboardingWizard forceShow={true} />);
    act(() => { vi.runAllTimers(); });

    fireEvent.click(screen.getByText(/următorul/i));
    act(() => { vi.runAllTimers(); });

    expect(screen.getByText(/2\s*\/\s*6/)).toBeTruthy();
  });

  test("Înapoi button goes back to previous step", () => {
    mountAllTargets();
    render(<OnboardingWizard forceShow={true} />);
    act(() => { vi.runAllTimers(); });

    fireEvent.click(screen.getByText(/următorul/i));
    act(() => { vi.runAllTimers(); });
    expect(screen.getByText(/2\s*\/\s*6/)).toBeTruthy();

    fireEvent.click(screen.getByText(/înapoi/i));
    act(() => { vi.runAllTimers(); });
    expect(screen.getByText(/1\s*\/\s*6/)).toBeTruthy();
  });

  test("Înapoi is not shown on the first step", () => {
    mountAllTargets();
    render(<OnboardingWizard forceShow={true} />);
    act(() => { vi.runAllTimers(); });
    expect(screen.queryByText(/înapoi/i)).toBeNull();
  });

  test("last step shows Gata! button instead of Următorul", () => {
    mountAllTargets();
    render(<OnboardingWizard forceShow={true} />);
    act(() => { vi.runAllTimers(); });

    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText(/următorul|gata/i));
      act(() => { vi.runAllTimers(); });
    }

    expect(screen.getByText(/gata/i)).toBeTruthy();
    expect(screen.queryByText(/următorul/i)).toBeNull();
  });

  test("Gata! calls onClose and sets localStorage done flag", () => {
    mountAllTargets();
    const onClose = vi.fn();
    render(<OnboardingWizard forceShow={true} onClose={onClose} />);
    act(() => { vi.runAllTimers(); });

    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByText(/următorul|gata/i));
      act(() => { vi.runAllTimers(); });
    }

    fireEvent.click(screen.getByText(/gata/i));
    act(() => { vi.runAllTimers(); });

    expect(onClose).toHaveBeenCalledOnce();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  test("skip top button calls onClose and sets localStorage", () => {
    mountAllTargets();
    const onClose = vi.fn();
    render(<OnboardingWizard forceShow={true} onClose={onClose} />);
    act(() => { vi.runAllTimers(); });

    fireEvent.click(screen.getByText(/sari peste tutorial/i));

    expect(onClose).toHaveBeenCalledOnce();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  test("skip via ✕ close button in tooltip header", () => {
    mountAllTargets();
    const onClose = vi.fn();
    render(<OnboardingWizard forceShow={true} onClose={onClose} />);
    act(() => { vi.runAllTimers(); });

    // The ✕ button inside the tooltip has aria-label="Sari peste" (exact, without "tutorial")
    fireEvent.click(screen.getByLabelText("Sari peste"));

    expect(onClose).toHaveBeenCalledOnce();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  test("Următorul is stable across re-renders (stale closure regression)", () => {
    // Regression: inline onClose prop recreated each render caused goToStep to
    // reference a stale closure, resetting wizard to step 0 on every click.
    mountAllTargets();
    const { rerender } = render(<OnboardingWizard forceShow={true} onClose={vi.fn()} />);
    act(() => { vi.runAllTimers(); });

    // Simulate parent re-render with a new onClose reference
    rerender(<OnboardingWizard forceShow={true} onClose={vi.fn()} />);
    act(() => { vi.runAllTimers(); });

    fireEvent.click(screen.getByText(/următorul/i));
    act(() => { vi.runAllTimers(); });

    // Must be step 2, not reset back to step 1
    expect(screen.getByText(/2\s*\/\s*6/)).toBeTruthy();
  });

  test("skips steps whose target element is absent from the DOM", () => {
    // Mount all targets EXCEPT pager and subscribe — wizard should skip them
    mountEl("div", "photo");
    // pager absent
    // subscribe absent
    mountEl("button", "download-btn", { top: 500, bottom: 540 });
    mountEl("button", "print-btn", { top: 600, bottom: 640 });
    mountEl("div", "print-section", { top: 700, bottom: 840, height: 140 });

    render(<OnboardingWizard forceShow={true} />);
    act(() => { vi.runAllTimers(); });

    // Step 1 is shown (photo)
    expect(screen.getByText(/1\s*\/\s*6/)).toBeTruthy();

    // Next: pager absent → skip to subscribe (absent) → skip to download-btn (step 4)
    // Counter should jump to 4/6
    fireEvent.click(screen.getByText(/următorul/i));
    act(() => { vi.runAllTimers(); });

    expect(screen.getByText(/4\s*\/\s*6/)).toBeTruthy();
  });
});
