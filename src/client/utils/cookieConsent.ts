// Reopens the Usercentrics banner so visitors can change or withdraw consent.
// Needed wherever the page has no floating privacy button (hidden after a decision).
export function openCookieSettings(): void {
  const ucUi = (window as unknown as Record<string, unknown>)["UC_UI"] as { showFirstLayer?: () => void } | undefined;
  ucUi?.showFirstLayer?.();
}
