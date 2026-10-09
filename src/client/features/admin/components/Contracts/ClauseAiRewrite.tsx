import React, { useEffect, useRef, useState } from "react";
import useAuth from "../../auth/useAuth";

type Proposal = { title: string; body: string; text: string; sourceTitle: string; sourceBody: string };

export default function ClauseAiRewrite({ title, body, onApply }: {
  title: string; body: string; onApply: (clause: { title: string; body: string }) => void;
}) {
  const { auth } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const current = useRef({ title, body });
  current.current = { title, body };
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function rewrite(mode: "correct" | "formal") {
    if (busy) return;
    setBusy(true); setError(null); setProposal(null);
    const sourceTitle = title, sourceBody = body;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45000);
    try {
      const token = auth.user ? await auth.user.getIdToken(false) : auth.accessToken;
      if (!token) throw new Error("Sesiunea a expirat. Reautentifică-te.");
      const response = await fetch("/api/admin/contract-clause-templates/rewrite", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, body, mode }), signal: controller.signal,
      });
      const data = await response.json() as { clause?: { title: string; body: string; text: string }; error?: string };
      if (!response.ok || !data.clause) throw new Error(data.error ?? "Reformularea AI a eșuat.");
      if (!mounted.current) return;
      if (current.current.title !== sourceTitle || current.current.body !== sourceBody) {
        setError("Ai modificat textul între timp. Cere o nouă reformulare pentru varianta actuală."); return;
      }
      setProposal({ ...data.clause, sourceTitle, sourceBody });
    } catch (err) {
      if (mounted.current) setError(err instanceof Error && err.name !== "AbortError" ? err.message : "AI nu a răspuns la timp. Textul tău a rămas neschimbat.");
    } finally {
      window.clearTimeout(timeout);
      if (mounted.current) setBusy(false);
    }
  }
  const hasText = !!body.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  const visibleProposal = proposal && proposal.sourceTitle === title && proposal.sourceBody === body ? proposal : null;
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !title.trim() || !hasText} onClick={() => rewrite("correct")} className="px-3 py-1.5 text-xs rounded-lg bg-violet-500/15 text-violet-300 disabled:opacity-40">{busy ? "Se reformulează..." : "Corectează cu AI"}</button>
        <button type="button" disabled={busy || !title.trim() || !hasText} onClick={() => rewrite("formal")} className="px-3 py-1.5 text-xs rounded-lg bg-violet-500/15 text-violet-300 disabled:opacity-40">Fă mai formal cu AI</button>
      </div>
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
      {visibleProposal && (
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 space-y-2">
          <p className="text-xs text-violet-300">Propunere AI</p>
          <p className="text-sm font-medium text-white">{visibleProposal.title}</p>
          <p className="text-sm text-neutral-300 whitespace-pre-wrap">{visibleProposal.text}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => { onApply({ title: visibleProposal.title, body: visibleProposal.body }); setProposal(null); }} className="text-xs text-emerald-400 px-2 py-1">Aplică propunerea</button>
            <button type="button" onClick={() => setProposal(null)} className="text-xs text-neutral-400 px-2 py-1">Păstrează textul meu</button>
          </div>
        </div>
      )}
    </div>
  );
}
