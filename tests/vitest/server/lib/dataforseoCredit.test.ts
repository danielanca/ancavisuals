/*
 * Purpose: with no DataForSEO credit, paid SEO / Ads requests stop before calling the API and say
 * plainly "Nu avem credit"; with credit (or an unreadable balance) they go ahead.
 */
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { dataForSeoNoCreditMessage, requireDataForSeoCredit, resetDataForSeoBalanceCache } from "src/server/lib/dataforseoKeywords";

const balanceResponse = (balance: number) => ({
  ok: true,
  json: async () => ({ status_code: 20000, tasks: [{ status_code: 20000, result: [{ money: { balance, total: 1 } }] }] }),
});

beforeEach(() => {
  resetDataForSeoBalanceCache();
  vi.stubEnv("API_LOGIN_DATAFORSEO", "login");
  vi.stubEnv("API_DATAFORSEO_PASSWORD", "parola");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("a negative balance says there's no credit, with the balance", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(balanceResponse(-0.06)));
  expect(await dataForSeoNoCreditMessage()).toBe("Nu avem credit în DataForSEO (sold −$0,06), așa că nu pot aduce datele. Alimentează contul pe app.dataforseo.com, apoi încearcă din nou.");
});

test("enough credit, or a balance that can't be read, lets the request through", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(balanceResponse(4.5)));
  expect(await dataForSeoNoCreditMessage()).toBeNull();
  resetDataForSeoBalanceCache();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  expect(await dataForSeoNoCreditMessage()).toBeNull();
});

test("the balance is read once a minute, not on every request", async () => {
  const fetchMock = vi.fn().mockResolvedValue(balanceResponse(3));
  vi.stubGlobal("fetch", fetchMock);
  await dataForSeoNoCreditMessage();
  await dataForSeoNoCreditMessage();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("the route guard answers 402 without calling next; it only applies where asked", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(balanceResponse(0)));
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  const next = vi.fn();
  await requireDataForSeoCredit()({ body: {} } as never, res as never, next);
  expect(res.status).toHaveBeenCalledWith(402);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ noCredit: true, error: expect.stringContaining("Nu avem credit în DataForSEO") }));
  expect(next).not.toHaveBeenCalled();

  const serpapiNext = vi.fn();
  await requireDataForSeoCredit((req) => req.body?.provider === "dataforseo")({ body: { provider: "serpapi" } } as never, res as never, serpapiNext);
  expect(serpapiNext).toHaveBeenCalled();
});
