import { afterEach, expect, test } from "vitest";
import { readSidebarUsage, recordSidebarClick, sortByUsage } from "src/client/features/admin/components/sidebarUsage";

afterEach(() => localStorage.clear());

test("clicks are counted and remembered", () => {
  recordSidebarClick("/admin/album-updates");
  recordSidebarClick("/admin/album-updates");
  recordSidebarClick("/admin/leads");
  expect(readSidebarUsage()).toEqual({ "/admin/album-updates": 2, "/admin/leads": 1 });
});

test("most used items go first; unused ones keep their order", () => {
  const items = [{ path: "/a" }, { path: "/b" }, { path: "/c" }, { path: "/d" }];
  expect(sortByUsage(items, { "/c": 5, "/d": 1 }).map((i) => i.path)).toEqual(["/c", "/d", "/a", "/b"]);
  expect(sortByUsage(items, {}).map((i) => i.path)).toEqual(["/a", "/b", "/c", "/d"]);
});

test("broken storage doesn't break the sidebar", () => {
  localStorage.setItem("admin-sidebar-usage", "{nu e json");
  expect(readSidebarUsage()).toEqual({});
});
