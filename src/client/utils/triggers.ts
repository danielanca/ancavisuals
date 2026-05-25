import { destination } from "./address";

interface EventsTrigger {
  typeEvent: string;
  url: string;
  isNewVisitor?: boolean;
}

const sanitizeInput = (input: string): string =>
  input.replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const sendTriggerEmail = async ({ typeEvent, url, isNewVisitor }: EventsTrigger) => {
  if (!typeEvent || !url) {
    throw new Error("Invalid input: typeEvent and url are required.");
  }

  const response = await fetch(`${destination}/triggerEvent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    mode: "cors",
    body: JSON.stringify({
      typeEvent: sanitizeInput(typeEvent),
      url: sanitizeInput(url),
      browserVersion: navigator.userAgent,
      referrer: sanitizeInput(document.referrer || "direct"),
      isNewVisitor: isNewVisitor ?? true,
    }),
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`Server error: ${response.statusText}`);
  }

  return response;
};
