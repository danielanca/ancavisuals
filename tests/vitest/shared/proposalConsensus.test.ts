import { describe, expect, test } from "vitest";
import { buildPhotoConsensus, consensusVoters, matchesConsensus, type PhotoVote } from "src/shared/media/proposalConsensus";

const vote = (id: string, proposedBy: string, extra: Partial<PhotoVote> = {}): PhotoVote => ({
  id, proposedBy, albumSlug: "album", fileName: "IMG_1.jpg", photoUrl: "https://cdn.test/album/photos/IMG_1.jpg", ...extra,
});

describe("photo consensus", () => {
  test("same photo chosen by the three reviewers reaches unanimous agreement", () => {
    const [photo] = buildPhotoConsensus([
      vote("daniel", "ancadaniel1994@gmail.com"), vote("estera", "estera.pop97@gmail.com"),
      vote("salomeea", "Nume liber", { proposedVia: "link", reviewerId: "salomeea" }),
    ]);
    expect(photo.voters).toEqual(["daniel", "estera", "salomeea"]);
    expect(matchesConsensus(photo.voters.length, "three")).toBe(true);
  });

  test("account and multiple personal links for one reviewer count once", () => {
    const [photo] = buildPhotoConsensus([
      vote("account", "ancadaniel1994@gmail.com"),
      vote("link-1", "Daniel", { reviewerId: "daniel", proposedVia: "link", proposedByUid: "link:token1:visitor1" }),
      vote("link-2", "Alt nume", { reviewerId: "daniel", proposedVia: "link", proposedByUid: "link:token2:visitor2" }),
    ]);
    expect(photo.voters).toEqual(["daniel"]);
    expect(photo.ids).toHaveLength(3);
  });

  test("preview and original are grouped, separate albums and distinct photos are not", () => {
    const photos = buildPhotoConsensus([
      vote("a", "ancadaniel1994@gmail.com"), vote("b", "estera.pop97@gmail.com", { fileName: "IMG_1.webp" }),
      vote("c", "ancadaniel1994@gmail.com", { albumSlug: "other-album" }),
      vote("d", "ancadaniel1994@gmail.com", { fileName: "IMG_2.jpg" }),
    ]);
    expect(photos).toHaveLength(3);
    expect(photos[0].voters).toHaveLength(2);
  });

  test("counts destination agreement separately and retains the actual selection after moderation", () => {
    const [photo] = buildPhotoConsensus([
      vote("a", "ancadaniel1994@gmail.com", { destinations: ["instagram", "media_assets"] }),
      vote("b", "estera.pop97@gmail.com", { selectionDestinations: ["instagram"], destinations: ["media_assets"] }),
      vote("c", "Salomeea", { reviewerId: "salomeea", destinations: ["media_assets"] }),
    ]);
    expect(consensusVoters(photo, "all")).toHaveLength(3);
    expect(consensusVoters(photo, "instagram")).toEqual(["daniel", "estera"]);
    expect(consensusVoters(photo, "media_assets")).toEqual(["daniel", "salomeea"]);
  });

  test("a generic visitor cannot become Daniel by typing his name or email", () => {
    expect(buildPhotoConsensus([
      vote("a", "Daniel", { proposedVia: "link", proposalLinkLabel: "Altă persoană" }),
      vote("b", "ancadaniel1994@gmail.com", { proposedVia: "link", proposalLinkLabel: "Altă persoană" }),
      vote("c", "guest@example.com"),
    ])).toEqual([]);
  });

  test("legacy links with an admin-assigned reviewer label still contribute", () => {
    const [photo] = buildPhotoConsensus([vote("a", "Alt nume", { proposedVia: "link", proposalLinkLabel: " Salomeea " })]);
    expect(photo.voters).toEqual(["salomeea"]);
  });

  test("filters include unanimous photos in at least two, but not in single selections", () => {
    expect([0, 1, 2, 3].filter(count => matchesConsensus(count, "three"))).toEqual([3]);
    expect([0, 1, 2, 3].filter(count => matchesConsensus(count, "two"))).toEqual([2, 3]);
    expect([0, 1, 2, 3].filter(count => matchesConsensus(count, "one"))).toEqual([1]);
  });
});
