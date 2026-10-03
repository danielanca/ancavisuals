// Usercentrics loads only after the first interaction (see entry-client.tsx). On phones
// the tap on "Setări cookie" IS that first interaction, so the CMP isn't there yet —
// ask entry-client to load it now and open the banner as soon as it's ready.
export const LOAD_USERCENTRICS_EVENT = "av:load-usercentrics";

const OPEN_TIMEOUT_MS = 10_000;

type UcUi = { showFirstLayer?: () => unknown };
const getUcUi = () => (window as unknown as Record<string, unknown>)["UC_UI"] as UcUi | undefined;

// Reopens the Usercentrics banner so visitors can change or withdraw consent.
// Needed wherever the page has no floating privacy button (hidden after a decision).
export function openCookieSettings(): void {
  if (typeof getUcUi()?.showFirstLayer === "function") {
    getUcUi()!.showFirstLayer!();
    return;
  }

  let done = false;
  const finish = (open: boolean) => {
    if (done) return;
    done = true;
    window.removeEventListener("UC_UI_INITIALIZED", onReady);
    window.clearInterval(poll);
    window.clearTimeout(timeout);
    if (open) getUcUi()?.showFirstLayer?.();
  };
  const onReady = () => finish(true);
  window.addEventListener("UC_UI_INITIALIZED", onReady);
  const poll = window.setInterval(() => {
    if (typeof getUcUi()?.showFirstLayer === "function") finish(true);
  }, 250);
  const timeout = window.setTimeout(() => {
    finish(false);
    console.info("[Usercentrics] Bannerul de cookie nu s-a încărcat (pe localhost nu rulează).");
  }, OPEN_TIMEOUT_MS);

  window.dispatchEvent(new Event(LOAD_USERCENTRICS_EVENT));
}
