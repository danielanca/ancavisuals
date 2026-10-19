import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import InstagramProposalsAdminPage from "src/client/features/admin/components/InstagramProposalsAdminPage";

vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { role: "admin", accessToken: "token" } }) }));
beforeEach(() => vi.restoreAllMocks());

// Albumele pornesc închise: le deschidem ca să vedem pozele.
async function openAlbum(slug = "album") {
  fireEvent.click(await screen.findByRole("button", { name: `Deschide albumul ${slug}` }));
}

test("albums start collapsed and open on click or keyboard", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ proposals: [{
    id: "vote-1", albumSlug: "album", fileName: "photo.jpg", photoUrl: "https://cdn.test/photo.jpg",
    proposedBy: "ancadaniel1994@gmail.com", proposedAt: "2026-10-06", status: "pending", destinations: ["instagram"],
  }] }) } as Response);
  render(<MemoryRouter><InstagramProposalsAdminPage /></MemoryRouter>);
  const header = await screen.findByRole("button", { name: "Deschide albumul album" });
  expect(header).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByAltText("photo.jpg")).not.toBeInTheDocument();
  fireEvent.keyDown(header, { key: "Enter" });
  expect(await screen.findByAltText("photo.jpg")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Închide albumul album" })).toHaveAttribute("aria-expanded", "true");
});

