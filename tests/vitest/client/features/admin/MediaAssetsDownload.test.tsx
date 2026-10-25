import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import MediaAssetsAdminPage from "src/client/features/admin/components/MediaAssetsAdminPage";

vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "test" } }) }));
vi.mock("src/client/features/admin/components/Breadcrumb", () => ({ default: () => null }));

const assets = [
  { id: "a1", serviceId: "photo", kind: "image", url: "https://cdn/a1.jpg", label: "a1", alt: "poza unu" },
  { id: "a2", serviceId: "photo", kind: "image", url: "https://cdn/a2.jpg", label: "a2", alt: "poza doi" },
];

describe("MediaAssetsAdminPage selective download", () => {
  let zipBodies: unknown[];

  beforeEach(() => {
    zipBodies = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/download-zip")) {
        zipBodies.push(JSON.parse(String(init?.body)));
        return new Response(new Blob(["zip"]), { status: 200, headers: { "Content-Disposition": 'attachment; filename="media-assets.zip"' } });
      }
      if (url.includes("/ui-state")) return new Response("{}", { status: 200 });
      return new Response(JSON.stringify({ assets }), { status: 200 });
    }));
    URL.createObjectURL = vi.fn(() => "blob:zip");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  test("downloads only the selected assets as a ZIP", async () => {
    render(<MediaAssetsAdminPage />);
    fireEvent.click(await screen.findByText("Selecteaza pentru descarcare"));

    fireEvent.click(screen.getByAltText("poza doi"));
    fireEvent.click(screen.getByText("Descarca ZIP (1)"));

    await waitFor(() => expect(zipBodies).toEqual([{ assetIds: ["a2"] }]));
  });

  test("clicking a photo outside select mode opens the lightbox, not the selection", async () => {
    render(<MediaAssetsAdminPage />);
    fireEvent.click(await screen.findByAltText("poza unu"));
    expect(screen.queryByText(/Descarca ZIP/)).toBeNull();
    expect(screen.getAllByAltText("poza unu")).toHaveLength(2);
  });
});
