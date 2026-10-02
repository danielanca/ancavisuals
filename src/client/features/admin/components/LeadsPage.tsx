import React, { useCallback, useEffect, useState } from "react";
import useAuth from "../auth/useAuth";
import Breadcrumb from "./Breadcrumb";
import ConfirmModal from "./ConfirmModal";

type EmailStatus = "pending" | "sent" | "failed" | "skipped";

interface Lead {
  id: string;
  source: string;
  name?: string;
  phone?: string;
  eventType?: string;
  eventDate?: string;
  location?: string;
  message?: string;
  partial?: boolean;
  emailStatus: EmailStatus;
  emailReason?: string | null;
  createdAt: string;
}

interface EmailLogRow {
  id: string;
  to: string;
  subject: string;
  status: EmailStatus;
  severity?: "ok" | "info" | "error";
  source?: string;
  reason?: string;
  error?: string;
  createdAt: string;
  html?: string;
}

const STATUS_STYLE: Record<EmailStatus, { label: string; className: string }> = {
  sent: { label: "Trimis", className: "bg-green-500/10 text-green-400 border-green-500/30" },
  failed: { label: "Eșuat", className: "bg-red-500/10 text-red-400 border-red-500/30" },
  skipped: { label: "Netrimis", className: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  pending: { label: "În curs", className: "bg-neutral-700/30 text-neutral-400 border-neutral-600" },
};

const SOURCE_LABEL = (source: string) =>
  source === "configurator" ? "Configurator /contact"
    : source === "contact-form" ? "Formular contact"
      : source === "bio" ? "Pagina /bio"
      : source.startsWith("campaign:") ? `Landing /oferta/${source.slice(9)}`
        : source;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("ro-RO", {
    timeZone: "Europe/Bucharest", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// "skipped" is either expected (own traffic / duplicate → info) or an error (a lead/contact stopped by a filter).
const SKIPPED_INFO = { label: "Ignorat", className: "bg-neutral-700/30 text-neutral-400 border-neutral-600" };
const SKIPPED_ERROR = { label: "Blocat", className: "bg-red-500/10 text-red-400 border-red-500/30" };

const isEmailError = (row: { status: EmailStatus; severity?: string }) =>
  row.severity === "error" || row.status === "failed";

function StatusBadge({ status, reason, severity }: { status: EmailStatus; reason?: string | null; severity?: string }) {
  const style = status === "skipped"
    ? (severity === "error" ? SKIPPED_ERROR : severity === "info" ? SKIPPED_INFO : STATUS_STYLE.skipped)
    : STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-medium ${style.className}`} title={reason ?? undefined}>
      {style.label}{reason ? ` · ${reason}` : ""}
    </span>
  );
}

export default function LeadsPage() {
  const { auth } = useAuth();
  const [tab, setTab] = useState<"leads" | "emails">("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [emails, setEmails] = useState<EmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openEmail, setOpenEmail] = useState<EmailLogRow | null>(null);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);

  const load = useCallback(() => {
    if (!auth.accessToken) return;
    const headers = { Authorization: `Bearer ${auth.accessToken}` };
    setLoading(true);
    setError(null);
    Promise.all([
      fetch("/api/admin/leads", { headers }).then((r) => r.json()),
      fetch("/api/admin/email-log", { headers }).then((r) => r.json()),
    ])
      .then(([leadData, emailData]) => {
        setLeads(leadData.leads ?? []);
        setEmails(emailData.emails ?? []);
        if (leadData.error || emailData.error) setError(leadData.error ?? emailData.error);
      })
      .catch(() => setError("Nu s-au putut încărca datele."))
      .finally(() => setLoading(false));
  }, [auth.accessToken]);

  useEffect(load, [load]);

  const showEmail = (row: EmailLogRow) => {
    fetch(`/api/admin/email-log/${row.id}`, { headers: { Authorization: `Bearer ${auth.accessToken}` } })
      .then((r) => r.json())
      .then((data) => setOpenEmail(data.email ?? row))
      .catch(() => setOpenEmail(row));
  };

  const deleteLead = async (lead: Lead) => {
    setLeadToDelete(null);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Nu s-a putut șterge lead-ul.");
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu s-a putut șterge lead-ul.");
    }
  };

  const errorCount = emails.filter(isEmailError).length;
  const visibleEmails = onlyErrors ? emails.filter(isEmailError) : emails;

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <Breadcrumb />

        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-white text-2xl font-light tracking-tight">Lead-uri & emailuri</h1>
            <p className="text-neutral-500 text-sm mt-1">
              Fiecare cerere se salvează aici înainte de email — chiar dacă emailul nu pleacă.
            </p>
          </div>
          <button
            onClick={load}
            className="px-3 py-2 rounded-lg border border-neutral-800 text-neutral-400 text-xs hover:text-white hover:border-neutral-600 transition-colors"
          >
            Reîncarcă
          </button>
        </div>

        <div className="flex gap-2">
          {([["leads", `Lead-uri (${leads.length})`], ["emails", `Jurnal emailuri (${emails.length})${errorCount ? ` · ${errorCount} erori` : ""}`]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === key ? "bg-violet-600 text-white" : "bg-neutral-800 text-neutral-400 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {loading && <p className="text-neutral-500 text-sm">Se încarcă…</p>}

        {!loading && tab === "leads" && (
          leads.length === 0 ? (
            <p className="text-neutral-500 text-sm text-center py-16">Niciun lead salvat încă.</p>
          ) : (
            <div className="space-y-2">
              {leads.map((lead) => (
                <div key={lead.id} className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium">
                        {lead.name || "Fără nume"}
                        {lead.partial && <span className="ml-2 text-[11px] text-neutral-500">(pas 3 — configurator neterminat)</span>}
                      </p>
                      {lead.phone ? (
                        <a href={`tel:${lead.phone}`} className="text-violet-400 text-sm font-mono hover:text-violet-300">{lead.phone}</a>
                      ) : (
                        <p className="text-neutral-600 text-sm">fără telefon</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <p className="text-neutral-400 text-xs">{formatTime(lead.createdAt)}</p>
                        <button
                          onClick={() => setLeadToDelete(lead)}
                          className="text-neutral-600 hover:text-red-400 transition-colors"
                          title="Șterge lead-ul"
                          aria-label={`Șterge lead-ul ${lead.name || lead.phone || ""}`.trim()}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      </div>
                      <div className="mt-1"><StatusBadge status={lead.emailStatus} reason={lead.emailReason} /></div>
                    </div>
                  </div>
                  <p className="text-neutral-500 text-xs mt-2">
                    {[SOURCE_LABEL(lead.source), lead.eventType, lead.eventDate, lead.location].filter(Boolean).join(" · ")}
                  </p>
                  {lead.message && <p className="text-neutral-400 text-xs mt-1 whitespace-pre-wrap">{lead.message}</p>}
                </div>
              ))}
            </div>
          )
        )}

        {!loading && tab === "emails" && (
          <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer w-fit">
            <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} />
            Doar erori (emailuri eșuate sau lead-uri/contacte blocate de un filtru)
          </label>
        )}

        {!loading && tab === "emails" && (
          visibleEmails.length === 0 ? (
            <p className="text-neutral-500 text-sm text-center py-16">{onlyErrors ? "Nicio eroare. Toate emailurile au plecat." : "Niciun email în jurnal încă."}</p>
          ) : (
            <div className="space-y-2">
              {visibleEmails.map((row) => (
                <button
                  key={row.id}
                  onClick={() => showEmail(row)}
                  className={`w-full text-left p-4 rounded-xl bg-neutral-900 border hover:border-neutral-600 transition-colors ${isEmailError(row) ? "border-red-500/40" : "border-neutral-800"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-white text-sm truncate">{row.subject || "(fără subiect)"}</p>
                    <span className="text-neutral-500 text-xs flex-shrink-0">{formatTime(row.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <StatusBadge status={row.status} reason={row.reason ?? row.error} severity={row.severity} />
                    <span className="text-neutral-600 text-xs">către {row.to || "—"}</span>
                    {row.source && <span className="text-neutral-600 text-xs">· {row.source}</span>}
                  </div>
                </button>
              ))}
            </div>
          )
        )}
      </div>

      {leadToDelete && (
        <ConfirmModal
          title="Ștergi lead-ul?"
          message={`${leadToDelete.name || "Fără nume"}${leadToDelete.phone ? ` · ${leadToDelete.phone}` : ""} va fi șters definitiv din listă. Emailurile lui rămân în jurnal.`}
          confirmLabel="Șterge"
          variant="danger"
          onConfirm={() => deleteLead(leadToDelete)}
          onCancel={() => setLeadToDelete(null)}
        />
      )}

      {openEmail && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setOpenEmail(null)}>
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-neutral-800 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white text-sm font-medium">{openEmail.subject}</p>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <StatusBadge status={openEmail.status} reason={openEmail.reason ?? openEmail.error} severity={openEmail.severity} />
                  <span className="text-neutral-500 text-xs">{formatTime(openEmail.createdAt)} · către {openEmail.to}</span>
                </div>
              </div>
              <button onClick={() => setOpenEmail(null)} className="text-neutral-500 hover:text-white text-sm">Închide</button>
            </div>
            {/* Sandboxed: the body may contain visitor-typed text. */}
            <iframe title="Conținut email" sandbox="" srcDoc={openEmail.html || "<p style='font-family:sans-serif;color:#888'>Fără conținut salvat.</p>"} className="flex-1 min-h-[50vh] bg-white rounded-b-xl" />
          </div>
        </div>
      )}
    </div>
  );
}
