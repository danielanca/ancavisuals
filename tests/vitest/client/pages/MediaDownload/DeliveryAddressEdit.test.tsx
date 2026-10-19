import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import DeliveryAddressModal from "src/client/pages/DeliveryAddress/AddressList";
import DeliveryForm from "src/client/pages/MediaDownload/DeliveryForm";
import AlbumUpdatesSection, { OPEN_ALBUM_UPDATES_EVENT } from "src/client/pages/MediaDownload/AlbumUpdatesSection";

const address = { fullName: "Petcu Diana", phone: "0746000000", street: "Drumul X 19", county: null, city: "București sector 4", easybox: "Easybox 1" };

afterEach(() => vi.unstubAllGlobals());

test("saved delivery address offers an edit button that hands over the address", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { deliveryAddress: address } }) }));
  const onEdit = vi.fn();
  render(<DeliveryAddressModal slug="album" isOpen onClose={() => {}} onEdit={onEdit} />);
  fireEvent.click(await screen.findByRole("button", { name: /Modifică adresa/ }));
  expect(onEdit).toHaveBeenCalledWith(address);
});

test("delivery form prefilled with the saved address when editing", () => {
  render(<DeliveryForm albumId="album" initial={address} onClose={() => {}} onSuccess={() => {}} />);
  expect(screen.getByRole("heading", { name: "Modifică adresa de livrare" })).toBeInTheDocument();
  expect(screen.getByDisplayValue("Petcu Diana")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Easybox 1")).toBeInTheDocument();
});

test("the updates panel starts collapsed with a one-line summary, and opens on tap or from the hub", async () => {
  const updates = [
    { id: "u2", kind: "estimate", text: "Estimare nouă", estimateDate: "2026-11-22", createdAt: new Date().toISOString() },
    { id: "u1", kind: "announcement", text: "Veche", estimateDate: null, createdAt: new Date().toISOString() },
  ];
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ updates }) }));
  render(<AlbumUpdatesSection slug="album" isAdmin={false} accessToken={null} />);
  const toggle = await screen.findByRole("button", { name: /Noutăți despre album/ });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  await waitFor(() => expect(toggle).toHaveTextContent(/Ultima: .*2 noutăți/));
  expect(screen.queryByText("📣")).not.toBeInTheDocument();
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  act(() => { window.dispatchEvent(new Event(OPEN_ALBUM_UPDATES_EVENT)); });
  expect(toggle).toHaveAttribute("aria-expanded", "true");
});

test("the newest update is marked and older ones sit under a 'Mai vechi' divider", async () => {
  const updates = [
    { id: "u2", kind: "estimate", text: "Estimare nouă", estimateDate: null, createdAt: new Date(2026, 9, 19, 22, 19).toISOString() },
    { id: "u1", kind: "estimate", text: "Estimare veche", estimateDate: null, createdAt: new Date(2026, 9, 19, 22, 4).toISOString() },
  ];
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ updates }) }));
  render(<AlbumUpdatesSection slug="album" isAdmin={false} accessToken={null} defaultOpen />);
  const items = await screen.findAllByRole("listitem");
  expect(items[0]).toHaveTextContent(/Cea mai nouă.*22:19.*Estimare nouă/);
  expect(items[1]).toHaveTextContent("Mai vechi");
  expect(items[2]).toHaveTextContent(/22:04.*Estimare veche/);
});

test("admin deletes an update only after confirming", async () => {
  const updates = [{ id: "u1", kind: "announcement", text: "De șters", estimateDate: null, createdAt: new Date().toISOString() }];
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ updates, subscribers: [], count: 0 }) });
  vi.stubGlobal("fetch", fetchMock);
  const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
  render(<AlbumUpdatesSection slug="album" isAdmin accessToken="tok" defaultOpen />);
  const button = await screen.findByRole("button", { name: /Șterge noutatea/ });
  fireEvent.click(button);
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  fireEvent.click(button);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/album-subscriptions/updates/album/u1", expect.objectContaining({ method: "DELETE" })));
  confirmSpy.mockRestore();
});

test("album updates show date and time, and an empty state before the first update", async () => {
  const createdAt = new Date(2026, 9, 4, 14, 30).toISOString();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ updates: [{ id: "u1", kind: "announcement", text: "Filmul e în montaj", estimateDate: null, createdAt }] }) }));
  const { unmount } = render(<AlbumUpdatesSection slug="album" isAdmin={false} accessToken={null} defaultOpen />);
  expect(await screen.findByText("Filmul e în montaj")).toBeInTheDocument();
  expect(screen.getByText(/^4 oct/)).toBeInTheDocument();
  expect(screen.getByText("14:30")).toBeInTheDocument();
  expect(screen.getByText("Cea mai nouă")).toBeInTheDocument();
  expect(screen.queryByText("Mai vechi")).not.toBeInTheDocument();
  unmount();

  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ updates: [] }) }));
  render(<AlbumUpdatesSection slug="album" isAdmin={false} accessToken={null} defaultOpen />);
  expect(await screen.findByText(/Încă nu am publicat noutăți/)).toBeInTheDocument();
});

