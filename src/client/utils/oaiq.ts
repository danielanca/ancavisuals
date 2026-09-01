export function measureOaiq(eventName: string, properties: Record<string, string> = {}): void {
  if (typeof window === "undefined" || typeof window.oaiq !== "function") return;
  window.oaiq("measure", eventName, properties);
}
