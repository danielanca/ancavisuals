import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import OnboardingWizard, { ONBOARDING_STORAGE_KEY as STORAGE_KEY } from "src/client/pages/MediaDownload/Onboardingwizard";

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

const ALL_TARGETS = ["hub", "hub-print", "hub-share", "hub-delivery", "hub-download", "hub-sent", "hub-updates", "photo"];

function mountAllTargets() {
  ALL_TARGETS.forEach((target, index) => mountEl("div", target, { top: 100 + index * 60, bottom: 140 + index * 60 }));
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
    expect(screen.queryByText(/următorul/i)).toBeNull();
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

  test("is mandatory: no skip button and the backdrop does not close it", () => {
    mountAllTargets();
    const onClose = vi.fn();
    const { container } = render(<OnboardingWizard forceShow={true} onClose={onClose} />);
    act(() => { vi.runAllTimers(); });
    expect(screen.queryByText(/sari peste/i)).toBeNull();
    expect(screen.queryByLabelText("Sari peste")).toBeNull();
    container.querySelectorAll("div").forEach((div) => fireEvent.click(div));
    expect(onClose).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test("first step introduces the action hub", () => {
    mountAllTargets();
    render(<OnboardingWizard forceShow={true} />);
    act(() => { vi.runAllTimers(); });
    expect(screen.getByText("👋 Tot ce poți face e aici, sus")).toBeTruthy();
  });

  test("step counter starts at 1 / 8", () => {
    mountAllTargets();
    render(<OnboardingWizard forceShow={true} />);
    act(() => { vi.runAllTimers(); });
    expect(screen.getByText(/1\s*\/\s*8/)).toBeTruthy();
  });

  test("Următorul button advances step counter", () => {
    mountAllTargets();
    render(<OnboardingWizard forceShow={true} />);
    act(() => { vi.runAllTimers(); });

    fireEvent.click(screen.getByText(/următorul/i));
    act(() => { vi.runAllTimers(); });

    expect(screen.getByText(/2\s*\/\s*8/)).toBeTruthy();
  });

  test("Înapoi button goes back to previous step", () => {
    mountAllTargets();
    render(<OnboardingWizard forceShow={true} />);
    act(() => { vi.runAllTimers(); });

    fireEvent.click(screen.getByText(/următorul/i));
    act(() => { vi.runAllTimers(); });
    expect(screen.getByText(/2\s*\/\s*8/)).toBeTruthy();

    fireEvent.click(screen.getByText(/înapoi/i));
    act(() => { vi.runAllTimers(); });
    expect(screen.getByText(/1\s*\/\s*8/)).toBeTruthy();
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

    for (let i = 0; i < 7; i++) {
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

    for (let i = 0; i < 7; i++) {
      fireEvent.click(screen.getByText(/următorul|gata/i));
      act(() => { vi.runAllTimers(); });
    }

    fireEvent.click(screen.getByText(/gata/i));
    act(() => { vi.runAllTimers(); });

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
    expect(screen.getByText(/2\s*\/\s*8/)).toBeTruthy();
  });

  test("skips steps whose target element is absent from the DOM", () => {
    // A guest (not the couple) has no "hub-sent"; an album without photos has no print/share/download.
    ["hub", "hub-delivery", "hub-updates", "photo"].forEach((target) => mountEl("div", target));

    render(<OnboardingWizard forceShow={true} />);
    act(() => { vi.runAllTimers(); });
    expect(screen.getByText(/1\s*\/\s*8/)).toBeTruthy();

    // hub-print and hub-share are absent → jumps to hub-delivery (step 4)
    fireEvent.click(screen.getByText(/următorul/i));
    act(() => { vi.runAllTimers(); });
    expect(screen.getByText(/4\s*\/\s*8/)).toBeTruthy();
  });
});
