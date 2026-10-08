import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import ReviewsGrid from "src/client/components/Reviews/ReviewsGrid";

const review = {
  id: "test", author: "Client test", date: "2026-09-01", rating: 5,
  text: "Recenzie de test, fără publicare.", verified: true,
  photos: [{ url: "/first.webp", name: "first" }, { url: "/second.webp", name: "second" }],
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reviews: [review] }) }));
});
afterEach(() => vi.unstubAllGlobals());

test("the whole card opens the photo dialog, supports navigation and restores focus on Escape", async () => {
  render(<ReviewsGrid category="oferta" offerSlug="olx" layout="horizontal" />);
  const card = await screen.findByRole("button", { name: "Citește recenzia de la Client test" });
  card.focus();
  fireEvent.click(card);
  const dialog = screen.getByRole("dialog", { name: "Recenzie de la Client test" });
  expect(within(dialog).getByText(review.text)).toBeInTheDocument();
  expect(within(dialog).getByRole("img")).toHaveAttribute("src", "/first.webp");
  expect(document.body.style.overflow).toBe("hidden");
  expect(within(dialog).getByRole("button", { name: "Închide" })).toHaveFocus();
  fireEvent.click(within(dialog).getByRole("button", { name: "Poza următoare" }));
  expect(within(dialog).getByRole("img")).toHaveAttribute("src", "/second.webp");
  fireEvent.keyDown(window, { key: "ArrowRight" });
  expect(within(dialog).getByRole("img")).toHaveAttribute("src", "/first.webp");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe("");
  expect(card).toHaveFocus();
});

test("a review without photos still opens and has no photo controls or verification claim", async () => {
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ reviews: [{ ...review, photos: [], verified: false }] }) } as Response);
  render(<ReviewsGrid category="wedding" layout="horizontal" />);
  fireEvent.click(await screen.findByRole("button", { name: "Citește recenzia de la Client test" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText(review.text)).toBeInTheDocument();
  expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();
  expect(within(dialog).queryByText(/Recenzie verificată/)).not.toBeInTheDocument();
  fireEvent.keyDown(window, { key: "ArrowRight" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Închide" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("empty or failed responses leave no empty public review section", async () => {
  vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ reviews: [review] }) } as Response);
  const { container } = render(<ReviewsGrid category="wedding" layout="horizontal" />);
  await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});
