import { expect, test, vi } from "vitest";
import type { Router } from "express";

const seasons = [{ id: "peak", name: "Vârf", months: [8], percent: { nunta: 20, botez: 10, majorat: 0 }, color: 1 }];
const datePrices = [{ date: "2027-08-14", percent: { nunta: 10, botez: 0 } }];
vi.mock("src/server/firestore", () => ({
  firestore: () => ({
    collection: (name: string) => name === "settings"
      ? { doc: () => ({ get: async () => ({ data: () => ({ seasons, datePrices }) }) }) }
      : { get: async () => ({ docs: [] }) },
  }),
}));
vi.mock("src/server/notifications/mailer", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("src/server/constants/credentials", () => ({ adminUser: { email: "test@example.com" } }));
import assistant from "src/server/routes/assistantChat.routes";

async function sendText(text: string) {
  const layer = (assistant as Router).stack.find((entry) => entry.route?.path === "/message");
  let result: { botMessage: string } | undefined;
  const res = { status: () => res, set: () => res, json: (value: { botMessage: string }) => { result = value; return res; } };
  await layer!.route!.stack[0].handle({ body: { text } } as never, res as never, () => {});
  return result!;
}

test("a free date in a peak month shows that month's starting prices", async () => {
  const { botMessage } = await sendText("15/08/2027");
  expect(botMessage).toContain("Pentru luna august");
  expect(botMessage).toContain("nuntă de la 1.140 €");
  expect(botMessage).toContain("botez de la 275 €");
  expect(botMessage).toContain("majorat de la 200 €");
});

test("a free date outside any season shows the standard prices", async () => {
  const { botMessage } = await sendText("10/05/2027");
  expect(botMessage).toContain("nuntă de la 950 €");
});

test("a special weekend date adds its percent on top of the season", async () => {
  const { botMessage } = await sendText("14/08/2027");
  expect(botMessage).toContain("Pentru 14 august");
  expect(botMessage).toContain("nuntă de la 1.235 €");
  expect(botMessage).toContain("botez de la 275 €");
});
