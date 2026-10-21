import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import AlbumLongVideoLinkManager from "src/client/features/admin/components/AlbumLongVideoLinkManager";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function stubLinks(initial: string) {
  const bodies: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body)) as { long: string };
      bodies.push(body);
      return new Response(JSON.stringify({ links: body.long ? { long: body.long } : {} }), { status: 200 });
    }
    return new Response(JSON.stringify({ links: initial ? { long: initial } : {} }), { status: 200 });
  }));
  return bodies;
}

test("deletes the long video link after confirming, so a new one can be added", async () => {
  const bodies = stubLinks("https://swisstransfer.com/d/vechi");
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<AlbumLongVideoLinkManager slug="25iulie2026" accessToken="t" />);

  fireEvent.click(await screen.findByRole("button", { name: "Șterge" }));
  expect(await screen.findByText("Link șters — clientul nu mai vede videoul lung.")).toBeInTheDocument();
  expect(bodies).toEqual([{ long: "" }]);
  expect(screen.queryByRole("button", { name: "Șterge" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Salvează link" })).toBeDisabled();
});

test("replaces the long video link with a new one", async () => {
  const bodies = stubLinks("https://swisstransfer.com/d/vechi");
  render(<AlbumLongVideoLinkManager slug="25iulie2026" accessToken="t" />);

  const input = screen.getByRole("textbox", { name: "Link video lung" });
  await screen.findByDisplayValue("https://swisstransfer.com/d/vechi");
  fireEvent.change(input, { target: { value: "https://swisstransfer.com/d/nou" } });
  fireEvent.click(screen.getByRole("button", { name: "Înlocuiește link" }));
  expect(await screen.findByText("Link înlocuit.")).toBeInTheDocument();
  expect(bodies).toEqual([{ long: "https://swisstransfer.com/d/nou" }]);
});

test("keeps the link when the delete is cancelled", async () => {
  const bodies = stubLinks("https://swisstransfer.com/d/vechi");
  vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<AlbumLongVideoLinkManager slug="25iulie2026" accessToken="t" />);
  fireEvent.click(await screen.findByRole("button", { name: "Șterge" }));
  expect(bodies).toEqual([]);
});
