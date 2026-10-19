import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import PrintSelectionGuide from "src/client/pages/MediaDownload/PrintSelectionGuide";

const props = (overrides = {}) => ({
  selecting: false, count: 0, savedCount: 0, hasPhotos: true, saving: false, saved: false, error: null,
  onStart: vi.fn(), onSave: vi.fn(), notifying: false, notified: false, onNotify: vi.fn(), onDelivery: vi.fn(), ...overrides,
});

test("'Am terminat' is always visible, disabled until something is saved, then notifies the photographer", () => {
  const { rerender } = render(<PrintSelectionGuide {...props()} />);
  expect(screen.getByRole("button", { name: /Am terminat · anunță fotograful/ })).toBeDisabled();

  const p = props({ savedCount: 100 });
  rerender(<PrintSelectionGuide {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /Am terminat · anunță fotograful/ }));
  expect(p.onNotify).toHaveBeenCalledOnce();

  rerender(<PrintSelectionGuide {...props({ savedCount: 100, notified: true })} />);
  expect(screen.getByRole("button", { name: /Fotograful a fost anunțat/ })).toBeDisabled();
});

test("short guide: album note with both album types, 3 steps, progress", () => {
  const { container } = render(<PrintSelectionGuide {...props({ savedCount: 40 })} />);
  expect(screen.getByText(/Aveți album tipărit în contract\?/)).toBeInTheDocument();
  expect(screen.getByText("Album tip cutie").parentElement).toHaveTextContent("până la 100 de poze");
  expect(screen.getByText("Fotocarte").parentElement).toHaveTextContent("în jur de 32 de poze");
  expect(container.querySelectorAll("ol > li")).toHaveLength(3);
  expect(screen.getByRole("status")).toHaveTextContent("40 / 100 salvate · mai aveți 60");
});

test("already notified in the last 24 h: the button stays locked and says when it unlocks", () => {
  const until = Date.now() + 5 * 60 * 60 * 1000;
  render(<PrintSelectionGuide {...props({ savedCount: 100, notifiedUntil: until })} />);
  expect(screen.getByRole("button", { name: /Fotograful a fost anunțat/ })).toBeDisabled();
  expect(screen.getByText(/Îl poți anunța din nou după/)).toBeInTheDocument();
});

test("after 24 h the button works again", () => {
  const p = props({ savedCount: 100, notifiedUntil: Date.now() - 1000 });
  render(<PrintSelectionGuide {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /Am terminat · anunță fotograful/ }));
  expect(p.onNotify).toHaveBeenCalledOnce();
});
