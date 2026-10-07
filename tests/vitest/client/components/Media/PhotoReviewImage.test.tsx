import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import PhotoReviewImage from "src/client/components/Media/PhotoReviewImage";

test("review actions require selection mode and preview opens the whole original", () => {
  const accept = vi.fn();
  const reject = vi.fn();
  const props = { src: "https://cdn.test/preview.webp", original: "https://cdn.test/original.jpg", alt: "photo.jpg", onAccept: accept, onReject: reject };
  const { rerender } = render(<PhotoReviewImage {...props} enabled={false} />);
  expect(screen.queryByRole("button", { name: "Acceptă photo.jpg" })).not.toBeInTheDocument();
  rerender(<PhotoReviewImage {...props} enabled />);
  fireEvent.click(screen.getByRole("button", { name: "Acceptă photo.jpg" }));
  fireEvent.click(screen.getByRole("button", { name: "Respinge photo.jpg" }));
  expect(accept).toHaveBeenCalledOnce();
  expect(reject).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Vizualizează photo.jpg" }));
  expect(screen.getByAltText("Foto 1")).toHaveAttribute("src", props.original);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByAltText("Foto 1")).not.toBeInTheDocument();
});
