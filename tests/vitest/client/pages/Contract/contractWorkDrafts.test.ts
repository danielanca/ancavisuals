import { beforeEach, describe, expect, test } from "vitest";
import { listWorkDrafts, migrateLegacyWorkDraft, readWorkDraft, removeWorkDraft, saveWorkDraft } from "src/client/features/admin/components/Contracts/contractWorkDrafts";

describe("contract work drafts", () => {
  beforeEach(() => localStorage.clear());

  test("keeps two drafts independent and removes only the completed one", () => {
    for (const id of ["first", "second"]) {
      saveWorkDraft({ id, title: "Draft necunoscut", eventDate: id === "first" ? "2026-10-01" : "2026-10-02", updatedAt: "2026-09-25", progress: "todo", payload: JSON.stringify({ clientName: "", eventDate: id }) });
    }
    expect(listWorkDrafts()).toHaveLength(2);
    saveWorkDraft({ ...readWorkDraft("first")!, progress: "working" });
    expect(readWorkDraft("second")?.progress).toBe("todo");
    removeWorkDraft("first");
    expect(listWorkDrafts().map((draft) => draft.eventDate)).toEqual(["2026-10-02"]);
  });

  test("migrates the existing draft without losing fields and uses the date for an unnamed client", () => {
    const payload = JSON.stringify({ clientName: "", eventDate: "2026-10-02", clauses: [{ id: "clause" }] });
    localStorage.setItem("contract-create-draft", payload);
    migrateLegacyWorkDraft();
    migrateLegacyWorkDraft();
    expect(listWorkDrafts()).toHaveLength(1);
    expect(readWorkDraft("legacy")).toMatchObject({ title: "Draft necunoscut", eventDate: "2026-10-02", payload });
    expect(localStorage.getItem("contract-create-draft")).toBeNull();
  });
});
