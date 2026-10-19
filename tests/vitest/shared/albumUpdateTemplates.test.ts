import { describe, expect, test } from "vitest";
import { ALBUM_UPDATE_TEMPLATES, FOLLOW_PROGRESS, findAlbumUpdateTemplate } from "src/shared/albumUpdateTemplates";
import { ALBUM_UPDATE_TEXT_MAX } from "src/shared/albumUpdates";

const build = (id: string, params: Parameters<NonNullable<ReturnType<typeof findAlbumUpdateTemplate>>["build"]>[0]) =>
  findAlbumUpdateTemplate(id)!.build(params);

describe("album update templates", () => {
  test("estimate uses the right grammar for plural and singular deliverables", () => {
    expect(build("estimate", { deliverable: "photos", date: "2026-11-15" }))
      .toBe(`Pozele sunt în lucru. Estimăm că sunt gata în jurul datei de 15 noiembrie 2026. ${FOLLOW_PROGRESS}`);
    expect(build("estimate", { deliverable: "video", date: "2026-12-01" }))
      .toContain("Videoclipul este în lucru. Estimăm că este gata în jurul datei de 1 decembrie 2026.");
  });

  test("delay apologises for the busy period, with optional days and new date", () => {
    const full = build("delay-volume", { deliverable: "photosVideo", delayDays: 5, date: "2026-11-20" });
    expect(full).toContain("Ne cerem scuze: din cauza numărului mare de evenimente");
    expect(full).toContain("procesarea pentru pozele și videoclipul durează puțin mai mult, cu aproximativ 5 zile mai mult decât estimam.");
    expect(full).toContain("Noua estimare: 20 noiembrie 2026.");
    expect(build("delay-volume", { deliverable: "album", delayDays: 1 })).toContain("cu aproximativ 1 zi mai mult");
    expect(build("delay-volume", { deliverable: "photos" })).not.toContain("Noua estimare");
  });

  test("ready message uses the right pronoun", () => {
    expect(build("ready", { deliverable: "photos" })).toContain("Pozele sunt gata! Le găsești în album");
    expect(build("ready", { deliverable: "video" })).toContain("Videoclipul este gata! Îl găsești în album");
  });

  test("new photos with and without a count", () => {
    expect(build("new-photos", { deliverable: "photos", photoCount: 120 })).toBe("Am încărcat 120 poze noi în album. Le poți vedea și descărca chiar acum.");
    expect(build("new-photos", { deliverable: "photos" })).toBe("Am încărcat poze noi în album. Le poți vedea și descărca chiar acum.");
  });

  test("every template fits the message limit even with all inputs filled", () => {
    for (const template of ALBUM_UPDATE_TEMPLATES) {
      const text = template.build({ deliverable: "photosVideo", date: "2026-11-20", delayDays: 14, photoCount: 1200 });
      expect(text.length).toBeLessThanOrEqual(ALBUM_UPDATE_TEXT_MAX);
    }
  });
});
