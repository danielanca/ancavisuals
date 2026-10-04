import { Router, type Response } from "express";
import { firestore } from "../firestore";
import { APP_BASE_URL } from "../constants/domain";
import { applyTaskEmailAction, TASK_EMAIL_ACTIONS, validTaskEmailAction, validContinuationTime, type TaskEmailAction } from "../services/clientTaskEmailActions";

const router = Router();
function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
function page(res: Response, status: number, title: string, content: string) {
  res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" });
  res.status(status).type("html").send(`<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
    <body style="font-family:Arial,sans-serif;background:#fafafa;color:#171717;margin:0;padding:24px"><main style="max-width:480px;margin:60px auto"><h1>${title}</h1>${content}</main></body></html>`);
}
function actionOf(value: string): TaskEmailAction | null {
  return Object.hasOwn(TASK_EMAIL_ACTIONS, value) ? value as TaskEmailAction : null;
}
function unavailable(res: Response) {
  page(res, 410, "Link indisponibil", "<p>Acest link a fost folosit, a expirat sau taskul a fost modificat. Verifică taskurile din admin.</p>");
}

function actionForm(taskId: string, action: TaskEmailAction, token: string) {
  return `<form method="post" action="/api/task-email-actions/${encodeURIComponent(taskId)}/${action}">
    <input type="hidden" name="token" value="${token}">
    ${action === "tomorrow" ? `<p><label for="continuationTime">La ce oră continui mâine?</label><br>
    <input id="continuationTime" name="continuationTime" type="time" required style="margin-top:8px;padding:12px;font-size:16px;border:1px solid #aaa;border-radius:8px"></p>` : ""}
    <button style="background:#171717;color:white;border:0;border-radius:8px;padding:16px 24px;font-size:16px;cursor:pointer">${action === "tomorrow" ? "Salvează programarea" : TASK_EMAIL_ACTIONS[action]}</button></form>`;
}

// GET never mutates: email scanners/prefetchers may visit every link in a message.
router.get("/:id/:action", async (req, res) => {
  const action = actionOf(req.params.action);
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!action || !/^[a-f0-9]{64}$/.test(token)) { unavailable(res); return; }
  try {
    const doc = await firestore().collection("clientTasks").doc(req.params.id).get();
    const data = doc.data();
    if (!validTaskEmailAction(data, token, new Date())) { unavailable(res); return; }
    const detail = action === "done" ? "Taskul va fi bifat ca făcut." : action === "tomorrow"
      ? "Alege ora la care continui mâine. Taskul va apărea în timeline la ora aleasă." : "Vei primi următorul email peste 2 ore, dacă taskul rămâne nefăcut.";
    page(res, 200, TASK_EMAIL_ACTIONS[action], `<p>${escapeHtml(data?.title)}</p><p>${detail}</p>
      ${actionForm(req.params.id, action, token)}`);
  } catch (error) {
    console.error("[task email action]", error);
    page(res, 500, "Nu am putut încărca taskul", "<p>Încearcă din nou.</p>");
  }
});

router.post("/:id/:action", async (req, res) => {
  const action = actionOf(req.params.action);
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  if (!action || !/^[a-f0-9]{64}$/.test(token)) { unavailable(res); return; }
  try {
    const continuationTime = req.body?.continuationTime;
    if (action === "tomorrow" && !validContinuationTime(continuationTime)) {
      const doc = await firestore().collection("clientTasks").doc(req.params.id).get();
      if (!validTaskEmailAction(doc.data(), token, new Date())) { unavailable(res); return; }
      page(res, 400, TASK_EMAIL_ACTIONS[action], `<p>Alege o oră validă pentru continuare.</p>${actionForm(req.params.id, action, token)}`);
      return;
    }
    if (!await applyTaskEmailAction(req.params.id, token, action, new Date(), continuationTime)) { unavailable(res); return; }
    const result = action === "done" ? "Taskul este marcat ca rezolvat." : action === "tomorrow"
      ? `Continuarea taskului a fost programată pe mâine la ${escapeHtml(continuationTime)}.` : "Următorul email a fost amânat cu 2 ore.";
    page(res, 200, "Actualizare salvată", `<p>${result}</p><p><a href="${escapeHtml(APP_BASE_URL)}/admin/taskuri">Deschide taskurile clienților</a></p>`);
  } catch (error) {
    console.error("[task email action]", error);
    page(res, 500, "Nu am putut salva", "<p>Încearcă din nou.</p>");
  }
});
export default router;
