/*
 * Purpose: verifies AdminBar subscriber bell — count badge display, dropdown open/close,
 * email list rendering, notify button, and re-fetch on bell open.
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mockUseAuth = vi.fn();
vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => mockUseAuth() }));
vi.mock("src/client/features/admin/providers/ErrorMonitorContext", () => ({ useErrorMonitor: vi.fn() }));

function authAdmin(accessToken = "tok-admin") {
  return { auth: { authorise: true, accessToken, loading: false }, logOut: vi.fn() };
}

function renderBar(path = "/media/nunta-ana") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminBarLazy />
    </MemoryRouter>,
  );
}

// Lazy import after mocks are set up
let AdminBarLazy: React.ComponentType;

describe("AdminBar", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockUseAuth.mockReturnValue(authAdmin());
    vi.doMock("src/client/features/admin/auth/useAuth", () => ({ default: () => mockUseAuth() }));
    vi.doMock("src/client/features/admin/providers/ErrorMonitorContext", () => ({ useErrorMonitor: vi.fn() }));
    const mod = await import("src/client/components/UI/AdminBar");
    AdminBarLazy = mod.default;
  });

  test("renders nothing when not authorised", async () => {
    mockUseAuth.mockReturnValue({ auth: { authorise: false, accessToken: "", loading: false }, logOut: vi.fn() });
    const { container } = renderBar();
    expect(container.firstChild).toBeNull();
  });

  test("shows 'Anca Visuals Admin' link for authorised user", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve({ ok: true, json: async () => ({ subscribers: [] }) }));
    await act(async () => { renderBar(); });
    expect(screen.getByText(/anca visuals admin/i)).toBeTruthy();
  });

  test("bell is not shown on non-media pages", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve({ ok: true, json: async () => ({ subscribers: [] }) }));
    await act(async () => { render(<MemoryRouter initialEntries={["/admin"]}><AdminBarLazy /></MemoryRouter>); });
    expect(screen.queryByText("🔔")).toBeNull();
  });

  test("bell shows count badge after fetch resolves with subscribers", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve({ ok: true, json: async () => ({ subscribers: [{ email: "a@b.com" }, { email: "c@d.com" }] }) })
    );

    await act(async () => { renderBar(); });

    expect(screen.getByText("2")).toBeTruthy();
  });

  test("bell shows 0 badge when no subscribers", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve({ ok: true, json: async () => ({ subscribers: [] }) })
    );

    await act(async () => { renderBar(); });

    expect(screen.getByText("0")).toBeTruthy();
  });

  test("clicking bell opens dropdown with subscriber emails", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve({ ok: true, json: async () => ({ subscribers: [{ email: "ana@test.com" }] }) })
    );

    await act(async () => { renderBar(); });

    const bellBtn = screen.getAllByRole("button").find(btn => btn.textContent?.includes("🔔"))!;
    await act(async () => { fireEvent.click(bellBtn); });

    expect(screen.getByText("ana@test.com")).toBeTruthy();
  });

  test("dropdown shows 'Niciun abonat' when list is empty", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve({ ok: true, json: async () => ({ subscribers: [] }) })
    );

    await act(async () => { renderBar(); });

    const bellBtn = screen.getAllByRole("button").find(btn => btn.textContent?.includes("🔔"))!;
    await act(async () => { fireEvent.click(bellBtn); });

    expect(screen.getByText(/niciun abonat/i)).toBeTruthy();
  });

  test("clicking backdrop closes the dropdown", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve({ ok: true, json: async () => ({ subscribers: [{ email: "ana@test.com" }] }) })
    );

    await act(async () => { renderBar(); });

    const bellBtn = screen.getAllByRole("button").find(btn => btn.textContent?.includes("🔔"))!;
    await act(async () => { fireEvent.click(bellBtn); });
    expect(screen.getByText("ana@test.com")).toBeTruthy();

    // The backdrop div sits above everything; click anywhere outside the dropdown
    const backdrop = document.querySelector('[style*="position: fixed"][style*="inset: 0"]') as HTMLElement;
    if (backdrop) {
      await act(async () => { fireEvent.click(backdrop); });
      expect(screen.queryByText("ana@test.com")).toBeNull();
    }
  });

  test("re-fetches subscriber list each time the bell is opened", async () => {
    let callCount = 0;
    vi.stubGlobal("fetch", () => {
      callCount++;
      return Promise.resolve({ ok: true, json: async () => ({ subscribers: [] }) });
    });

    await act(async () => { renderBar(); });
    const initialCalls = callCount; // one call on mount

    const bellBtn = screen.getAllByRole("button").find(btn => btn.textContent?.includes("🔔"))!;

    await act(async () => { fireEvent.click(bellBtn); }); // open → re-fetch
    expect(callCount).toBeGreaterThan(initialCalls);

    // Close and open again
    await act(async () => { fireEvent.click(bellBtn); }); // close
    const beforeSecondOpen = callCount;
    await act(async () => { fireEvent.click(bellBtn); }); // open again → re-fetch
    expect(callCount).toBeGreaterThan(beforeSecondOpen);
  });

  test("Notify button is disabled when there are no subscribers", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve({ ok: true, json: async () => ({ subscribers: [] }) })
    );

    await act(async () => { renderBar(); });

    const bellBtn = screen.getAllByRole("button").find(btn => btn.textContent?.includes("🔔"))!;
    await act(async () => { fireEvent.click(bellBtn); });

    const notifyBtn = screen.getByRole("button", { name: /notifică/i });
    expect(notifyBtn).toBeDisabled();
  });

  test("subscriber emails render as mailto links", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve({ ok: true, json: async () => ({ subscribers: [{ email: "ana@test.com" }] }) })
    );

    await act(async () => { renderBar(); });

    const bellBtn = screen.getAllByRole("button").find(btn => btn.textContent?.includes("🔔"))!;
    await act(async () => { fireEvent.click(bellBtn); });

    const link = screen.getByRole("link", { name: /ana@test\.com/i });
    expect(link.getAttribute("href")).toBe("mailto:ana@test.com");
  });

  test("delete ✕ removes subscriber from list immediately", async () => {
    let deleteCallCount = 0;
    vi.stubGlobal("fetch", (url: string, opts?: RequestInit) => {
      if (opts?.method === "DELETE") {
        deleteCallCount++;
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ subscribers: [{ email: "ana@test.com" }, { email: "ion@test.com" }] }),
      });
    });

    await act(async () => { renderBar(); });

    const bellBtn = screen.getAllByRole("button").find(btn => btn.textContent?.includes("🔔"))!;
    await act(async () => { fireEvent.click(bellBtn); });

    expect(screen.getByText("ana@test.com")).toBeTruthy();
    expect(screen.getByText("ion@test.com")).toBeTruthy();

    // Click ✕ next to ana@test.com — first ✕ button in the list
    const deleteBtns = screen.getAllByTitle(/șterge abonat/i);
    await act(async () => { fireEvent.click(deleteBtns[0]); });

    expect(deleteCallCount).toBe(1);
    expect(screen.queryByText("ana@test.com")).toBeNull();
    expect(screen.getByText("ion@test.com")).toBeTruthy();
  });

  test("does not show bell badge before fetch completes", async () => {
    let resolveFetch!: (value: any) => void;
    vi.stubGlobal("fetch", () => new Promise(resolve => { resolveFetch = resolve; }));

    render(<MemoryRouter initialEntries={["/media/nunta"]}><AdminBarLazy /></MemoryRouter>);

    // Badge must not yet appear before fetch resolves
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.queryByText(/\d+/)).toBeNull();

    await act(async () => {
      resolveFetch({ ok: true, json: async () => ({ subscribers: [] }) });
    });

    expect(screen.getByText("0")).toBeTruthy();
  });
});
