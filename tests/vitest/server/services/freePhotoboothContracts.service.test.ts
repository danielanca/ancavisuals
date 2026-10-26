import { beforeEach, describe, expect, it, vi } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
const { get, select, where, collection } = vi.hoisted(() => {
  const get = vi.fn();
  const select = vi.fn(() => ({ get }));
  const where = vi.fn(() => ({ select }));
  return { get, select, where, collection: vi.fn(() => ({ where })) };
});
vi.mock("src/server/firestore", () => ({ firestore: () => ({ collection }) }));
import { getFreePhotoboothContracts } from "src/server/services/freePhotoboothContracts.service";
const base = {
  status: "signed", clientName: "Mariana Xulescu", clientCity: "Sibiu",
  signedAt: Timestamp.fromDate(new Date("2026-10-12T08:00:00Z")),
  services: [{ label: "Fotocabină / Photo Booth", gratuit: true, price: 0 }],
};
function records(data: Record<string, unknown>[]) {
  get.mockResolvedValue({ docs: data.map(value => ({ data: () => value })) });
}
describe("public free photobooth contracts", () => {
  beforeEach(() => vi.clearAllMocks());
  it("masks names on the server and returns only public fields, newest first", async () => {
    records([
      { ...base, signedAt: "2026-10-11T08:00:00Z", token: "secret", clientPhone: "secret", clientAddress: "secret" },
      base,
    ]);
    expect(await getFreePhotoboothContracts()).toEqual([
      { maskedName: "Ma****a Xu****u", city: "Sibiu", signedAt: "2026-10-12T08:00:00.000Z" },
      { maskedName: "Ma****a Xu****u", city: "Sibiu", signedAt: "2026-10-11T08:00:00.000Z" },
    ]);
    expect(collection).toHaveBeenCalledWith("contracts");
    expect(where).toHaveBeenCalledWith("status", "==", "signed");
    expect(select).toHaveBeenCalledWith("status", "clientType", "privateClient", "clientName", "clientCity", "signedAt", "services");
  });
  it("excludes unsigned, cancelled, private, company, paid and invalid records", async () => {
    records([
      { ...base, status: "draft" }, { ...base, status: "anulat" },
      { ...base, privateClient: true }, { ...base, clientType: "PJ" },
      { ...base, services: [{ label: "Fotocabină", price: 0, gratuit: false }] },
      { ...base, signedAt: "bad" }, { ...base, signedAt: null },
      { ...base, clientName: " " }, { ...base, services: null },
    ]);
    expect(await getFreePhotoboothContracts()).toEqual([]);
  });
  it("counts a free videobooth too: the couple picks the photo booth or the videobooth", async () => {
    records([{ ...base, services: [{ label: "Video Cabină 360 / VideoBooth", gratuit: true }] }]);
    expect(await getFreePhotoboothContracts()).toHaveLength(1);
  });
  it("handles custom booth labels, missing city and short names without exposing them fully", async () => {
    records([{ ...base, clientName: "A Li Ana-Maria", clientCity: null, services: [{ label: "PhotoBooth", gratuit: true }] }]);
    expect(await getFreePhotoboothContracts()).toEqual([
      { maskedName: "* L* An******a", city: "", signedAt: "2026-10-12T08:00:00.000Z" },
    ]);
  });
});
