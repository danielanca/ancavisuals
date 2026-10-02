import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../auth/useAuth";
import Redacted from "./Redacted";

interface Lead {
  id: string;
  source: string;
  name?: string;
  phone?: string;
  eventType?: string;
  eventDate?: string;
  partial?: boolean;
  emailStatus: "pending" | "sent" | "failed" | "skipped";
  emailReason?: string | null;
  createdAt: string;
}

const VISIBLE = 5;
const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

const SOURCE_LABEL = (source: string) =>
  source === "configurator" ? "Configurator"
    : source === "contact-form" ? "Formular contact"
      : source === "bio" ? "/bio"
        : source.startsWith("campaign:") ? `/oferta/${source.slice(9)}`
          : source;

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "acum";
  if (minutes < 60) return `acum ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `acum ${hours}h`;
  return `acum ${Math.floor(hours / 24)}z`;
}

export default function LeadsWidget() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [emailErrors, setEmailErrors] = useState(0);

  useEffect(() => {
    if (!auth.accessToken) return;
    fetch("/api/admin/leads", { headers: { Authorization: `Bearer ${auth.accessToken}` } })
      .then((r) => r.json())
      .then((d) => setLeads(d.leads ?? []))
      .catch(() => setFailed(true));
    // Funnel errors: an email that failed, or a lead/contact blocked by a filter.
    fetch("/api/admin/email-log", { headers: { Authorization: `Bearer ${auth.accessToken}` } })
      .then((r) => r.json())
      .then((d: { emails?: { status: string; severity?: string; createdAt: string }[] }) =>
        setEmailErrors((d.emails ?? []).filter((e) =>
          (e.severity === "error" || e.status === "failed") && Date.now() - new Date(e.createdAt).getTime() < RECENT_MS,
        ).length))
      .catch(() => {});
  }, [auth.accessToken]);

  if (failed || leads === null) return null;

  const recent = leads.filter((lead) => Date.now() - new Date(lead.createdAt).getTime() < RECENT_MS);
  // An email that never reached the inbox is the case to act on — surface it.
  const notDelivered = leads.filter((lead) => lead.emailStatus === "failed" || lead.emailStatus === "skipped").length;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="text-white text-sm font-medium whitespace-nowrap">Lead-uri</span>
          <span className="text-neutral-500 text-xs">{recent.length} în ultimele 7 zile</span>
          {emailErrors > 0 && (
            <button
              onClick={() => navigate("/admin/leads")}
              className="px-2 py-0.5 rounded-md border border-red-500/40 bg-red-500/10 text-red-400 text-[11px]"
            >
              {emailErrors} {emailErrors === 1 ? "eroare" : "erori"} email (7 zile)
            </button>
          )}
          {notDelivered > 0 && (
            <span className="px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[11px]">
              {notDelivered} fără email
            </span>
          )}
        </div>
        <button
          onClick={() => navigate("/admin/leads")}
          className="text-xs text-violet-400 hover:text-violet-300 whitespace-nowrap"
        >
          Vezi toate →
        </button>
      </div>

      {leads.length === 0 ? (
        <p className="px-5 py-6 text-neutral-500 text-sm">Niciun lead încă. Cererile noi apar aici imediat ce sunt trimise.</p>
      ) : (
        <ul className="divide-y divide-neutral-800">
          {leads.slice(0, VISIBLE).map((lead) => (
            <li key={lead.id} className="px-5 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white text-sm truncate">
                  <Redacted>{lead.name || "Fără nume"}</Redacted>
                  {lead.partial && <span className="ml-2 text-[11px] text-neutral-500">configurator neterminat</span>}
                </p>
                {lead.phone ? (
                  <a href={`tel:${lead.phone}`} className="text-violet-400 text-sm font-mono hover:text-violet-300">
                    <Redacted>{lead.phone}</Redacted>
                  </a>
                ) : (
                  <p className="text-neutral-600 text-xs">fără telefon</p>
                )}
                <p className="text-neutral-500 text-xs mt-0.5 truncate">
                  {[SOURCE_LABEL(lead.source), lead.eventType, lead.eventDate].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-neutral-400 text-xs">{timeAgo(lead.createdAt)}</p>
                {lead.emailStatus !== "sent" && lead.emailStatus !== "pending" && (
                  <p className="text-amber-300 text-[11px] mt-1" title={lead.emailReason ?? undefined}>
                    {lead.emailStatus === "failed" ? "email eșuat" : "email netrimis"}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
