import React, { useEffect, useMemo, useReducer, useState } from "react";
import Loader from "../../../components/UI/Loader";
import { useWeddingHub } from "../context/WeddingHubContext";
import { useWeddingHubAuth } from "../context/WeddingHubAuthContext";

type BroadcastResult = {
  broadcastId: string;
  confirmedGuests: number;
  status: "queued" | "processing" | "sent" | "partial" | "failed";
  channels: {
    emailConfigured: boolean;
    smsConfigured: boolean;
  };
  warnings: {
    fallbackCount: number;
    fallbacks: Array<{ guestName: string; fromChannel: "email" | "sms"; toChannel: "email" | "sms" }>;
  };
  summary: {
    emailSent: number;
    smsSent: number;
    emailFailed: number;
    smsFailed: number;
    emailSkipped: number;
    smsSkipped: number;
    failures: Array<{ channel: "email" | "sms"; guestName: string; recipient: string; reason: string }>;
    skipped: Array<{ channel: "email" | "sms"; guestName: string; recipient: string; reason: string }>;
  };
  message: string;
};

type WeddingMessageTemplate = {
  id: string;
  title: string;
  subject: string;
  body: string;
};

type BroadcastHistoryItem = {
  id: string;
  subject: string;
  status: "queued" | "processing" | "sent" | "partial" | "failed";
  recipientCount: number;
  emailSent: number;
  smsSent: number;
  emailFailed: number;
  smsFailed: number;
  emailSkipped: number;
  smsSkipped: number;
  fallbackCount: number;
  createdAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  filters: {
    audience: RecipientFilter;
    tableId: string | null;
  };
  fallbackWarnings: Array<{ guestName: string; fromChannel: "email" | "sms"; toChannel: "email" | "sms" }>;
  failures: Array<{ channel: "email" | "sms"; guestName: string; recipient: string; reason: string }>;
};

type RecipientFilter = "all" | "without-table" | "with-table" | "email-only" | "phone-only" | "both" | "no-contact";

type PageState = {
  subject: string;
  message: string;
  sendEmailToGuests: boolean;
  sendSmsToGuests: boolean;
  selectedTemplateId: string;
  recipientFilter: RecipientFilter;
  selectedTableId: string;
  activeTab: "compose" | "templates" | "history";
  isSending: boolean;
  errorMessage: string | null;
  successMessage: string | null;
  result: BroadcastResult | null;
};

type PageAction =
  | { type: "SET_FIELD"; field: "subject" | "message"; value: string }
  | { type: "SET_EMAIL_CHANNEL"; value: boolean }
  | { type: "SET_SMS_CHANNEL"; value: boolean }
  | { type: "SET_TEMPLATE"; value: string }
  | { type: "SET_FILTER"; value: RecipientFilter }
  | { type: "SET_TABLE_FILTER"; value: string }
  | { type: "SET_TAB"; value: PageState["activeTab"] }
  | { type: "SET_SENDING"; value: boolean }
  | { type: "SET_ERROR"; value: string | null }
  | { type: "SET_SUCCESS"; value: string | null }
  | { type: "SET_RESULT"; value: BroadcastResult | null };

const DEFAULT_SUBJECT = "Mesaj de la miri";
const DEFAULT_TEMPLATES: WeddingMessageTemplate[] = [
  {
    id: "reminder",
    title: "Reminder RSVP",
    subject: "Reminder RSVP",
    body: "Salut! Ne poți confirma dacă vei participa la nuntă? Ne ajută mult pentru organizarea finală.",
  },
  {
    id: "program",
    title: "Program eveniment",
    subject: "Programul pentru ziua nunții",
    body: "Îți trimitem programul pe scurt pentru ziua nunții: ora sosirii, momentul mesei și detaliile importante.",
  },
  {
    id: "dress-code",
    title: "Dress code",
    subject: "Dress code pentru nuntă",
    body: "Un mic reminder despre dress code-ul evenimentului: te rugăm să ții cont de tema aleasă de noi.",
  },
  {
    id: "seating",
    title: "Confirmare masă",
    subject: "Detalii despre masa ta",
    body: "Am actualizat planul de mese și vrem să te ținem la curent cu detaliile alocării tale.",
  },
  {
    id: "follow-up",
    title: "Ultimul follow-up",
    subject: "Ultimul follow-up înainte de eveniment",
    body: "Ne apropiem de eveniment și vrem să ne asigurăm că avem toate detaliile corecte. Mulțumim!",
  },
];

