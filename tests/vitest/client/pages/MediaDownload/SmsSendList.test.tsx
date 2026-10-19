import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import SmsSendList, { cleanPhone, parseRecipients } from "src/client/pages/MediaDownload/SmsSendList";
import { smsShareUrlTo } from "src/client/pages/MediaDownload/whatsappShare";

const link = "https://ancavisuals.ro/share/3f9a1c2b4d5e6f708192";

afterEach(() => {
  window.localStorage.clear();
  delete (navigator as Navigator & { contacts?: unknown }).contacts;
});

test("phone numbers are cleaned and pasted lists split into recipients", () => {
  expect(cleanPhone("0722 123 456")).toBe("0722123456");
  expect(cleanPhone("+40 722-123-456")).toBe("+40722123456");
  expect(cleanPhone("0040722123456")).toBe("+40722123456");
  expect(cleanPhone("123")).toBeNull();
  expect(parseRecipients("Mama 0722 111 222, 0733 444 555\nAndrei: +40745000111")).toEqual([
    { phone: "0722111222", name: "Mama" },
    { phone: "0733444555", name: "" },
    { phone: "+40745000111", name: "Andrei" },
  ]);
});

test("the SMS link targets one number with the AncaVisuals text (works on Android and iPhone)", () => {
  expect(smsShareUrlTo("0722111222", link)).toBe(`sms:0722111222?&body=${encodeURIComponent(`Pozele făcute de AncaVisuals: ${link}`)}`);
});

test("adds typed numbers (no duplicates), sends one at a time and ticks it, and remembers the list", () => {
  const { unmount } = render(<SmsSendList shareUrl={link} onClose={vi.fn()} />);
  expect(screen.queryByRole("button", { name: /Alege din agendă/ })).not.toBeInTheDocument();
  const input = screen.getByLabelText(/Scrie numărul/);
  fireEvent.change(input, { target: { value: "Mama 0722 111 222, 0733 444 555" } });
  fireEvent.click(screen.getByRole("button", { name: "＋ Adaugă" }));
  fireEvent.change(input, { target: { value: "0722111222" } });
  fireEvent.keyDown(input, { key: "Enter" });
  const list = screen.getByRole("list", { name: "Destinatari SMS" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(2);

  fireEvent.click(screen.getByRole("button", { name: "Trimite SMS către Mama" }));
  expect(screen.getByText("1 din 2 trimise")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Trimite SMS către Mama" })).toHaveTextContent("Din nou");
  unmount();

  render(<SmsSendList shareUrl={link} onClose={vi.fn()} />);
  expect(screen.getByText("1 din 2 trimise")).toBeInTheDocument();
});

test("rejects text that isn't a phone number", () => {
  render(<SmsSendList shareUrl={link} onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText(/Scrie numărul/), { target: { value: "Mama" } });
  fireEvent.click(screen.getByRole("button", { name: "＋ Adaugă" }));
  expect(screen.getByRole("alert")).toHaveTextContent("număr de telefon valid");
});

test("on phones with the contact picker, several contacts can be chosen from the address book", async () => {
  const select = vi.fn().mockResolvedValue([
    { name: ["Andrei"], tel: ["+40 745 000 111"] },
    { name: ["Fără număr"], tel: [] },
  ]);
  Object.defineProperty(navigator, "contacts", { value: { select }, configurable: true });
  render(<SmsSendList shareUrl={link} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /Alege din agendă/ }));
  expect(select).toHaveBeenCalledWith(["name", "tel"], { multiple: true });
  await waitFor(() => expect(screen.getByRole("button", { name: "Trimite SMS către Andrei" })).toBeInTheDocument());
  expect(screen.getByText("+40745000111")).toBeInTheDocument();
});