test("album updates: visitors get a discreet admin login back to the album, admins get the composer inside the panel", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ updates: [] }) }));
  const { unmount } = render(<AlbumUpdatesSection slug="petcu-nunta" isAdmin={false} accessToken={null} defaultOpen />);
  expect(await screen.findByRole("link", { name: /Admin/ })).toHaveAttribute("href", "/login?redirect=%2Fmedia%2Fpetcu-nunta");
  unmount();

  render(<AlbumUpdatesSection slug="petcu-nunta" isAdmin accessToken="token" defaultOpen />);
  expect(await screen.findByRole("button", { name: /Adaugă o noutate/ })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Admin/ })).not.toBeInTheDocument();
});

test("album updates: admin in client view is told how to get the composer back", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ updates: [] }) }));
  const exit = vi.fn();
  render(<AlbumUpdatesSection slug="a" isAdmin={false} accessToken={null} adminPreviewHidden onExitClientPreview={exit} defaultOpen />);
  fireEvent.click(await screen.findByRole("button", { name: "Treci pe Admin" }));
  expect(exit).toHaveBeenCalled();
});

test("admin sees the album subscribers list with event clients and phone-only subscribers", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({
    ok: true,
    json: async () => url.includes("/list/")
      ? { subscribers: [{ id: "s1", email: "", phone: "+40746000000", name: "Petcu Diana", channels: ["whatsapp"], source: "event-client" }] }
      : { updates: [] },
  })));
  render(<AlbumUpdatesSection slug="23august2026" isAdmin accessToken="token" defaultOpen />);
  fireEvent.click(await screen.findByRole("button", { name: /Abonați \(1\)/ }));
  expect(screen.getByText("Petcu Diana")).toBeInTheDocument();
  expect(screen.getByText("din eveniment")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/40746000000");
});

test("admin adds a subscriber by hand and the list reloads", async () => {
  let list = [] as unknown[];
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url.includes("/admin-add")) {
      list = [{ id: "s2", email: "", phone: "+40745000000", name: "Dani", channels: ["whatsapp"], source: "admin" }];
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    }
    return Promise.resolve({ ok: true, json: async () => (url.includes("/list/") ? { subscribers: list } : { updates: [] }) });
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<AlbumUpdatesSection slug="23august2026" isAdmin accessToken="token" defaultOpen />);
  fireEvent.click(await screen.findByRole("button", { name: /Abonați \(0\)/ }));
  fireEvent.click(screen.getByRole("button", { name: /Adaugă abonat/ }));
  fireEvent.change(screen.getByLabelText("Nume abonat nou"), { target: { value: "Dani" } });
  fireEvent.change(screen.getByLabelText("Telefon abonat nou"), { target: { value: "0745000000" } });
  fireEvent.click(screen.getByRole("button", { name: "Adaugă" }));
  expect(await screen.findByText("adăugat de tine")).toBeInTheDocument();
  const [, init] = fetchMock.mock.calls.find(([u]) => String(u).includes("/admin-add"))!;
  expect(JSON.parse(String(init?.body))).toEqual(expect.objectContaining({ albumSlug: "23august2026", channels: ["whatsapp"], phone: "0745000000", name: "Dani" }));
});

test("composer: admin ticks where the update goes; it is published in the album either way", async () => {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === "POST") return Promise.resolve({ ok: true, json: async () => ({ update: {}, sent: { email: 0, sms: 0, failed: 0 }, smsSkipped: false, whatsapp: [] }) });
    return Promise.resolve({ ok: true, json: async () => (url.includes("/count/") ? { count: 2 } : url.includes("/list/") ? { subscribers: [] } : { updates: [] }) });
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<AlbumUpdatesSection slug="23august2026" isAdmin accessToken="token" defaultOpen />);
  fireEvent.click(await screen.findByRole("button", { name: /Adaugă o noutate/ }));
  fireEvent.click(screen.getByRole("button", { name: /Anunț/ }));
  fireEvent.change(screen.getByLabelText("Mesaj"), { target: { value: "Filmul e în montaj." } });
  const sendTo = within(screen.getByRole("group", { name: "Unde trimit noutatea" }));
  fireEvent.click(sendTo.getByRole("checkbox", { name: /Email/ }));
  fireEvent.click(sendTo.getByRole("checkbox", { name: /SMS/ }));
  fireEvent.click(screen.getByRole("button", { name: "Publică" }));
  await screen.findByText(/Publicat/);
  const [, init] = fetchMock.mock.calls.find(([u, i]) => String(u).includes("/updates/") && i?.method === "POST")!;
  expect(JSON.parse(String(init?.body))).toEqual(expect.objectContaining({ notify: true, email: false, phoneDelivery: "whatsapp" }));
});

test("the subscribe card is for clients only; the admin doesn't see it", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ updates: [], subscribers: [], count: 0 }) }));
  const { unmount } = render(<AlbumUpdatesSection slug="album" isAdmin={false} accessToken={null} defaultOpen />);
  expect(await screen.findByRole("group", { name: "Abonare la noutăți" })).toBeInTheDocument();
  unmount();
  render(<AlbumUpdatesSection slug="album" isAdmin accessToken="tok" defaultOpen />);
  await screen.findByText(/Încă nu am publicat noutăți/);
  expect(screen.queryByRole("group", { name: "Abonare la noutăți" })).not.toBeInTheDocument();
});
