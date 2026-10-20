import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import PrintReminderPanel from "src/client/pages/MediaDownload/PrintReminderPanel";

const status = (selectedCount: number) => ({
  selectedCount,
  recipients: [{ name: "Ioana", email: "ioana@test.ro", phone: "+40745000000" }],
  lastSentAt: null,
  nextAllowedAt: null,
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("with all 100 photos picked: yellow panel, no reminder, ZIP download instead", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(status(100)), { status: 200 })));
  const submit = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
  render(<PrintReminderPanel slug="25iulie2026" accessToken="t" />);

  expect(await screen.findByText("✅ Clientul a ales toate cele 100 de poze.")).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Reamintire alegere poze" }).className).toContain("border-yellow-400");
  expect(screen.queryByRole("button", { name: /Trimite reamintire/ })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Descarcă cele 100 poze alese/ }));
  expect(submit).toHaveBeenCalledOnce();
  expect((submit.mock.instances[0] as unknown as HTMLFormElement).action).toContain("/api/album/25iulie2026/download-print-dynamic");
  submit.mockRestore();
});

test("with photos still to pick: the reminder button stays, no download", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(status(40)), { status: 200 })));
  render(<PrintReminderPanel slug="25iulie2026" accessToken="t" />);
  expect(await screen.findByText("Clientul a ales 40 din 100 de poze.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Trimite reamintire/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Descarcă/ })).not.toBeInTheDocument();
});

test("during the 12 h pause the reminder can still be sent again on purpose", async () => {
  const sentAt = Date.now() - 60 * 60 * 1000;
  const bodies: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ emailed: 1, smsSent: 1, smsFailed: 0, smsSkipped: false, whatsapp: [], lastSentAt: Date.now(), nextAllowedAt: Date.now() + 1 }), { status: 200 });
    }
    return new Response(JSON.stringify({ ...status(40), lastSentAt: sentAt, nextAllowedAt: sentAt + 12 * 60 * 60 * 1000 }), { status: 200 });
  }));
  render(<PrintReminderPanel slug="25iulie2026" accessToken="t" />);
  expect(await screen.findByRole("button", { name: /Trimite reamintire/ })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Trimite din nou oricum" }));
  expect(await screen.findByText(/Trimis: 1 email, 1 SMS/)).toBeInTheDocument();
  expect(bodies).toEqual([{ email: true, sms: true, force: true }]);
});

test("a client without email: Email unticked and disabled, only SMS is sent", async () => {
  const bodies: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ emailed: 0, smsSent: 1, smsFailed: 0, smsSkipped: false, whatsapp: [], lastSentAt: Date.now(), nextAllowedAt: Date.now() + 1 }), { status: 200 });
    }
    return new Response(JSON.stringify({ ...status(42), recipients: [{ name: "Elena & Hamzah", email: null, phone: "+971558858863" }] }), { status: 200 });
  }));
  render(<PrintReminderPanel slug="25iulie2026" accessToken="t" />);
  const emailBox = await screen.findByRole("checkbox", { name: /Email/ });
  expect(emailBox).not.toBeChecked();
  expect(emailBox).toBeDisabled();
  expect(screen.getByText("(fără email)")).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: /SMS/ })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: /Trimite reamintire/ }));
  await screen.findByText(/Trimis: 0 email, 1 SMS/);
  expect(bodies).toEqual([{ email: false, sms: true, force: false }]);
});

test("an email typed by hand turns Email on and is sent for this reminder only", async () => {
  const bodies: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ emailed: 1, smsSent: 1, smsFailed: 0, smsSkipped: false, whatsapp: [], lastSentAt: Date.now(), nextAllowedAt: Date.now() + 1 }), { status: 200 });
    }
    return new Response(JSON.stringify({ ...status(42), recipients: [{ name: "Elena & Hamzah", email: null, phone: "+971558858863" }] }), { status: 200 });
  }));
  render(<PrintReminderPanel slug="25iulie2026" accessToken="t" />);
  fireEvent.click(await screen.findByRole("button", { name: "+ Adaugă email / telefon manual" }));
  fireEvent.change(screen.getByLabelText("Email manual"), { target: { value: "elena@test.ro" } });
  const emailBox = screen.getByRole("checkbox", { name: /Email/ });
  expect(emailBox).toBeEnabled();
  expect(emailBox).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: /Trimite reamintire/ }));
  await screen.findByText(/Trimis: 1 email/);
  expect(bodies).toEqual([{ email: true, sms: true, force: false, manualEmail: "elena@test.ro" }]);
});

test("a client with no contact at all can still be reminded through a typed phone", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ...status(10), recipients: [] }), { status: 200 })));
  render(<PrintReminderPanel slug="25iulie2026" accessToken="t" />);
  fireEvent.click(await screen.findByRole("button", { name: "+ Adaugă email / telefon manual" }));
  expect(screen.queryByRole("button", { name: /Trimite reamintire/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Telefon manual"), { target: { value: "0745 123 456" } });
  expect(screen.getByRole("checkbox", { name: /SMS/ })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: /Email/ })).toBeDisabled();
  expect(screen.getByRole("button", { name: /Trimite reamintire/ })).toBeEnabled();
});
