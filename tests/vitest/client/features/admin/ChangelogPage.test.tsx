/*
 * Purpose: the "Update-uri" changelog — entries have unique ids, valid timestamps and links only to
 * real admin pages; the page shows them newest first, grouped by day, each in its own box.
 */
import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, test } from "vitest";
import ChangelogPage, { changelogByDay } from "src/client/features/admin/components/ChangelogPage";
import { ADMIN_CHANGELOG } from "src/shared/adminChangelog";

test("every entry is well formed and links to a registered admin page", () => {
  const ids = ADMIN_CHANGELOG.map((entry) => entry.id);
  expect(new Set(ids).size).toBe(ids.length);
  const routes = readFileSync("src/client/routes/adminRoutes.tsx", "utf8");
  for (const entry of ADMIN_CHANGELOG) {
    expect(entry.at).toMatch(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/);
    expect(entry.title.trim()).not.toBe("");
    for (const link of entry.links ?? []) {
      expect(routes, `${entry.id} → ${link.path}`).toContain(`path="${link.path.split(/[?#]/)[0]}"`);
    }
  }
});

test("groups newest first by day, keeping file order for the same time", () => {
  const days = changelogByDay([
    { id: "a", at: "2026-10-26", emoji: "", title: "A", summary: "" },
    { id: "b", at: "2026-10-27T10:00", emoji: "", title: "B", summary: "" },
    { id: "c", at: "2026-10-27T12:00", emoji: "", title: "C", summary: "" },
  ]);
  expect(days.map((day) => [day.day, day.entries.map((e) => e.id)])).toEqual([["2026-10-27", ["c", "b"]], ["2026-10-26", ["a"]]]);
});

test("renders each change in its own box with time and links", () => {
  render(<MemoryRouter><ChangelogPage /></MemoryRouter>);
  const box = screen.getByRole("article", { name: "SMS-uri trimise" });
  expect(within(box).getByText("16:30")).toBeInTheDocument();
  expect(within(box).getByRole("link", { name: "SMS-uri trimise →" })).toHaveAttribute("href", "/admin/sms-log");
  expect(screen.getAllByRole("article").length).toBe(ADMIN_CHANGELOG.length);
});
