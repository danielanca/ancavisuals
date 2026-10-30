/*
 * Purpose: every outgoing email follows the ancavisuals style — white page, black text, square corners.
 * sendEmail runs each template's HTML through this, so an older template with gold buttons, coloured
 * badges or rounded cards still goes out monochrome:
 *  - pure greys are kept, warm/cool near-greys (cream, beige) become neutral grey; a coloured value
 *    becomes near-black (#111) or, when it was a pale tint used as a panel background, light grey (#f5f5f5);
 *  - drop shadows are removed;
 *  - an email built on a dark page (the admin alerts) is flipped to a white page: its accent colours
 *    become light first (they were meant to stand out on black), then every colour is inverted;
 *  - a button whose background and text end up both dark (or both light) gets readable text again.
 */

type Rgb = readonly [number, number, number];

const INK: Rgb = [17, 17, 17];
const PAPER: Rgb = [245, 245, 245];

/** Spread between the strongest and weakest channel under which a colour counts as grey. */
const GREY_TOLERANCE = 24;
/** On a white page, a coloured value lighter than this was a pale tint (badge/panel background). */
const PALE_LUMINANCE = 0.72;
/** On a dark page, a coloured value lighter than this was an accent meant to stand out. */
const DARK_PAGE_ACCENT_LUMINANCE = 0.2;
/** A page whose outermost background is darker than this is a dark-theme email. */
const DARK_PAGE_LUMINANCE = 0.2;

function luminance([r, g, b]: Rgb): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function parseHex(hex: string): Rgb | null {
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

const isPureGrey = ([r, g, b]: Rgb) => r === g && g === b;
const isGrey = (rgb: Rgb) => Math.max(...rgb) - Math.min(...rgb) <= GREY_TOLERANCE;

function monochrome(rgb: Rgb, darkPage: boolean): Rgb {
  // Warm or cool near-greys (cream, beige) become the neutral grey of the same lightness.
  const neutral = (value: Rgb): Rgb => { const level = Math.round(luminance(value) * 255); return [level, level, level]; };
  const grey = isGrey(rgb) ? neutral(rgb) : luminance(rgb) > (darkPage ? DARK_PAGE_ACCENT_LUMINANCE : PALE_LUMINANCE) ? PAPER : INK;
  return darkPage ? [255 - grey[0], 255 - grey[1], 255 - grey[2]] : grey;
}

/** Only the outermost styled element counts: a black button further down is not a dark page. */
export function isDarkPage(html: string): boolean {
  const bodyStart = html.search(/<body\b/i);
  const body = bodyStart >= 0 ? html.slice(bodyStart) : html;
  const outer = /<(?!meta|title|link)[a-z][a-z0-9]*\b[^>]*\bstyle="([^"]*)"/i.exec(body)?.[1] ?? "";
  const background = /background(?:-color)?\s*:\s*#([0-9a-f]{3,8})\b/i.exec(outer);
  const rgb = background ? parseHex(background[1]) : null;
  return rgb !== null && luminance(rgb) < DARK_PAGE_LUMINANCE;
}

/** A gold button with dark text becomes black, so its text must flip to white (and the reverse for pale panels). */
function keepTextReadable(style: string): string {
  const background = /background(?:-color)?\s*:\s*#([0-9a-f]{3,6})\b/i.exec(style);
  const text = /(?:^|[;\s])color\s*:\s*#([0-9a-f]{3,6})\b/i.exec(style);
  const bg = background ? parseHex(background[1]) : null;
  const fg = text ? parseHex(text[1]) : null;
  if (!text || !bg || !fg) return style;
  const bgDark = luminance(bg) < 0.5;
  if (bgDark === luminance(fg) < 0.5) return style.replace(text[0], text[0].replace(`#${text[1]}`, bgDark ? "#fff" : "#111"));
  return style;
}

const NAMED_COLOURS = /\b(color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?)(\s*:\s*[^;"']*?)\b(red|green|orange|gold|goldenrod|yellow|blue|purple|crimson|tomato|teal)\b/gi;

export function toMonochromeEmail(html: string): string {
  const darkPage = isDarkPage(html);
  return html
    .replace(NAMED_COLOURS, (_match, property: string, middle: string) => `${property}${middle}${darkPage ? "#f5f5f5" : "#111"}`)
    // Hex colours, but not HTML entities like &#039;: a colour follows ":", a space, ",", "(" or a quote (bgcolor="#…").
    .replace(/(?<=[:\s,("'])#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b/gi, (match, hex: string) => {
      const rgb = parseHex(hex);
      // On a white page pure greys are already fine: leave them exactly as written.
      if (!rgb || (!darkPage && isPureGrey(rgb))) return match;
      return rgb ? `${toHex(monochrome(rgb, darkPage))}${hex.length === 8 ? hex.slice(6) : ""}` : match;
    })
    .replace(/\b(rgba?)\(([^)]*)\)/gi, (match, fn: string, args: string) => {
      const parts = args.split(",").map((part) => part.trim());
      const rgb = parts.slice(0, 3).map(Number);
      if (rgb.length < 3 || rgb.some((channel) => !Number.isFinite(channel))) return match;
      if (!darkPage && isPureGrey([rgb[0], rgb[1], rgb[2]])) return match;
      const mapped = monochrome([rgb[0], rgb[1], rgb[2]], darkPage);
      return parts.length > 3 ? `rgba(${mapped.join(",")},${parts[3]})` : `${fn}(${mapped.join(",")})`;
    })
    // Flat, square cards: no rounded corners, no drop shadows.
    .replace(/box-shadow\s*:\s*[^;"']+;?/gi, "")
    .replace(/border-radius\s*:\s*[^;"']+/gi, "border-radius:0")
    .replace(/\bborder-radius=(["'])[^"']*\1/gi, 'border-radius="0"')
    .replace(/style="([^"]*)"/gi, (_match, style: string) => `style="${keepTextReadable(style)}"`);
}
