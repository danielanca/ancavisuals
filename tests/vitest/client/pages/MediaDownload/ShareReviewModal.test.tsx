import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import ShareReviewModal from "src/client/pages/MediaDownload/ShareReviewModal";

const photos = [
  { fileName: "a.jpg", src: "https://cdn/a.jpg" },
  { fileName: "b.jpg", src: "https://cdn/b.jpg" },
];

test("shows every photo that will be sent, uncropped, each with its own remove button", () => {
  const onRemove = vi.fn();
  render(<ShareReviewModal photos={photos} channel="whatsapp" sending={false} onRemove={onRemove} onClose={vi.fn()} onConfirm={vi.fn()} />);
  const list = screen.getByTestId("share-review-list");
  expect(within(list).getAllByRole("img")).toHaveLength(2);
  expect(within(list).getByAltText("Poză de trimis: a.jpg")).toHaveClass("h-auto", "w-full");
  fireEvent.click(screen.getByRole("button", { name: "Scoate b.jpg din trimitere" }));
  expect(onRemove).toHaveBeenCalledWith("b.jpg");
});

test("confirm sends on the chosen channel; Escape and 'Înapoi' close without sending", () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(<ShareReviewModal photos={photos} channel="whatsapp" sending={false} onRemove={vi.fn()} onClose={onClose} onConfirm={onConfirm} />);
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.click(screen.getByRole("button", { name: "✓ Confirmă și trimite pe WhatsApp (2)" }));
  expect(onConfirm).toHaveBeenCalledOnce();
  fireEvent.keyDown(window, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "← Înapoi la selecție" }));
  expect(onClose).toHaveBeenCalledTimes(2);
});

test("nothing left to send disables the confirm button", () => {
  render(<ShareReviewModal photos={[]} channel="sms" sending={false} onRemove={vi.fn()} onClose={vi.fn()} onConfirm={vi.fn()} />);
  expect(screen.getByText(/Ai scos toate pozele/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "✓ Confirmă și alege cui trimiți prin SMS (0)" })).toBeDisabled();
});
