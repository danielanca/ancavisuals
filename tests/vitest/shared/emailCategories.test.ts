import { describe, expect, test } from "vitest";
import { categorizeEmail, eventTypeOfEmail } from "src/shared/emailCategories";
import { filterEmails, type EmailLogRow } from "src/client/features/admin/components/EmailLogPage";

describe("email log categories", () => {
  test("uses the source first, then the subject", () => {
    expect(categorizeEmail({ source: "live:whatsapp_clicked", subject: "x" })).toBe("lead");
    expect(categorizeEmail({ source: "proposal-link:complete", subject: "x" })).toBe("proposal");
    expect(categorizeEmail({ subject: "[Admin] Contract semnat — Nuntă 12 iulie 2026" })).toBe("contract");
    expect(categorizeEmail({ subject: "Proces Verbal semnat — Botez 3 mai 2026" })).toBe("contract");
    expect(categorizeEmail({ subject: "QR Moments: Ana a încărcat 3 poze" })).toBe("qr");
    expect(categorizeEmail({ subject: "👀 Ana și Dan au vizualizat poza încărcată de tine" })).toBe("qr");
    expect(categorizeEmail({ subject: "✅ ZIP actualizat: 12august2026" })).toBe("album");
    expect(categorizeEmail({ subject: "📊 Raport săptămânal AncaVisuals" })).toBe("system");
    expect(categorizeEmail({ subject: "Salut" })).toBe("other");
    expect(categorizeEmail({ subject: "Re: Contract", direction: "in" })).toBe("reply");
  });

  test("reads the event type from the subject", () => {
    expect(eventTypeOfEmail("Contract semnat — Nuntă 12 iulie 2026")).toBe("Nuntă");
    expect(eventTypeOfEmail("Reminder: Contract nesemnat — Majorat 4 decembrie")).toBe("Majorat");
    expect(eventTypeOfEmail("[Admin] Contract semnat — Botez 9 noiembrie")).toBe("Botez");
    expect(eventTypeOfEmail("✅ ZIP actualizat")).toBeNull();
  });
});

describe("email log search and filters", () => {
  const rows: EmailLogRow[] = [
    { id: "1", to: "maria@example.com", subject: "Contract semnat — Nuntă 12 iulie", status: "sent", createdAt: "2026-10-20T10:00:00Z" },
    { id: "2", to: "info@ancavisuals.ro", from: "maria@example.com", subject: "Re: Contract", status: "received", direction: "in", createdAt: "2026-10-21T10:00:00Z" },
    { id: "3", to: "x@example.com", subject: "QR Moments: Ion a încărcat 1 poză", status: "failed", createdAt: "2026-10-19T10:00:00Z" },
  ];
  const base = { query: "", direction: "all", category: "all", eventType: "all", onlyErrors: false } as const;

  test("searches without diacritics in subject, to and from", () => {
    expect(filterEmails(rows, { ...base, query: "nunta" }).map((row) => row.id)).toEqual(["1"]);
    expect(filterEmails(rows, { ...base, query: "MARIA@" }).map((row) => row.id)).toEqual(["1", "2"]);
  });

  test("filters by direction, category, event type and errors", () => {
    expect(filterEmails(rows, { ...base, direction: "in" }).map((row) => row.id)).toEqual(["2"]);
    expect(filterEmails(rows, { ...base, category: "qr" }).map((row) => row.id)).toEqual(["3"]);
    expect(filterEmails(rows, { ...base, eventType: "Nuntă" }).map((row) => row.id)).toEqual(["1"]);
    expect(filterEmails(rows, { ...base, eventType: "none" }).map((row) => row.id)).toEqual(["2", "3"]);
    expect(filterEmails(rows, { ...base, onlyErrors: true }).map((row) => row.id)).toEqual(["3"]);
  });
});
