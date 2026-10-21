/*
 * Purpose: the Dashboard guide — ask Claude "unde găsesc X / cum fac Y" and get the place in the
 * menu plus a link to the page. The page map is the Dashboard search list (SEARCH_ITEMS), so a
 * page added there is known to the guide too. Server: POST /api/admin/ai-assistant/guide.
 */
import React from "react";
import AiContextChat from "./AiContextChat";
import { SEARCH_ITEMS } from "./DashboardSearch";

// The search groups use "Contracte & Oferte"; the side menu calls that group "Oferte".
const MENU_GROUP: Record<string, string> = { "Contracte & Oferte": "Oferte" };
const PAGES = SEARCH_ITEMS.map(({ label, path, category, keywords }) => ({ label, path, category: MENU_GROUP[category] ?? category, keywords: keywords ?? "" }));
const KNOWN_PATHS = new Set(PAGES.map((page) => page.path));
// Links to a known page, optionally to a section on it (/admin/preturi#date-ocupate).
const isKnownPath = (path: string) => KNOWN_PATHS.has(path.split(/[?#]/)[0]);

export default function AdminGuideChat({ accessToken }: { accessToken: string }) {
  return (
    <div>
      <AiContextChat
        context=""
        accessToken={accessToken}
        endpoint="/api/admin/ai-assistant/guide"
        extraBody={{ pages: PAGES }}
        isLinkablePath={isKnownPath}
        title="Ghidul AI"
        placeholder="Ex: unde schimb prețurile pentru o dată ocupată?"
        greeting="Cu ce te pot ajuta?"
        alwaysOpen
        tone="green"
      />
    </div>
  );
}
