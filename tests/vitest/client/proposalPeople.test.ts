import { expect, test } from "vitest";
import { personKey, personLabel, proposalsByPerson } from "src/client/features/admin/components/proposalPeople";

const p = (proposedBy: string, albumSlug: string, proposedAt: string, status: "pending" | "accepted" = "pending", proposedByUid?: string) =>
  ({ proposedBy, albumSlug, proposedAt, status, proposedByUid });

test("groups proposals per person, then per album, newest activity first", () => {
  const people = proposalsByPerson([
    p("estera@ancavisuals.ro", "10mai2026", "2026-10-01T10:00:00Z", "accepted"),
    p("estera@ancavisuals.ro", "10mai2026", "2026-10-02T10:00:00Z"),
    p("Estera@ancavisuals.ro", "8august2026", "2026-10-05T10:00:00Z"),
    p("Alin", "25iulie2026", "2026-10-20T10:00:00Z", "pending", "link:tok:visitor"),
  ]);

  expect(people.map((person) => person.label)).toEqual(["Alin", "estera"]);
  expect(people[0]).toMatchObject({ viaLink: true, total: 1, albums: [{ albumSlug: "25iulie2026", total: 1 }] });

  const estera = people[1];
  expect(estera).toMatchObject({ viaLink: false, total: 3, lastAt: "2026-10-05T10:00:00Z" });
  expect(estera.byStatus).toEqual({ pending: 2, accepted: 1, archived: 0, rejected: 0 });
  expect(estera.albums.map((album) => [album.albumSlug, album.total])).toEqual([["8august2026", 1], ["10mai2026", 2]]);
});

test("names and emails map to one readable label and key", () => {
  expect(personLabel("ana@ancavisuals.ro")).toBe("ana");
  expect(personLabel("  Alin ")).toBe("Alin");
  expect(personLabel("")).toBe("Necunoscut");
  expect(personKey(" ALIN ")).toBe(personKey("alin"));
});
