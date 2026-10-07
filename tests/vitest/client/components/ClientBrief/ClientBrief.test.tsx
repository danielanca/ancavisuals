import React, { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import ClientBriefPage from "src/client/features/client-brief/ClientBriefPage";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import BriefForm from "src/client/features/client-brief/BriefForm";
import CreateClientBriefLink from "src/client/features/client-brief/CreateClientBriefLink";
import { emptyBriefAnswers, getBriefMoments } from "src/shared/clientBrief/clientBrief";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async importOriginal => ({ ...await importOriginal<any>(), useNavigate: () => navigate }));
vi.mock("src/client/features/admin/auth/useAuth", () => ({ default: () => ({ auth: { accessToken: "admin-token" } }) }));
afterEach(() => { vi.unstubAllGlobals(); navigate.mockClear(); });
function Form() {
  const [answers, setAnswers] = useState(emptyBriefAnswers());
  return <BriefForm answers={answers} moments={getBriefMoments("Nuntă")} onChange={setAnswers} />;
}
test("simple checklist keeps photos implicit, expands writing fields and supports full religious recording", () => {
  render(<Form />);
  expect(screen.getByText("Poze de grup cu invitații")).toBeInTheDocument();
  expect(screen.getByText(/În dimineața nunții vă vom reaminti/)).toHaveTextContent("Va trebui să ni le indicați personal");
  expect(screen.queryByLabelText("Ce vă doriți să surprindem?")).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  const religious = screen.getByRole("region", { name: "Cununia religioasă (dacă există)" });
  const planned = within(religious).getByRole("checkbox", { name: "Cununia religioasă (dacă există)" });
  expect(within(religious).queryByRole("textbox")).not.toBeInTheDocument();
  fireEvent.click(planned);
  const full = within(religious).getByRole("checkbox", { name: "Vrem filmarea întregii ceremonii religioase, cu sunet" });
  fireEvent.click(full);
  expect(full).toBeChecked();
  const details = within(religious).getByRole("textbox");
  fireEvent.change(details, { target: { value: "Bunicii în primul rând" } });
  fireEvent.click(planned);
  expect(within(religious).queryByRole("textbox")).not.toBeInTheDocument();
  fireEvent.click(planned);
  expect(within(religious).getByRole("textbox")).toHaveValue("Bunicii în primul rând");
  expect(within(religious).getByRole("checkbox", { name: "Vrem filmarea întregii ceremonii religioase, cu sunet" })).not.toBeChecked();
});

test("dashboard action creates the event's brief with auth and opens its admin page", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ brief: {} }) });
  vi.stubGlobal("fetch", fetchMock);
  render(<MemoryRouter><CreateClientBriefLink eventId="event-123" /></MemoryRouter>);
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Creează brief client" }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/admin/events/event-123/brief"));
  expect(fetchMock).toHaveBeenCalledWith("/api/client-briefs/admin/events/event-123", { method: "POST", headers: { Authorization: "Bearer admin-token" } });
});
test("failed creation stays on dashboard and shows retryable error", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Evenimentul nu există." }) }));
  render(<MemoryRouter><CreateClientBriefLink eventId="missing" /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Creează brief client" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Evenimentul nu există.");
  expect(navigate).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Creează brief client" })).toBeEnabled();
});

const clientBrief = {
  clientName: "Ana și Andrei", eventType: "Nuntă", eventDate: "2027-06-20T00:00:00.000Z",
  moments: getBriefMoments("Nuntă"), answers: emptyBriefAnswers(), status: "draft", revision: 0,
  updatedAt: "2026-10-06T10:00:00.000Z", submittedAt: null,
};
function renderClient() {
  return render(<HelmetProvider><MemoryRouter initialEntries={["/brief-client/test-token"]}><Routes>
    <Route path="/brief-client/:token" element={<ClientBriefPage />} />
  </Routes></MemoryRouter></HelmetProvider>);
}
test("client saves progress and submits updated priorities through the same event link", async () => {
  const fetchMock = vi.fn().mockImplementation(async (_url: string, options?: RequestInit) => {
    const sent = options?.body ? JSON.parse(String(options.body)) : null;
    return { ok: true, json: async () => ({ brief: sent ? { ...clientBrief, answers: sent.answers, status: sent.status, revision: sent.revision + 1 } : clientBrief }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  renderClient();
  const priorities = await screen.findByLabelText(/Ce contează cel mai mult pentru voi/);
  fireEvent.change(priorities, { target: { value: "Bunicii și fotografiile cu invitații" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvează progresul" }));
  expect(await screen.findByText(/Progresul a fost salvat/)).toBeInTheDocument();
  let body = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(body).toMatchObject({ revision: 0, status: "draft", answers: { priorities: "Bunicii și fotografiile cu invitații" } });
  fireEvent.click(screen.getByRole("button", { name: "Trimite brief-ul" }));
  expect(await screen.findByText(/Am primit brief-ul vostru/)).toBeInTheDocument();
  body = JSON.parse(fetchMock.mock.calls[2][1].body);
  expect(body).toMatchObject({ revision: 1, status: "completed" });
  expect(fetchMock.mock.calls.every(call => call[0] === "/api/client-briefs/test-token")).toBe(true);
});
test("client keeps unsaved answers on failed save", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ brief: clientBrief }) })
    .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Încercați din nou." }) }));
  renderClient();
  const priorities = await screen.findByLabelText(/Ce contează cel mai mult pentru voi/);
  fireEvent.change(priorities, { target: { value: "Familia" } });
  fireEvent.click(screen.getByRole("button", { name: "Trimite brief-ul" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Încercați din nou.");
  expect(priorities).toHaveValue("Familia");
  expect(screen.getByRole("button", { name: "Trimite brief-ul" })).toBeEnabled();
});
