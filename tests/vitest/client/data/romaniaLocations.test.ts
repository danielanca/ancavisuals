import { describe, expect, test } from "vitest";
import { guessCounty, matchCounty } from "src/client/data/romaniaLocations";

describe("matchCounty", () => {
  test("reads Google's administrative area in any form", () => {
    expect(matchCounty("Județul Cluj")).toBe("Cluj");
    expect(matchCounty("Cluj County")).toBe("Cluj");
    expect(matchCounty("Municipiul București")).toBe("București");
    expect(matchCounty("Judetul Bistrita-Nasaud")).toBe("Bistrița-Năsăud");
    expect(matchCounty("Satu Mare")).toBe("Satu Mare");
  });

  test("finds the county inside a full address", () => {
    expect(matchCounty("Strada Republicii 1, Turda 401100, Cluj, România")).toBe("Cluj");
    expect(matchCounty("Bulevardul 1 Decembrie 1918, Alba Iulia, Alba, România")).toBe("Alba");
    expect(matchCounty("Piața Mare, Sibiu, România")).toBe("Sibiu");
  });

  test("does not match a county hidden inside another word", () => {
    expect(matchCounty("Oltenița, România")).toBeUndefined();
    expect(matchCounty("")).toBeUndefined();
    expect(matchCounty(undefined)).toBeUndefined();
  });
});

describe("guessCounty", () => {
  test("completes a unique prefix, ignoring case and diacritics", () => {
    expect(guessCounty("Sib")).toBe("Sibiu");
    expect(guessCounty("bis")).toBe("Bistrița-Năsăud");
    expect(guessCounty("maram")).toBe("Maramureș");
    expect(guessCounty("buc")).toBe("București");
    expect(guessCounty("jud. Alba")).toBe("Alba");
  });

  test("understands plate codes", () => {
    expect(guessCounty("CJ")).toBe("Cluj");
    expect(guessCounty("sb")).toBe("Sibiu");
    expect(guessCounty("B")).toBe("București");
  });

  test("waits while the prefix is ambiguous or unknown", () => {
    expect(guessCounty("Ca")).toBeUndefined();
    expect(guessCounty("Bu")).toBeUndefined();
    expect(guessCounty("xyz")).toBeUndefined();
    expect(guessCounty("")).toBeUndefined();
  });

  test("a full name that is also a prefix of nothing else stays itself", () => {
    expect(guessCounty("Olt")).toBe("Olt");
    expect(guessCounty("Mures")).toBe("Mureș");
  });
});