function formatDateTime(value: string | null): string {
  if (!value) return "N/A";
  try {
    return new Date(value).toLocaleString("ro-RO", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function pageReducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value, errorMessage: null, successMessage: null };
    case "SET_EMAIL_CHANNEL":
      return { ...state, sendEmailToGuests: action.value, errorMessage: null, successMessage: null };
    case "SET_SMS_CHANNEL":
      return { ...state, sendSmsToGuests: action.value, errorMessage: null, successMessage: null };
    case "SET_TEMPLATE":
      return { ...state, selectedTemplateId: action.value, errorMessage: null, successMessage: null };
    case "SET_FILTER":
      return { ...state, recipientFilter: action.value, errorMessage: null, successMessage: null };
    case "SET_TABLE_FILTER":
      return { ...state, selectedTableId: action.value, errorMessage: null, successMessage: null };
    case "SET_TAB":
      return { ...state, activeTab: action.value };
    case "SET_SENDING":
      return { ...state, isSending: action.value };
    case "SET_ERROR":
      return { ...state, errorMessage: action.value, isSending: false, successMessage: null };
    case "SET_SUCCESS":
      return { ...state, successMessage: action.value, isSending: false, errorMessage: null };
    case "SET_RESULT":
      return { ...state, result: action.value };
    default:
      return state;
  }
}

