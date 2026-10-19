import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import PromisesPanel, { whenText } from "src/client/features/admin/components/PromisesPanel";

const promises = [
  { id: "p1", albumSlug: "botez-maria", clients: ["Maria"], label: "📅 Estimare", text: "Gata pe 8.", estimateDate: "2026-11-08", daysLeft: -2, status: "overdue" },
  { id: "p2", albumSlug: "nunta-ana", clients: ["Ana & Ion"], label: "⏳ Termen actualizat", text: "Mai durează 10 zile.", estimateDate: "2026-11-13", daysLeft: 3, status: "soon" },
  { id: "p3", albumSlug: "nunta-dan", clients: [], label: "📅 Estimare", text: "Decembrie.", estimateDate: "2026-12-20", daysLeft: 40, status: "later" },
];

afterEach(() => vi.unstubAllGlobals());

test("readable time left", () => {
  expect(whenText(-2)).toBe("depășit cu 2 zile");
  expect(whenText(0)).toBe("azi");
  expect(whenText(1)).toBe("mâine");
  expect(whenText(3)).toBe("peste 3 zile");
});

test("shows overdue and soon promises up front, later ones folded, and ✓ Făcut closes one", async () => {
  const fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => (url.endsWith("/done") ? { ok: true } : { promises }) }));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<PromisesPanel accessToken="tok" />);
  expect(await screen.findByRole("heading", { name: /Ce le-ai promis clienților/ })).toBeInTheDocument();
  expect(screen.getByText(/depășit cu 2 zile/)).toBeInTheDocument();
  expect(screen.getByText(/peste 3 zile/)).toBeInTheDocument();
  expect(screen.queryByText("nunta-dan")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /termenele de mai târziu \(1\)/ }));
  expect(screen.getByText("nunta-dan")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Marchează ca făcut: Ana & Ion" }));
  await waitFor(() => expect(screen.queryByText("Ana & Ion")).not.toBeInTheDocument());
  expect(fetchMock).toHaveBeenCalledWith("/api/album-subscriptions/admin/promises/p2/done", expect.objectContaining({ method: "POST" }));
});

test("nothing promised → no panel", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ promises: [] }) })));
  const { container } = render(<PromisesPanel accessToken="tok" />);
  await waitFor(() => expect(container).toBeEmptyDOMElement());
});
