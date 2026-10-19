/*
 * Purpose: verifies the clause templates ("șabloane") — creating the default Nuntă/Botez/
 * Majorat/Corporate templates from the library, saving one template without touching others,
 * and generating contract clauses from a chosen template.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

type Doc = { id: string; data: Record<string, unknown> };

const state = vi.hoisted(() => ({
  library: [] as Doc[],
  sets: [] as Doc[],
  added: [] as { collection: string; data: Record<string, unknown> }[],
  updated: [] as { id: string; data: Record<string, unknown> }[],
}));

vi.mock("src/server/services/contractClauseAi.service", () => ({ rewriteContractClause: vi.fn() }));
vi.mock("src/server/middleware/requireFirebaseAuth", () => ({
  requireFirebaseAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireSupremeAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("src/server/firestore", () => ({
  firestore: () => ({
    collection: (name: string) => {
      const docs = name === "contractClauseSets" ? state.sets : state.library;
      return {
        get: async () => ({ docs: docs.map((d) => ({ id: d.id, data: () => d.data, ref: { id: d.id } })) }),
        add: async (data: Record<string, unknown>) => {
          state.added.push({ collection: name, data });
          return { id: `new-${state.added.length}` };
        },
        doc: (id: string) => ({
          get: async () => {
            const found = docs.find((d) => d.id === id);
            return { exists: !!found, id, data: () => found?.data };
          },
          update: async (data: Record<string, unknown>) => { state.updated.push({ id, data }); },
          delete: async () => undefined,
        }),
      };
    },
  }),
}));

import router from "src/server/routes/contractClauseTemplates.routes";

type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: { handle: (req: unknown, res: unknown) => Promise<void> }[] } };
const handler = (method: string, path: string) => {
  const layer = (router as unknown as { stack: Layer[] }).stack.find((l) => l.route?.path === path && l.route.methods[method]);
  if (!layer?.route) throw new Error(`route ${method} ${path} missing`);
  return layer.route.stack.at(-1)!.handle;
};
function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

const libClause = (key: string, appliesTo: string, order: number, extra: Record<string, unknown> = {}) => ({
  id: key,
  data: { key, title: `Titlu ${key}`, bodyTemplate: `<p>Text ${key} {{eventType}}</p>`, appliesTo, order, groupKey: null, conditionTag: null, mutexGroup: null, isActive: true, ...extra },
});

beforeEach(() => {
  state.library = [
    libClause("comun", "all", 10),
    libClause("nunta-only", "Nuntă", 20),
    libClause("botez-only", "Botez", 30),
    libClause("inactiv", "all", 40, { isActive: false }),
  ];
  state.sets = [];
  state.added = [];
  state.updated = [];
});

describe("contract clause templates", () => {
  test("creates Nuntă, Botez, Majorat and Corporate templates from the library, skipping existing ones", async () => {
    state.sets = [{ id: "s1", data: { name: "Botez", eventType: "Botez", clauses: [] } }];
    const res = response();
    await handler("post", "/sets/defaults")({}, res);

    expect(res.json).toHaveBeenCalledWith({ ok: true, created: ["Nuntă", "Majorat", "Corporate"] });
    const nunta = state.added.find((a) => a.data.eventType === "Nuntă")!.data;
    expect((nunta.clauses as { key: string }[]).map((c) => c.key)).toEqual(["comun", "nunta-only"]);
    const majorat = state.added.find((a) => a.data.eventType === "Majorat")!.data;
    expect((majorat.clauses as { key: string }[]).map((c) => c.key)).toEqual(["comun"]);
  });

  test("saving a template stores its own copy of the clauses", async () => {
    state.sets = [{ id: "s1", data: { name: "Nuntă", eventType: "Nuntă", clauses: [] } }];
    const res = response();
    await handler("put", "/sets/:id")({
      params: { id: "s1" },
      body: { name: " Nuntă de noapte ", eventType: "Nuntă", clauses: [
        { key: "a", title: "Prima", bodyTemplate: "<p>Unu</p>", isActive: true },
        { key: "a", title: "A doua", bodyTemplate: "<p>Doi</p>", isActive: false },
      ] },
    }, res);

    const saved = state.updated[0];
    expect(saved.id).toBe("s1");
    expect(saved.data).toMatchObject({ name: "Nuntă de noapte", eventType: "Nuntă" });
    expect(saved.data.clauses).toEqual([
      expect.objectContaining({ key: "a", order: 10, isActive: true }),
      expect.objectContaining({ key: "a-2", order: 20, isActive: false }),
    ]);
  });

  test("rejects a template with an empty clause", async () => {
    state.sets = [{ id: "s1", data: { name: "Nuntă", clauses: [] } }];
    const res = response();
    await handler("put", "/sets/:id")({
      params: { id: "s1" },
      body: { name: "Nuntă", clauses: [{ title: "Gol", bodyTemplate: "<p>&nbsp;</p>" }] },
    }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(state.updated).toHaveLength(0);
  });

  test("duplicates a template", async () => {
    state.sets = [{ id: "s1", data: { name: "Nuntă", eventType: "Nuntă", clauses: [{ key: "x", title: "X", bodyTemplate: "<p>X</p>", isActive: true }] } }];
    const res = response();
    await handler("post", "/sets")({ body: { fromSetId: "s1", name: "Nuntă (copie)" } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(state.added[0].data).toMatchObject({ name: "Nuntă (copie)", eventType: null });
  });

  test("generates contract clauses from the chosen template, only active ones, with tokens filled in", async () => {
    state.sets = [{ id: "s1", data: { name: "Botez mic", eventType: null, clauses: [
      { key: "a", title: "A", bodyTemplate: "<p>Pentru {{eventType}}</p>", order: 10, groupKey: null, conditionTag: null, mutexGroup: null, isActive: true },
      { key: "b", title: "B", bodyTemplate: "<p>Ascunsă</p>", order: 20, groupKey: null, conditionTag: null, mutexGroup: null, isActive: false },
    ] } }];
    const res = response();
    await handler("post", "/render")({ body: { setId: "s1", eventType: "Botez", services: [] } }, res);

    const { clauses } = res.json.mock.calls[0][0];
    expect(clauses).toHaveLength(1);
    expect(clauses[0]).toMatchObject({ templateId: "set:s1:a", key: "a", body: "<p>Pentru Botez</p>", defaultChecked: true });
  });

  test("without a template the shared library is used as before", async () => {
    const res = response();
    await handler("post", "/render")({ body: { eventType: "Botez", services: [] } }, res);
    const { clauses } = res.json.mock.calls[0][0];
    expect(clauses.map((c: { key: string }) => c.key)).toEqual(["comun", "botez-only"]);
  });

  test("a deleted template returns a clear error", async () => {
    const res = response();
    await handler("post", "/render")({ body: { setId: "gone", eventType: "Nuntă", services: [] } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
