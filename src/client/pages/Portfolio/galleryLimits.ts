/*
 * Purpose: how many portfolio photos the public gallery shows — shared by the gallery, the
 * /oferta landing and the admin organizer (/admin/template-oferte/:service), so the organizer
 * marks exactly which positions visitors see.
 */

/**
 * A gallery without "Vezi mai multe poze" never shows more photos than this (one long scroll).
 * With the button (`revealLimit`, /oferta/olx) there is no cap: the visitor asks for more.
 */
export const GALLERY_MAX_PHOTOS = 60;
/** Photos shown on /oferta/olx before "Vezi mai multe poze" (10 rows on desktop, 20 on a phone). */
export const GALLERY_REVEAL_DESKTOP = 40;
export const GALLERY_REVEAL_MOBILE = 40;