const WeddingMessagesPage: React.FC = () => {
  const { state } = useWeddingHub();
  const { coupleAuth } = useWeddingHubAuth();
  const { weddingProfile, guests, loadingProfile, loadingGuests } = state;

  const confirmedGuests = useMemo(
    () =>
      guests
        .filter((guest) => guest.rsvpStatus === "confirmat")
        .slice()
        .sort((first, second) => `${first.firstName} ${first.lastName}`.localeCompare(`${second.firstName} ${second.lastName}`)),
    [guests],
  );

  const [pageState, dispatch] = useReducer(pageReducer, {
    subject: DEFAULT_SUBJECT,
    message: "",
    sendEmailToGuests: true,
    sendSmsToGuests: true,
    selectedTemplateId: "",
    recipientFilter: "all",
    selectedTableId: "",
    activeTab: "compose",
    isSending: false,
    errorMessage: null,
    successMessage: null,
    result: null,
  });

  const filteredGuests = useMemo(() => {
    return confirmedGuests.filter((guest) => {
      if (pageState.selectedTableId && guest.tableId !== pageState.selectedTableId) return false;
      switch (pageState.recipientFilter) {
        case "without-table":
          return guest.tableId === null;
        case "with-table":
          return guest.tableId !== null;
        case "email-only":
          return Boolean(guest.email) && !guest.phone;
        case "phone-only":
          return Boolean(guest.phone) && !guest.email;
        case "both":
          return Boolean(guest.email) && Boolean(guest.phone);
        case "no-contact":
          return !guest.email && !guest.phone;
        case "all":
        default:
          return true;
      }
    });
  }, [confirmedGuests, pageState.recipientFilter, pageState.selectedTableId]);

  const recipientStats = useMemo(() => {
    const emailCount = filteredGuests.filter((guest) => Boolean(guest.email)).length;
    const phoneCount = filteredGuests.filter((guest) => Boolean(guest.phone)).length;
    const bothCount = filteredGuests.filter((guest) => Boolean(guest.email) && Boolean(guest.phone)).length;
    return {
      confirmedCount: filteredGuests.length,
      emailCount,
      phoneCount,
      bothCount,
      contactlessCount: filteredGuests.filter((guest) => !guest.email && !guest.phone).length,
    };
  }, [filteredGuests]);

  const [templates, setTemplates] = useState<WeddingMessageTemplate[]>(DEFAULT_TEMPLATES);
  const [history, setHistory] = useState<BroadcastHistoryItem[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [templatesSaving, setTemplatesSaving] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const refreshTemplates = async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const response = await fetch("/api/wedding-hub/messages/templates", {
        headers: { Authorization: `Bearer ${coupleAuth.coupleAccessToken}` },
      });
      const data = await response.json() as { templates?: WeddingMessageTemplate[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Nu s-au putut încărca șabloanele.");
      }
      if (Array.isArray(data.templates) && data.templates.length > 0) {
        setTemplates(data.templates);
      }
    } catch (error: unknown) {
      setTemplatesError((error as Error).message);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const refreshHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await fetch("/api/wedding-hub/messages/broadcasts", {
        headers: { Authorization: `Bearer ${coupleAuth.coupleAccessToken}` },
      });
      const data = await response.json() as { broadcasts?: BroadcastHistoryItem[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Nu s-a putut încărca istoricul.");
      }
      setHistory(Array.isArray(data.broadcasts) ? data.broadcasts : []);
    } catch (error: unknown) {
      setHistoryError((error as Error).message);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!coupleAuth.coupleAuthorised || !coupleAuth.coupleAccessToken) return;
    void refreshTemplates();
    void refreshHistory();
    const timer = window.setInterval(() => {
      void refreshHistory();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [coupleAuth.coupleAccessToken, coupleAuth.coupleAuthorised]);

  const deliveryPreview = useMemo(() => {
    const smsToEmailFallback = filteredGuests.filter((guest) => pageState.sendSmsToGuests && !guest.phone && Boolean(guest.email));
    const emailToSmsFallback = filteredGuests.filter((guest) => pageState.sendEmailToGuests && !guest.email && Boolean(guest.phone));
    const contactlessGuests = filteredGuests.filter((guest) => !guest.email && !guest.phone);

    if (pageState.sendSmsToGuests && !pageState.sendEmailToGuests) {
      return {
        heading: "Trimitere pe telefon",
        body: smsToEmailFallback.length > 0
          ? `Invitații fără număr de telefon vor primi mesajul pe email: ${smsToEmailFallback.map((guest) => `${guest.firstName} ${guest.lastName}`).join(", ")}.`
          : "Toți invitații din filtru au număr de telefon valid.",
        tone: smsToEmailFallback.length > 0 ? "warning" : "info",
        details: contactlessGuests,
      } as const;
    }

    if (pageState.sendEmailToGuests && !pageState.sendSmsToGuests) {
      return {
        heading: "Trimitere pe email",
        body: emailToSmsFallback.length > 0
          ? `Invitații fără email vor primi mesajul prin SMS: ${emailToSmsFallback.map((guest) => `${guest.firstName} ${guest.lastName}`).join(", ")}.`
          : "Toți invitații din filtru au email valid.",
        tone: emailToSmsFallback.length > 0 ? "warning" : "info",
        details: contactlessGuests,
      } as const;
    }

    return {
      heading: "Trimitere mixtă",
      body: "Invitații vor primi mesajul pe canalul disponibil: email, SMS sau ambele dacă există.",
      tone: "info",
      details: contactlessGuests,
    } as const;
  }, [filteredGuests, pageState.sendEmailToGuests, pageState.sendSmsToGuests]);

  useEffect(() => {
    if (!weddingProfile) return;

    dispatch({
      type: "SET_FIELD",
      field: "subject",
      value: `${DEFAULT_SUBJECT} — ${weddingProfile.brideFirstName} & ${weddingProfile.groomFirstName}`,
    });
  }, [weddingProfile?.id]);

  const handleSend = async () => {
    if (!pageState.subject.trim() || !pageState.message.trim()) {
      dispatch({ type: "SET_ERROR", value: "Subiectul și mesajul sunt obligatorii." });
      return;
    }

    if (!pageState.sendEmailToGuests && !pageState.sendSmsToGuests) {
      dispatch({ type: "SET_ERROR", value: "Alege cel puțin un canal de trimitere." });
      return;
    }

    dispatch({ type: "SET_SENDING", value: true });
    dispatch({ type: "SET_ERROR", value: null });
    dispatch({ type: "SET_SUCCESS", value: null });
    dispatch({ type: "SET_RESULT", value: null });

    try {
      const response = await fetch("/api/wedding-hub/messages/broadcasts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${coupleAuth.coupleAccessToken}`,
        },
        body: JSON.stringify({
          subject: pageState.subject.trim(),
          message: pageState.message.trim(),
          sendEmailToGuests: pageState.sendEmailToGuests,
          sendSmsToGuests: pageState.sendSmsToGuests,
          templateId: pageState.selectedTemplateId || null,
          filters: {
            audience: pageState.recipientFilter,
            tableId: pageState.selectedTableId || null,
          },
        }),
      });

      const data = await response.json() as BroadcastResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Nu s-au putut trimite mesajele.");
      }

      dispatch({ type: "SET_RESULT", value: data });
      dispatch({ type: "SET_SUCCESS", value: `Mesajul a fost pus în coadă pentru ${data.confirmedGuests} invitați confirmați.` });
      void refreshHistory();
    } catch (error: unknown) {
      dispatch({ type: "SET_ERROR", value: (error as Error).message });
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;

    dispatch({ type: "SET_TEMPLATE", value: templateId });
    dispatch({ type: "SET_FIELD", field: "subject", value: template.subject });
    dispatch({ type: "SET_FIELD", field: "message", value: template.body });
    dispatch({ type: "SET_TAB", value: "compose" });
  };

  const handleSaveTemplates = async () => {
    setTemplatesSaving(true);
    setTemplatesError(null);
    try {
      const response = await fetch("/api/wedding-hub/messages/templates", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${coupleAuth.coupleAccessToken}`,
        },
        body: JSON.stringify({ templates }),
      });
      const data = await response.json() as { templates?: WeddingMessageTemplate[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Nu s-au putut salva șabloanele.");
      }
      if (Array.isArray(data.templates)) {
        setTemplates(data.templates);
      }
    } catch (error: unknown) {
      setTemplatesError((error as Error).message);
    } finally {
      setTemplatesSaving(false);
    }
  };

  const updateTemplate = (templateId: string, field: keyof WeddingMessageTemplate, value: string) => {
    setTemplates((currentTemplates) =>
      currentTemplates.map((template) =>
        template.id === templateId ? { ...template, [field]: value } : template,
      ),
    );
  };

  const addTemplate = () => {
    const newTemplate: WeddingMessageTemplate = {
      id: `custom-${Date.now()}`,
      title: "Șablon nou",
      subject: "Subiect nou",
      body: "Mesaj nou",
    };
    setTemplates((currentTemplates) => [...currentTemplates, newTemplate]);
  };

  const removeTemplate = (templateId: string) => {
    setTemplates((currentTemplates) => currentTemplates.filter((template) => template.id !== templateId));
    if (pageState.selectedTemplateId === templateId) {
      dispatch({ type: "SET_TEMPLATE", value: "" });
    }
  };

  if (loadingProfile || loadingGuests) {
    return <Loader variant="fullscreen" />;
  }

  if (!weddingProfile) {
    return <div className="py-16 text-center text-neutral-500">Nu s-au putut încărca mesajele.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-light text-white">Mesaje</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Trimiți mesaje bulk către invitații confirmați, cu fallback automat pe canalul disponibil.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshHistory()}
          className="w-fit rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
        >
          Reîncarcă istoricul
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Confirmați" value={recipientStats.confirmedCount} />
        <StatCard label="Cu email" value={recipientStats.emailCount} />
        <StatCard label="Cu telefon" value={recipientStats.phoneCount} />
        <StatCard label="Cu ambele" value={recipientStats.bothCount} />
        <StatCard label="Fără contacte" value={recipientStats.contactlessCount} />
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton label="Trimite" active={pageState.activeTab === "compose"} onClick={() => dispatch({ type: "SET_TAB", value: "compose" })} />
        <TabButton label="Șabloane" active={pageState.activeTab === "templates"} onClick={() => dispatch({ type: "SET_TAB", value: "templates" })} />
        <TabButton label="Istoric" active={pageState.activeTab === "history"} onClick={() => dispatch({ type: "SET_TAB", value: "history" })} />
      </div>

      {pageState.activeTab === "compose" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <label className="block">
                  <span className="mb-2 block text-sm text-neutral-300">Șablon rapid</span>
                  <select
                    value={pageState.selectedTemplateId}
                    onChange={(event) => dispatch({ type: "SET_TEMPLATE", value: event.target.value })}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950/70 px-4 py-3 text-sm text-white outline-none focus:border-rose-500"
                  >
                    <option value="">Alege un șablon</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>{template.title}</option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => applyTemplate(pageState.selectedTemplateId)}
                    disabled={!pageState.selectedTemplateId}
                    className="rounded-xl border border-rose-600/40 bg-rose-600/10 px-4 py-3 text-sm text-rose-200 transition-colors hover:bg-rose-600/20 disabled:border-neutral-800 disabled:bg-neutral-950/40 disabled:text-neutral-600"
                  >
                    Aplică
                  </button>
                </div>
              </div>

              <TextField
                label="Subiect"
                value={pageState.subject}
                onChange={(value) => dispatch({ type: "SET_FIELD", field: "subject", value })}
                placeholder="Mesaj important"
              />

              <div>
                <label className="mb-2 block text-sm text-neutral-300">Mesaj</label>
                <textarea
                  value={pageState.message}
                  onChange={(event) => dispatch({ type: "SET_FIELD", field: "message", value: event.target.value })}
                  placeholder="Scrie mesajul aici..."
                  className="min-h-56 w-full rounded-xl border border-neutral-700 bg-neutral-950/70 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-neutral-500 focus:border-rose-500"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-neutral-300">Filtru destinatari</span>
                  <select
                    value={pageState.recipientFilter}
                    onChange={(event) => dispatch({ type: "SET_FILTER", value: event.target.value as RecipientFilter })}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950/70 px-4 py-3 text-sm text-white outline-none focus:border-rose-500"
                  >
                    <option value="all">Toți confirmații</option>
                    <option value="without-table">Fără masă</option>
                    <option value="with-table">Cu masă</option>
                    <option value="email-only">Doar email</option>
                    <option value="phone-only">Doar telefon</option>
                    <option value="both">Email + telefon</option>
                    <option value="no-contact">Fără contacte</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-neutral-300">Masă specifică</span>
                  <select
                    value={pageState.selectedTableId}
                    onChange={(event) => dispatch({ type: "SET_TABLE_FILTER", value: event.target.value })}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950/70 px-4 py-3 text-sm text-white outline-none focus:border-rose-500"
                  >
                    <option value="">Toate mesele</option>
                    {state.tables.map((table) => (
                      <option key={table.id} value={table.id}>
                        {table.tableName}{table.tableAlias ? ` · ${table.tableAlias}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ChannelToggle
                  title="Trimite pe email"
                  description="Invitații cu email vor primi mesajul în inbox."
                  checked={pageState.sendEmailToGuests}
                  onToggle={() => dispatch({ type: "SET_EMAIL_CHANNEL", value: !pageState.sendEmailToGuests })}
                />
                <ChannelToggle
                  title="Trimite pe telefon"
                  description="Invitații cu telefon valid vor primi SMS, dacă este configurat."
                  checked={pageState.sendSmsToGuests}
                  onToggle={() => dispatch({ type: "SET_SMS_CHANNEL", value: !pageState.sendSmsToGuests })}
                />
              </div>

              <DeliveryNotice preview={deliveryPreview} />

              {pageState.errorMessage && (
                <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300">
                  {pageState.errorMessage}
                </div>
              )}

              {pageState.successMessage && (
                <div className="rounded-lg border border-green-800 bg-green-900/20 px-4 py-3 text-sm text-green-300">
                  {pageState.successMessage}
                </div>
              )}

              <button
                type="button"
                onClick={handleSend}
                disabled={pageState.isSending || recipientStats.confirmedCount === 0}
                className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:bg-neutral-700 disabled:text-neutral-500"
              >
                {pageState.isSending ? "Se pune în coadă..." : "Trimite către confirmați"}
              </button>

              {pageState.result && (
                <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-300">
                  <p className="font-medium text-white">Rezultat</p>
                  <p className="mt-2 text-neutral-400">Broadcast #{pageState.result.broadcastId}</p>
                  <p className="mt-2 text-neutral-400">
                    Status: {pageState.result.status} · Procesat pentru {pageState.result.confirmedGuests} invitați confirmați.
                  </p>
                  <p className="mt-2 text-neutral-400">
                    Email trimise: {pageState.result.summary.emailSent} · SMS trimise: {pageState.result.summary.smsSent}
                  </p>
                  <p className="mt-2 text-neutral-400">
                    Email omise: {pageState.result.summary.emailSkipped} · SMS omise: {pageState.result.summary.smsSkipped}
                  </p>
                  {pageState.result.warnings.fallbackCount > 0 && (
                    <div className="mt-3 rounded-lg border border-amber-700/40 bg-amber-950/20 px-4 py-3 text-amber-200">
                      <p className="font-medium">Fallback aplicat pentru {pageState.result.warnings.fallbackCount} invitați.</p>
                      <p className="mt-1 text-xs text-amber-100/80">
                        Unele contacte lipsesc, așa că mesajele au fost redirecționate automat pe canalul disponibil.
                      </p>
                      <p className="mt-2 text-xs text-amber-100/90">
                        {pageState.result.warnings.fallbacks
                          .map((fallback) => `${fallback.guestName} (${fallback.fromChannel === "sms" ? "SMS → email" : "email → SMS"})`)
                          .join(", ")}
                      </p>
                    </div>
                  )}
                  {(pageState.result.summary.emailFailed > 0 || pageState.result.summary.smsFailed > 0) && (
                    <p className="mt-2 text-red-300">
                      Eșecuri: {pageState.result.summary.emailFailed + pageState.result.summary.smsFailed}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-800 pb-4">
              <div>
                <h2 className="text-sm font-medium text-white">Destinatari filtrați</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  {filteredGuests.length} persoane intră acum în broadcast.
                </p>
              </div>
            </div>

            <div className="mt-4 max-h-[480px] space-y-3 overflow-y-auto pr-1">
              {filteredGuests.length === 0 ? (
                <div className="rounded-lg border border-dashed border-neutral-800 bg-neutral-950/40 px-4 py-8 text-center text-sm text-neutral-500">
                  Nu există invitați care să corespundă filtrului.
                </div>
              ) : (
                filteredGuests.map((guest) => (
                  <div key={guest.id} className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {guest.firstName} {guest.lastName}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {guest.adultsCount} adulți{guest.childrenCount > 0 ? ` · ${guest.childrenCount} copii` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {guest.email && <Badge label="Email" tone="green" />}
                        {guest.phone && <Badge label="Telefon" tone="amber" />}
                        {guest.tableId && <Badge label="Masă" tone="green" />}
                      </div>
                    </div>
                    {!guest.email && !guest.phone && (
                      <p className="mt-3 text-xs text-red-300">Fără date de contact utile.</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {pageState.activeTab === "templates" && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-medium text-white">Șabloane salvate</h2>
              <p className="mt-1 text-xs text-neutral-500">Editezi și salvezi mesaje reutilizabile pentru trimiteri rapide.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addTemplate}
                className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
              >
                Adaugă șablon
              </button>
              <button
                type="button"
                onClick={() => void refreshTemplates()}
                className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
              >
                Reîncarcă
              </button>
            </div>
          </div>

          {templatesError && <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300">{templatesError}</div>}

          {templatesLoading ? (
            <div className="py-8 text-sm text-neutral-500">Se încarcă șabloanele...</div>
          ) : (
            <div className="space-y-4">
              {templates.map((template) => (
                <TemplateEditorRow
                  key={template.id}
                  template={template}
                  onChange={updateTemplate}
                  onApply={applyTemplate}
                  onRemove={removeTemplate}
                />
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSaveTemplates()}
              disabled={templatesSaving}
              className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:bg-neutral-700 disabled:text-neutral-500"
            >
              {templatesSaving ? "Se salvează..." : "Salvează șabloanele"}
            </button>
          </div>
        </div>
      )}

      {pageState.activeTab === "history" && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-medium text-white">Istoric mesaje</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Vezi broadcast-urile trimise, în coadă sau eșuate.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshHistory()}
              className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
            >
              Reîncarcă
            </button>
          </div>

          {historyError && <div className="rounded-lg border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-300">{historyError}</div>}

          {historyLoading ? (
            <div className="py-8 text-sm text-neutral-500">Se încarcă istoricul...</div>
          ) : history.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-800 bg-neutral-950/40 px-4 py-8 text-center text-sm text-neutral-500">
              Încă nu există mesaje trimise.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <HistoryCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-2xl font-light text-white">{value}</p>
      <p className="mt-1 text-xs text-neutral-500">{label}</p>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-neutral-300">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-neutral-700 bg-neutral-950/70 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-neutral-500 focus:border-rose-500"
      />
    </label>
  );
}

function ChannelToggle({
  title,
  description,
  checked,
  onToggle,
}: {
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-colors ${
        checked
          ? "border-green-600/70 bg-green-950/10"
          : "border-red-600/70 bg-red-950/10"
      }`}
    >
      <span className="space-y-1">
        <span className="block text-sm font-medium text-white">{title}</span>
        <span className="block text-sm text-neutral-400">{description}</span>
      </span>
      <span
        className={`mt-1 inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border transition-colors ${
          checked ? "border-green-500 bg-green-600" : "border-red-500 bg-red-600/25"
        }`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </span>
    </button>
  );
}

function DeliveryNotice({
  preview,
}: {
  preview: {
    heading: string;
    body: string;
    tone: "info" | "warning";
    details: Array<{ firstName: string; lastName: string }>;
  };
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        preview.tone === "warning"
          ? "border-amber-700/40 bg-amber-950/20 text-amber-100"
          : "border-neutral-800 bg-neutral-950/60 text-neutral-400"
      }`}
    >
      <p className="font-medium text-white">{preview.heading}</p>
      <p className="mt-1">{preview.body}</p>
      {preview.details.length > 0 && (
        <p className="mt-2 text-xs text-neutral-400">
          Invitați fără niciun contact disponibil: {preview.details.map((guest) => `${guest.firstName} ${guest.lastName}`).join(", ")}.
        </p>
      )}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition-colors ${
        active
          ? "border-rose-500/50 bg-rose-600/15 text-rose-200"
          : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function TemplateEditorRow({
  template,
  onChange,
  onApply,
  onRemove,
}: {
  template: WeddingMessageTemplate;
  onChange: (templateId: string, field: keyof WeddingMessageTemplate, value: string) => void;
  onApply: (templateId: string) => void;
  onRemove: (templateId: string) => void;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid flex-1 gap-3 md:grid-cols-3">
          <input
            value={template.title}
            onChange={(event) => onChange(template.id, "title", event.target.value)}
            className="rounded-lg border border-neutral-700 bg-neutral-950/70 px-3 py-2 text-sm text-white outline-none focus:border-rose-500"
            placeholder="Titlu"
          />
          <input
            value={template.subject}
            onChange={(event) => onChange(template.id, "subject", event.target.value)}
            className="rounded-lg border border-neutral-700 bg-neutral-950/70 px-3 py-2 text-sm text-white outline-none focus:border-rose-500 md:col-span-2"
            placeholder="Subiect"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onApply(template.id)}
            className="rounded-lg border border-rose-500/40 bg-rose-600/10 px-3 py-2 text-sm text-rose-200 transition-colors hover:bg-rose-600/20"
          >
            Aplică
          </button>
          <button
            type="button"
            onClick={() => onRemove(template.id)}
            className="rounded-lg border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-sm text-neutral-400 transition-colors hover:text-white"
          >
            Șterge
          </button>
        </div>
      </div>
      <textarea
        value={template.body}
        onChange={(event) => onChange(template.id, "body", event.target.value)}
        className="min-h-32 w-full rounded-lg border border-neutral-700 bg-neutral-950/70 px-3 py-2 text-sm text-white outline-none focus:border-rose-500"
        placeholder="Mesaj"
      />
    </div>
  );
}

function HistoryCard({ item }: { item: BroadcastHistoryItem }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white">{item.subject}</p>
          <p className="mt-1 text-xs text-neutral-500">
            {formatDateTime(item.createdAt)} · {item.recipientCount} destinatari
          </p>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <div className="grid gap-2 text-xs text-neutral-400 sm:grid-cols-2 lg:grid-cols-4">
        <p>Email trimise: {item.emailSent}</p>
        <p>SMS trimise: {item.smsSent}</p>
        <p>Fallback: {item.fallbackCount}</p>
        <p>Eșecuri: {item.emailFailed + item.smsFailed}</p>
      </div>

      <p className="text-xs text-neutral-500">
        Filtru: {item.filters.tableId ? `Masa ${item.filters.tableId}` : item.filters.audience}
      </p>

      {item.errorMessage && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 px-3 py-2 text-xs text-red-300">
          {item.errorMessage}
        </div>
      )}

      {item.fallbackWarnings.length > 0 && (
        <p className="text-xs text-amber-200">
          Fallback: {item.fallbackWarnings.map((fallback) => `${fallback.guestName} (${fallback.fromChannel === "sms" ? "SMS → email" : "email → SMS"})`).join(", ")}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: BroadcastHistoryItem["status"] }) {
  const classes: Record<BroadcastHistoryItem["status"], string> = {
    queued: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    processing: "border-blue-500/30 bg-blue-500/10 text-blue-200",
    sent: "border-green-500/30 bg-green-500/10 text-green-200",
    partial: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
    failed: "border-red-500/30 bg-red-500/10 text-red-200",
  };

  const labels: Record<BroadcastHistoryItem["status"], string> = {
    queued: "În coadă",
    processing: "Se trimite",
    sent: "Trimis",
    partial: "Parțial",
    failed: "Eșuat",
  };

  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${classes[status]}`}>{labels[status]}</span>;
}

function Badge({ label, tone }: { label: string; tone: "green" | "amber" }) {
  const toneClass =
    tone === "green"
      ? "border-green-500/30 bg-green-500/10 text-green-300"
      : "border-amber-500/30 bg-amber-500/10 text-amber-300";

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${toneClass}`}>
      {label}
    </span>
  );
}

export default WeddingMessagesPage;
