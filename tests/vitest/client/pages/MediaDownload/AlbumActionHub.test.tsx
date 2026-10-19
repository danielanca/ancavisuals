import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import AlbumActionHub from "src/client/pages/MediaDownload/AlbumActionHub";

const props = (overrides = {}) => ({
  hasPhotos: true, printCount: 0, hasDeliveryAddress: false, zipReady: false, zipRequest: "idle" as const, isCouple: false,
  onPickAlbumPhotos: vi.fn(), onDelivery: vi.fn(), onShare: vi.fn(), onDownloadAll: vi.fn(), onRequestZip: vi.fn(),
  onUpdates: vi.fn(), onSentPhotos: vi.fn(), onTutorial: vi.fn(), ...overrides,
});

test("without a ZIP the tile asks the photographer instead of downloading", () => {
  const p = props();
  render(<AlbumActionHub {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /Cere toate pozele/ }));
  expect(p.onRequestZip).toHaveBeenCalled();
  expect(p.onDownloadAll).not.toHaveBeenCalled();
});

test("after the request the tile confirms; with a ZIP it downloads", () => {
  const { unmount } = render(<AlbumActionHub {...props({ zipRequest: "sent" })} />);
  expect(screen.getByText(/Fotograful a fost anunțat/)).toBeInTheDocument();
  unmount();
  const p = props({ zipReady: true });
  render(<AlbumActionHub {...p} />);
  fireEvent.click(screen.getByRole("button", { name: /Descarcă toate pozele/ }));
  expect(p.onDownloadAll).toHaveBeenCalled();
});

test("share tile explains: tick photos, press the pulsing button, pick people in WhatsApp", () => {
  const p = props();
  render(<AlbumActionHub {...p} />);
  const tile = screen.getByRole("button", { name: /Trimite poze invitaților/ });
  expect(tile).toHaveTextContent("Bifezi pozele");
  expect(tile).toHaveTextContent("butonul verde care pulsează");
  expect(tile).toHaveTextContent("verifici pozele alese");
  expect(tile).toHaveTextContent("se deschide WhatsApp (sau SMS), alegi oamenii");
  expect(tile).not.toHaveTextContent(/pentru cine|Email/);
  expect(tile).toHaveTextContent("link anonim, doar cu pozele alese — fără acces la albumul vostru");
  fireEvent.click(tile);
  expect(p.onShare).toHaveBeenCalled();
});