test("pending proposals only expose moderation after the shared selection toggle", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ proposals: [{
    id: "vote-1", albumSlug: "album", fileName: "photo.jpg", photoUrl: "https://cdn.test/photo.jpg",
    proposedBy: "ancadaniel1994@gmail.com", proposedAt: "2026-10-06", status: "pending", destinations: ["instagram"],
  }] }) } as Response);
  render(<MemoryRouter><InstagramProposalsAdminPage /></MemoryRouter>);
  await openAlbum();
  await screen.findByAltText("photo.jpg");
  expect(screen.queryByRole("button", { name: "Acceptă photo.jpg" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("switch", { name: "Activează selectarea" }));
  expect(screen.getByRole("button", { name: "Acceptă photo.jpg" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Respinge photo.jpg" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("switch", { name: "Dezactivează selectarea" }));
  expect(screen.queryByRole("button", { name: "Acceptă photo.jpg" })).not.toBeInTheDocument();
});

test("one click on Accept saves right away with the destinations ticked on the card", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => ({
    ok: true,
    json: async () => (init?.method === "PATCH" ? { ok: true } : { proposals: [{
      id: "vote-1", albumSlug: "album", fileName: "photo.jpg", photoUrl: "https://cdn.test/photo.jpg",
      proposedBy: "ancadaniel1994@gmail.com", proposedAt: "2026-10-06", status: "pending", destinations: ["instagram"],
    }] }),
  } as Response));
  render(<MemoryRouter><InstagramProposalsAdminPage /></MemoryRouter>);
  await openAlbum();
  await screen.findByAltText("photo.jpg");
  fireEvent.click(screen.getByRole("switch", { name: "Activează selectarea" }));

  // Destinațiile pornesc de la propunere și se pot bifa direct pe card.
  expect(screen.getByRole("button", { name: "Instagram" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Media Assets" }));

  fireEvent.click(screen.getByRole("button", { name: "Acceptă photo.jpg" }));
  expect(screen.queryByRole("button", { name: "Confirmă" })).not.toBeInTheDocument();
  await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true));
  const [url, init] = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")!;
  expect(url).toBe("/api/instagram-proposals/vote-1");
  expect(JSON.parse(String(init!.body))).toEqual({ status: "accepted", destinations: ["instagram", "media_assets"] });
  expect(await screen.findByText("Acceptat")).toBeInTheDocument();
});

test("accepted photos move up into their album's own row, above the ones still pending", async () => {
  const proposal = (id: string, fileName: string) => ({
    id, albumSlug: "album", fileName, photoUrl: `https://cdn.test/${fileName}`,
    proposedBy: "ancadaniel1994@gmail.com", proposedAt: "2026-10-06", status: "pending", destinations: ["instagram"],
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => ({
    ok: true,
    json: async () => (init?.method === "PATCH" ? { ok: true } : { proposals: [proposal("v1", "first.jpg"), proposal("v2", "second.jpg")] }),
  } as Response));
  render(<MemoryRouter><InstagramProposalsAdminPage /></MemoryRouter>);
  await openAlbum();
  await screen.findByAltText("second.jpg");
  expect(screen.queryByRole("region", { name: "Acceptate acum în album" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("switch", { name: "Activează selectarea" }));

  fireEvent.click(screen.getByRole("button", { name: "Acceptă second.jpg" }));
  const acceptedRow = await screen.findByRole("region", { name: "Acceptate acum în album" });
  expect(within(acceptedRow).getByAltText("second.jpg")).toBeInTheDocument();
  expect(within(acceptedRow).queryByAltText("first.jpg")).not.toBeInTheDocument();
  expect(within(acceptedRow).getByText("✓ Acceptate acum (1)")).toBeInTheDocument();
  // Rândul acceptatelor stă deasupra pozelor încă de decis.
  const pendingPhoto = screen.getByAltText("first.jpg");
  expect(acceptedRow.compareDocumentPosition(pendingPhoto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("accept is optimistic: the photo moves up at once, and a failed save goes back with Retry in the queue panel", async () => {
  let failNext = true;
  let releasePatch: () => void = () => {};
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    if (init?.method === "PATCH") {
      await new Promise<void>((resolve) => { releasePatch = resolve; });
      if (failNext) { failNext = false; return { ok: false, json: async () => ({ error: "Server indisponibil" }) } as Response; }
      return { ok: true, json: async () => ({ ok: true }) } as Response;
    }
    return { ok: true, json: async () => ({ proposals: [{
      id: "v1", albumSlug: "album", fileName: "photo.jpg", photoUrl: "https://cdn.test/photo.jpg",
      proposedBy: "ancadaniel1994@gmail.com", proposedAt: "2026-10-06", status: "pending", destinations: ["instagram"],
    }] }) } as Response;
  });
  render(<MemoryRouter><InstagramProposalsAdminPage /></MemoryRouter>);
  await openAlbum();
  await screen.findByAltText("photo.jpg");
  fireEvent.click(screen.getByRole("switch", { name: "Activează selectarea" }));

  fireEvent.click(screen.getByRole("button", { name: "Acceptă photo.jpg" }));
  // Imediat, înainte de răspunsul serverului: sus, în rândul acceptatelor, și în panoul cozii.
  const acceptedRow = await screen.findByRole("region", { name: "Acceptate acum în album" });
  expect(within(acceptedRow).getByAltText("photo.jpg")).toBeInTheDocument();
  const panel = screen.getByRole("status", { name: "Acceptări" });
  expect(await within(panel).findByText(/Se încarcă…/)).toBeInTheDocument();

  releasePatch();
  expect(await within(panel).findByText("Eroare: Server indisponibil")).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Acceptate acum în album" })).not.toBeInTheDocument();

  fireEvent.click(within(panel).getByRole("button", { name: "Reîncearcă" }));
  expect(await screen.findByRole("region", { name: "Acceptate acum în album" })).toBeInTheDocument();
  await waitFor(() => expect(within(panel).getByText(/Se încarcă…/)).toBeInTheDocument());
  releasePatch();
  expect(await within(panel).findByText("Toate gata ✓")).toBeInTheDocument();
});

test("quick accepts wait in a queue of two, with their position and the remaining time", async () => {
  const releases: Array<() => void> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    if (init?.method === "PATCH") {
      await new Promise<void>((resolve) => releases.push(resolve));
      return { ok: true, json: async () => ({ ok: true }) } as Response;
    }
    return { ok: true, json: async () => ({ proposals: ["a.jpg", "b.jpg", "c.jpg"].map((fileName, i) => ({
      id: `v${i}`, albumSlug: "album", fileName, photoUrl: `https://cdn.test/${fileName}`,
      proposedBy: "ancadaniel1994@gmail.com", proposedAt: "2026-10-06", status: "pending", destinations: ["instagram"],
    })) }) } as Response;
  });
  render(<MemoryRouter><InstagramProposalsAdminPage /></MemoryRouter>);
  await openAlbum();
  await screen.findByAltText("c.jpg");
  fireEvent.click(screen.getByRole("switch", { name: "Activează selectarea" }));
  for (const name of ["a.jpg", "b.jpg", "c.jpg"]) fireEvent.click(screen.getByRole("button", { name: `Acceptă ${name}` }));

  const panel = screen.getByRole("status", { name: "Acceptări" });
  await waitFor(() => expect(releases).toHaveLength(2));
  expect(within(panel).getByText("Acceptări: 0/3")).toBeInTheDocument();
  expect(within(panel).getByText(/1 în coadă · mai durează ~/)).toBeInTheDocument();
  expect(within(panel).getByText("În coadă #1")).toBeInTheDocument();
  expect(screen.getAllByText("În coadă #1").length).toBeGreaterThan(1); // și pe cardul pozei

  releases.shift()!();
  await waitFor(() => expect(releases).toHaveLength(2)); // a treia a pornit când s-a eliberat un loc
  releases.splice(0).forEach((release) => release());
  expect(await within(panel).findByText("Toate gata ✓")).toBeInTheDocument();
});

test("?album=<slug> (from the album page) opens 'Toate' showing only that album's proposals", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ proposals: [
    { id: "v1", albumSlug: "nunta-ana", fileName: "ana.jpg", photoUrl: "https://cdn.test/ana.jpg", proposedBy: "a", proposedAt: "2026-10-06", status: "pending", destinations: ["instagram"] },
    { id: "v2", albumSlug: "botez-ion", fileName: "ion.jpg", photoUrl: "https://cdn.test/ion.jpg", proposedBy: "a", proposedAt: "2026-10-06", status: "accepted", destinations: ["instagram"] },
  ] }) } as Response);
  render(<MemoryRouter initialEntries={["/admin/instagram-proposals?album=nunta-ana"]}><InstagramProposalsAdminPage /></MemoryRouter>);
  expect(await screen.findByDisplayValue("nunta-ana")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByAltText("ion.jpg")).not.toBeInTheDocument());
});
