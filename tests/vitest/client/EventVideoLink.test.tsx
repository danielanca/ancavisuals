import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import EventVideoLink from "src/client/features/admin/components/EventVideoLink";

vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "test-token" } }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const driveLink = "https://drive.google.com/file/d/abc/view?usp=sharing";

test("saves the Drive link with authentication and displays it after success", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal("fetch", fetchMock);
  const onSaved = vi.fn();
  render(<EventVideoLink eventId="ev-1" onSaved={onSaved} />);
  fireEvent.click(screen.getByRole("button", { name: "Adaugă link video" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Link video" }), { target: { value: driveLink } });
  fireEvent.click(screen.getByRole("button", { name: "Salvează linkul" }));
  expect(await screen.findByRole("link", { name: /Deschide videoul/ })).toHaveAttribute("href", driveLink);
  expect(fetchMock).toHaveBeenCalledWith("/api/admin/events/ev-1/video-link", expect.objectContaining({ method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" }, body: JSON.stringify({ videoUrl: driveLink }) }));
  expect(onSaved).toHaveBeenCalledWith(driveLink);
});

test("a failed save keeps the previous link and the editable draft", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Salvare eșuată" }) }));
  const onSaved = vi.fn();
  render(<EventVideoLink eventId="ev-1" videoUrl={driveLink} onSaved={onSaved} />);
  fireEvent.click(screen.getByRole("button", { name: "Editează linkul video" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "https://drive.google.com/file/d/new/view" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvează linkul" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Salvare eșuată");
  expect(screen.getByRole("link")).toHaveAttribute("href", driveLink);
  expect(screen.getByRole("textbox")).toHaveValue("https://drive.google.com/file/d/new/view");
  expect(onSaved).not.toHaveBeenCalled();
});

test("clears a saved link and supports cancel without writing", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal("fetch", fetchMock);
  render(<EventVideoLink eventId="ev-1" videoUrl={driveLink} />);
  fireEvent.click(screen.getByRole("button", { name: "Editează linkul video" }));
  fireEvent.click(screen.getByRole("button", { name: "Anulează" }));
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Editează linkul video" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvează linkul" }));
  await screen.findByRole("button", { name: "Adaugă link video" });
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(fetchMock.mock.calls[0][1].body).toBe('{"videoUrl":""}');
});

test("blocks unsafe links locally, including legacy saved values", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  render(<EventVideoLink eventId="ev-1" videoUrl="javascript:alert(1)" />);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Editează linkul video" }));
  fireEvent.submit(screen.getByRole("textbox").closest("form")!);
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Introdu un link video valid"));
  expect(fetchMock).not.toHaveBeenCalled();
});
