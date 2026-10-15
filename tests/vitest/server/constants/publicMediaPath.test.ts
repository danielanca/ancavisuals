// @vitest-environment node
/*
 * Purpose: /f/* and /api/download sign Bunny CDN URLs for visitors; they must never sign
 * business documents (contracts, bank statements…) or escape the album folders.
 */
import { describe, expect, test } from "vitest";
import { publicMediaPath } from "src/server/constants/bunny";

describe("publicMediaPath", () => {
  test.each(["8august2026/photos/IMG_1.jpg", "nunta-ana/photos.zip", "slug/shortvideo/clip.mp4"])("allows album media %s", (path) => {
    expect(publicMediaPath(path)).toBe(path);
  });

  test.each([
    "contracts/PF_2026-08-08_abc.pdf",
    "Expenses/2026/01/bon.jpg",
    "bank-statements/2026/extras.pdf",
    "handover/x.pdf",
    "admin-events/id/backup-proof.jpg",
    "invoices/f.pdf",
    "%63ontracts/x.pdf",
    "slug/../contracts/x.pdf",
    "slug/%2e%2e/contracts/x.pdf",
    "slug//x.jpg",
    "slug\\..\\x.jpg",
    "%E0%A4%A",
    "",
  ])("rejects %s", (path) => {
    expect(publicMediaPath(path)).toBeNull();
  });
});
