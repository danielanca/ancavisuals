import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach } from "vitest";
import OnboardingWizard from "src/client/pages/MediaDownload/Onboardingwizard";

const STORAGE_KEY = "av:onboarding:done";

// Minimal DOM stubs for elements the wizard targets
function mountTargets() {
  const mockRect = { top: 100, bottom: 200, left: 50, right: 250, width: 200, height: 100 } as DOMRect;

  const photo = document.createElement("div");
  photo.setAttribute("data-onboarding", "photo");
  photo.getBoundingClientRect = () => mockRect;
  photo.scrollIntoView = vi.fn();
  document.body.appendChild(photo);

  const pagerNext = document.createElement("button");
  pagerNext.setAttribute("data-onboarding", "pager-next");
  pagerNext.getBoundingClientRect = () => ({ top: 300, bottom: 340, left: 200, right: 280, width: 80, height: 40 } as DOMRect);
  pagerNext.scrollIntoView = vi.fn();
  document.body.appendChild(pagerNext);

  return () => {
    document.body.removeChild(photo);
    document.body.removeChild(pagerNext);
  };
}

describe("OnboardingWizard", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  test("does NOT auto-start on mount without forceShow", () => {
    const cleanup = mountTargets();
    render(<OnboardingWizard />);
    // No tooltip should appear without forceShow
    expect(screen.queryByRole("button", { name: /sari peste/i })).toBeNull();
    cleanup();
  });

  test("starts when forceShow=true and calls onStart", async () => {
    const onStart = vi.fn();
    const cleanup = mountTargets();

    render(<OnboardingWizard forceShow={true} onStart={onStart} />);
    act(() => { vi.runAllTimers(); });

    expect(onStart).toHaveBeenCalledOnce();
    cleanup();
  });

  test("shows prominent skip button during tutorial", async () => {
    const cleanup = mountTargets();

    render(<OnboardingWizard forceShow={true} />);
    act(() => { vi.runAllTimers(); });

    expect(screen.getByText(/sari peste tutorial/i)).toBeTruthy();
    cleanup();
  });

  test("skip button calls onClose and sets localStorage", async () => {
    const onClose = vi.fn();
    const cleanup = mountTargets();

    render(<OnboardingWizard forceShow={true} onClose={onClose} />);
    act(() => { vi.runAllTimers(); });

    fireEvent.click(screen.getByText(/sari peste tutorial/i));

    expect(onClose).toHaveBeenCalledOnce();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
    cleanup();
  });

  test("step counter shows 1 / N on first step", async () => {
    const cleanup = mountTargets();

    render(<OnboardingWizard forceShow={true} />);
    act(() => { vi.runAllTimers(); });

    const indicator = screen.getByText(/1\s*\/\s*\d+/);
    expect(indicator).toBeTruthy();
    cleanup();
  });

  test("does not start when forceShow=false", () => {
    const onStart = vi.fn();
    const cleanup = mountTargets();

    render(<OnboardingWizard forceShow={false} onStart={onStart} />);
    act(() => { vi.runAllTimers(); });

    expect(onStart).not.toHaveBeenCalled();
    cleanup();
  });
});
