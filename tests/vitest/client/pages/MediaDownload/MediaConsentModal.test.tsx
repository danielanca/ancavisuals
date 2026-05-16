import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach } from "vitest";
import MediaConsentModal from "src/client/pages/MediaDownload/MediaConsentModal";

const CONSENT_KEY = "av:consent:test-album";

function renderModal(overrides: Partial<React.ComponentProps<typeof MediaConsentModal>> = {}) {
  return render(
    <MediaConsentModal
      slug="test-album"
      retention={null}
      onAccepted={vi.fn()}
      {...overrides}
    />,
  );
}

describe("MediaConsentModal", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) })));
  });

  test("shows modal on first visit (no consent in localStorage)", () => {
    renderModal();
    expect(screen.getByText("Materialele tale sunt gata")).toBeTruthy();
  });

  test("does not show modal when consent already given", () => {
    localStorage.setItem(CONSENT_KEY, "1");
    const { container } = renderModal();
    expect(container.firstChild).toBeNull();
  });

  test("accept button disabled until checkbox checked", () => {
    renderModal();
    const btn = screen.getByRole("button", { name: /am înțeles, continuă/i });
    expect(btn).toBeDisabled();
  });

  test("accept button enabled after checking checkbox", () => {
    renderModal();
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    const btn = screen.getByRole("button", { name: /am înțeles, continuă/i });
    expect(btn).not.toBeDisabled();
  });

  test("calls onAccepted after accepting", async () => {
    const onAccepted = vi.fn();
    renderModal({ onAccepted });

    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /am înțeles, continuă/i }));
    });

    expect(onAccepted).toHaveBeenCalledOnce();
  });

  test("sets consent localStorage key after accepting", async () => {
    renderModal();

    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /am înțeles, continuă/i }));
    });

    expect(localStorage.getItem(CONSENT_KEY)).toBe("1");
  });

  test("admin modal shows different title and button", () => {
    renderModal({ isAdmin: true });
    expect(screen.getByText("Acces administrare materiale")).toBeTruthy();
    expect(screen.getByRole("button", { name: /am înțeles$/i })).toBeTruthy();
  });

  test("admin does NOT see consent checkbox", () => {
    renderModal({ isAdmin: true });
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  test("admin accept calls onAccepted immediately", async () => {
    const onAccepted = vi.fn();
    renderModal({ isAdmin: true, onAccepted });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /am înțeles$/i }));
    });

    expect(onAccepted).toHaveBeenCalledOnce();
  });

  test("posts consent to API when non-admin accepts", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetchMock);

    renderModal();
    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /am înțeles, continuă/i }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/album/test-album/consent",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
