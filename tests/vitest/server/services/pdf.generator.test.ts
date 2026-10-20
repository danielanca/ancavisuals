/*
 * Purpose: verifies that the contract PDF generator builds safe, contract-aware HTML
 * and delegates correctly to puppeteer without launching a real browser.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const buildModule = async () => {
  const setContentMock = vi.fn().mockResolvedValue(undefined);
  const pdfMock = vi.fn().mockResolvedValue(Uint8Array.from([1, 2, 3]));
  const closeMock = vi.fn().mockResolvedValue(undefined);
  const emulateMediaTypeMock = vi.fn().mockResolvedValue(undefined);
  const newPageMock = vi.fn().mockResolvedValue({
    setContent: setContentMock,
    pdf: pdfMock,
    emulateMediaType: emulateMediaTypeMock,
  });
  const launchMock = vi.fn().mockResolvedValue({
    newPage: newPageMock,
    close: closeMock,
  });

  vi.doMock("puppeteer", () => ({
    default: {
      launch: launchMock,
    },
  }));

  const module = await import("src/server/services/pdf.generator");
  return { ...module, setContentMock, pdfMock, closeMock, launchMock };
};

describe("generateContractPDF", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  describe("happy path", () => {
    test("renders the stored transport price in the contract currency", async () => {
      const { buildContractHTML } = await buildModule();
      const html = buildContractHTML({
        currency: "EUR", eurRate: 5, transportKm: "120", transportFuelPrice: "11",
        services: [{ label: "Transport", price: 16, isTransport: true }],
        priceTotal: 16, priceAdvance: 0,
      });
      expect(html).toContain("~16 EUR");
      expect(html).not.toContain("~80 EUR");
      expect(html).toContain("120 km × 6L/100km × 11 lei/L");
    });

    test("renders escaped HTML and includes the bank section for non-cash payments", async () => {
      const { generateContractPDF, setContentMock, pdfMock, closeMock, launchMock } = await buildModule();

      const result = await generateContractPDF({
        eventType: "Nuntă <script>alert(1)</script>",
        eventDate: "2026-09-12",
        clientName: "Ion & Maria",
        clientIdSeries: "AB123456",
        clientAddress: "Str. Exemplu <1>",
        clientPhone: "0712345678",
        clientIp: "127.0.0.1",
        createdAt: "2026-04-10T12:00:00.000Z",
        signedAt: "2026-04-11T09:00:00.000Z",
        eventStartTime: "14:00",
        eventEndTime: "23:00",
        paymentMethod: "Transfer bancar",
        bankBeneficiaryName: "Beneficiar Test",
        bankIban: "RO49AAAA1B31007593840000",
        currency: "RON",
        priceTotal: 1200,
        priceAdvance: 200,
        services: [{ label: "Foto <Premium>", price: 500 }],
        clientSignatureBase64: "data:image/png;base64,abc",
      });

      expect(launchMock).toHaveBeenCalledTimes(1);
      expect(setContentMock).toHaveBeenCalledTimes(1);
      const html = setContentMock.mock.calls[0][0] as string;
      expect(html).toContain("Nuntă &lt;script&gt;alert(1)&lt;/script&gt;");
      expect(html).toContain("Ion &amp; Maria");
      expect(html).toContain("Foto &lt;Premium&gt;");
      expect(html).toContain("Plata se realizează în contul beneficiarului:");
      expect(html).toContain("Beneficiar Test");
      expect(html).toContain("RO49AAAA1B31007593840000");
      expect(html).toContain('alt="Semnatura"');
      expect(pdfMock).toHaveBeenCalledTimes(1);
      expect(closeMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual(Buffer.from(Uint8Array.from([1, 2, 3])));
    });
  });

  describe("fallback and conditional rendering", () => {
    test("omits the bank transfer paragraph for cash payments and shows placeholders for missing beneficiary data", async () => {
      const { generateContractPDF, setContentMock } = await buildModule();

      await generateContractPDF({
        eventDate: "invalid-date",
        paymentMethod: "Cash",
        services: [],
        priceTotal: 0,
        priceAdvance: 0,
      });

      const html = setContentMock.mock.calls[0][0] as string;
      expect(html).not.toContain("Plata se realizează în contul:");
      expect(html).toContain("Plata se realizează în numerar (cash)");
      expect(html).toContain("________________________");
      expect(html).toContain("Metodă de plată: Cash.");
      // An invalid date produces the "___________" placeholder (formatDate guard)
      expect(html).toContain("___________");
    });
  });
});

describe("custom contract clauses", () => {
  test("custom-only snapshots preserve the legacy clauses and append a separate titled article", async () => {
    const { buildContractHTML } = await buildModule();
    const html = buildContractHTML({ eventType: "Nuntă", services: [], clauses: [{ templateId: "custom:1", key: "custom:1", title: "Ora <specială>", body: "<p>Activitatea se încheie la 23:00.</p>", order: 1, groupKey: null }] });
    expect(html).toContain("POLITICA DE ANULARE");
    expect(html).toContain("PROTECȚIA DATELOR PERSONALE");
    expect(html).toContain("ORA &lt;SPECIALĂ&gt;");
    expect(html).toContain("Activitatea se încheie la 23:00.");
  });
  test("custom and library clauses render once in their saved order", async () => {
    const { buildContractHTML } = await buildModule();
    const html = buildContractHTML({ eventType: "Nuntă", services: [], clauses: [
      { templateId: "standard", key: "standard", title: "Clauză selectată", body: "<p>Text standard salvat.</p>", order: 5, groupKey: null },
      { templateId: "custom:1", key: "custom:1", title: "Clauză nouă", body: "<p>Text nou salvat.</p>", order: 6, groupKey: null },
    ] });
    expect(html.indexOf("Text standard salvat.")).toBeLessThan(html.indexOf("Text nou salvat."));
    expect(html.split("Text nou salvat.")).toHaveLength(2);
    expect(html).not.toContain("POLITICA DE ANULARE");
  });

  describe("eveniment de zi sau de noapte", () => {
    test("an unsigned contract shows the empty declaration the client must complete", async () => {
      const { buildNightEventHtml } = await buildModule();
      const html = buildNightEventHtml({ eventType: "Nuntă", status: "sent" });
      expect(html).toContain("☐ ESTE / ☐ NU ESTE eveniment de noapte");
      expect(html).toContain("Fotografii și videografii trebuie să știe din timp");
      expect(html).toContain("200 lei pentru fiecare jumătate de oră începută");
    });

    test("a day event explains the 25-minute tolerance from 00:00", async () => {
      const { buildNightEventHtml } = await buildModule();
      const html = buildNightEventHtml({ eventType: "Botez", status: "signed", nightEvent: "nu" });
      expect(html).toContain("NU ESTE eveniment de noapte");
      expect(html).toContain("începând cu ora 00:25");
      expect(html).toContain("până la ora 01:25 — 400 lei");
    });

    test("a night event includes the declared end time in the price", async () => {
      const { buildNightEventHtml } = await buildModule();
      const html = buildNightEventHtml({ eventType: "Nuntă", status: "signed", nightEvent: "da", nightEventEndTime: "03:00" });
      expect(html).toContain("ESTE eveniment de noapte</span> (se prelungește după ora 00:00), cu ora estimată de final <span class=\"bold\">03:00");
      expect(html).toContain("până la ora de final declarată este inclusă în prețul contractului");
    });

    test("contracts signed before the clause existed stay unchanged", async () => {
      const { buildNightEventHtml, buildContractHTML } = await buildModule();
      expect(buildNightEventHtml({ eventType: "Nuntă", status: "signed" })).toBe("");
      expect(buildContractHTML({ eventType: "Nuntă", status: "signed", services: [] })).not.toContain("Eveniment de zi sau de noapte");
    });

    test("photo sessions and funerals never get the clause", async () => {
      const { buildNightEventHtml } = await buildModule();
      expect(buildNightEventHtml({ eventType: "Ședință foto", status: "sent" })).toBe("");
      expect(buildNightEventHtml({ eventType: "Înmormântare", status: "sent" })).toBe("");
    });
  });

  describe("video playback compatibility clause", () => {
    const video = [{ label: "Video 4K", price: 1000 }];

    test("video contracts state MP4/H.264/4K and laptop/PC-only responsibility", async () => {
      const { buildContractHTML } = await buildModule();
      const html = buildContractHTML({ eventType: "Nuntă", status: "sent", services: video });
      expect(html).toContain("COMPATIBILITATEA MATERIALELOR VIDEO");
      expect(html).toContain("H.264");
      expect(html).toContain("30 Mbps");
      expect(html).toContain("din 4K în format Full HD");
    });

    test("photo-only contracts and contracts signed before the clause existed don't get it", async () => {
      const { buildContractHTML } = await buildModule();
      expect(buildContractHTML({ eventType: "Nuntă", status: "sent", services: [{ label: "Foto", price: 500 }] })).not.toContain("COMPATIBILITATEA MATERIALELOR VIDEO");
      expect(buildContractHTML({ eventType: "Nuntă", status: "signed", signedAt: "2026-09-01T10:00:00.000Z", services: video })).not.toContain("COMPATIBILITATEA MATERIALELOR VIDEO");
      expect(buildContractHTML({ eventType: "Nuntă", status: "signed", signedAt: "2026-10-22T10:00:00.000Z", services: video })).toContain("COMPATIBILITATEA MATERIALELOR VIDEO");
    });
  });
});
