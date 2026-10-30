import { describe, expect, it } from "vitest";
import { toMonochromeEmail } from "../../../../src/server/notifications/emailMonochrome";

describe("toMonochromeEmail", () => {
  it("turns gold buttons black and squares their corners", () => {
    expect(toMonochromeEmail('<a style="background: #c9a96e; color: #fff; border-radius: 4px;">x</a>'))
      .toBe('<a style="background: #111111; color: #fff; border-radius:0;">x</a>');
  });

  it("turns pale coloured panels light grey", () => {
    expect(toMonochromeEmail('<div style="background:#fef3c7;border-radius:999px">')).toBe('<div style="background:#f5f5f5;border-radius:0">');
  });

  it("keeps greys, entities and alpha", () => {
    const html = '<p style="color:#555;border-top:1px solid #e5e5e5">L&#039;ok</p>';
    expect(toMonochromeEmail(html)).toBe(html);
    expect(toMonochromeEmail("color:rgba(68,44,16,0.5)")).toBe("color:rgba(17,17,17,0.5)");
  });

  it("maps named colours and bgcolor attributes", () => {
    expect(toMonochromeEmail('<td bgcolor="#22c55e" style="color: green">')).toBe('<td bgcolor="#111111" style="color: #111">');
  });
});

describe("toMonochromeEmail contrast", () => {
  it("flips dark text on a button that turned black", () => {
    expect(toMonochromeEmail('<a style="background:#f59e0b;color:#111">ok</a>')).toBe('<a style="background:#111111;color:#fff">ok</a>');
  });

  it("flips white text on a pale panel", () => {
    expect(toMonochromeEmail('<div style="background:#fef3c7;color:#fff">x</div>')).toBe('<div style="background:#f5f5f5;color:#111">x</div>');
  });
});

describe("toMonochromeEmail dark pages", () => {
  it("flips a dark admin alert to a white page with black text", () => {
    const html = '<div style="background:#0a0a0a;color:#e5e5e5"><h2 style="color:#f59e0b">Alertă</h2><p style="color:#a3a3a3">x</p></div>';
    expect(toMonochromeEmail(html)).toBe('<div style="background:#f5f5f5;color:#1a1a1a"><h2 style="color:#0a0a0a">Alertă</h2><p style="color:#5c5c5c">x</p></div>');
  });

  it("keeps a gold button readable on a dark page", () => {
    expect(toMonochromeEmail('<div style="background:#111"><a style="background:#c9a96e;color:#111">ok</a></div>'))
      .toBe('<div style="background:#eeeeee"><a style="background:#0a0a0a;color:#eeeeee">ok</a></div>');
  });
});

describe("toMonochromeEmail light pages with a black button", () => {
  it("keeps a white email white when its first background is a black button", () => {
    const html = '<div style="padding:24px;"><h2 style="color:#111">Titlu</h2><a style="background:#111;color:#fff">Vezi</a></div>';
    expect(toMonochromeEmail(html)).toBe(html);
  });

  it("reads the body's own background in a full document", () => {
    const html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="background:#0a0a0a;color:#fff"><p style="color:#fff">x</p></body></html>';
    expect(toMonochromeEmail(html)).toContain('<p style="color:#000000">x</p>');
  });
});

describe("toMonochromeEmail warm tints and shadows", () => {
  it("turns cream into neutral grey and removes shadows", () => {
    expect(toMonochromeEmail('<div style="background:#f5f1ea;box-shadow:0 8px 30px rgba(68,44,16,0.08);border:1px solid #111">'))
      .toBe('<div style="background:#f1f1f1;border:1px solid #111">');
  });
});
