import { describe, expect, test } from "vitest";
import { buildPhotoConsensus, compareByScore, consensusScore, consensusVoters, linkVisitorReviewer, PHOTO_REVIEWERS, type PhotoVote } from "src/shared/media/proposalConsensus";

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
    expect(consensusScore(photo, "all")).toEqual({ votes: 3, seenBy: 3, ratio: 1 });
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

  test("a photo is scored only among the people who reached it in the album", () => {
    const [photo] = buildPhotoConsensus([
      vote("a", "ancadaniel1994@gmail.com", { photoIndex: 900 }),
      vote("b", "Salomeea", { reviewerId: "salomeea", photoIndex: 900 }),
    ]);
    // Estera stopped at photo 141: photo 901 doesn't count against her.
    const coverage = { total: 1279, seen: { daniel: 1279, salomeea: 1279, estera: 141 } };
    expect(consensusScore(photo, "all", coverage)).toEqual({ votes: 2, seenBy: 2, ratio: 1 });
    // Once she gets past it without choosing it, it's 2 of 3.
    expect(consensusScore(photo, "all", { ...coverage, seen: { ...coverage.seen, estera: 1000 } })).toMatchObject({ votes: 2, seenBy: 3 });
  });

  test("more people than the three defaults can vote (new profiles)", () => {
    const reviewers = [...PHOTO_REVIEWERS, { id: "ana", name: "Ana" }];
    const [photo] = buildPhotoConsensus([
      vote("a", "Ana", { reviewerId: "ana" }), vote("b", "ancadaniel1994@gmail.com"),
    ], reviewers);
    expect(photo.voters).toEqual(["ana", "daniel"]);
  });

  test("top: most stars first, then the larger share of those who saw it, then album order", () => {
    const items = [
      { votes: 1, seenBy: 3, ratio: 1 / 3, photoIndex: 1 },
      { votes: 2, seenBy: 2, ratio: 1, photoIndex: 9 },
      { votes: 3, seenBy: 4, ratio: 3 / 4, photoIndex: 7 },
      { votes: 3, seenBy: 3, ratio: 1, photoIndex: 5 },
      { votes: 2, seenBy: 2, ratio: 1, photoIndex: 2 },
      { votes: 2, seenBy: 3, ratio: 2 / 3, photoIndex: 0 },
    ];
    expect([...items].sort(compareByScore).map(item => item.photoIndex)).toEqual([5, 7, 2, 9, 0, 1]);
  });

  test("on a personal link another profile's name is that person; any other name is the link's person", () => {
    expect(linkVisitorReviewer("salomeea", "estera", PHOTO_REVIEWERS)).toBe("estera");
    expect(linkVisitorReviewer("salomeea", "Salo", PHOTO_REVIEWERS)).toBe("salomeea");
    expect(linkVisitorReviewer(undefined, "Daniel", PHOTO_REVIEWERS)).toBeUndefined();
  });
});
