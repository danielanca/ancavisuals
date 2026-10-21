import React from "react";
import { Link } from "react-router-dom";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  // Ce date a citit asistentul pentru acest răspuns (ex. "facturi 2026") — doar endpoint-uri cu unelte.
  sources?: string[];
}

interface AiContextChatProps {
  // Rezumat text al datelor curent afișate pe pagină — asistentul răspunde STRICT pe baza
  // acestui context, ca să nu inventeze cifre. Actualizează-l când se schimbă datele vizibile.
  context: string;
  accessToken: string;
  title?: string;
  placeholder?: string;
  // Endpoint alternativ, ex. asistentul financiar cu acces la date (/api/admin/finance-assistant/chat).
  endpoint?: string;
  emptyHint?: string;
  // Extra fields sent with every question (ex. the admin page list for the Dashboard guide).
  extraBody?: Record<string, unknown>;
  // Markdown links [text](/path) in the replies whose path passes this check become in-app links.
  isLinkablePath?: (path: string) => boolean;
  defaultOpen?: boolean;
  // Always open, without the collapse button (ex. the Dashboard guide).
  alwaysOpen?: boolean;
  // First message shown from the assistant; only on screen, never sent to the API.
  greeting?: string;
  tone?: Tone;
}

type Tone = "neutral" | "green";
// "green" = the site's green (the share cards / WhatsApp actions: #22c55e, #166534, #0f2a18).
const TONES: Record<Tone, { box: string; divider: string; title: string; icon: string; user: string; assistant: string; input: string; send: string; muted: string }> = {
  neutral: {
    box: "border-neutral-800 bg-neutral-900",
    divider: "border-neutral-800",
    title: "text-white",
    icon: "text-emerald-400",
    user: "bg-emerald-500/15 text-emerald-100",
    assistant: "bg-neutral-800 text-neutral-200",
    input: "border-neutral-700 bg-neutral-800 focus:border-neutral-500",
    send: "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30",
    muted: "text-neutral-500",
  },
  green: {
    box: "border-[#166534] bg-[#0f2a18]",
    divider: "border-[#166534]/70",
    title: "text-green-50",
    icon: "text-[#4ade80]",
    user: "bg-[#22c55e]/20 text-green-50",
    assistant: "bg-[#14361f] text-green-50",
    input: "border-[#166534] bg-[#0b1f12] placeholder:text-green-200/40 focus:border-[#22c55e]",
    send: "bg-[#22c55e] font-semibold text-[#06210f] hover:bg-[#4ade80]",
    muted: "text-green-200/60",
  },
};

/** Plain text, with the allowed [text](/path) links turned into router links. */
function renderReply(rawText: string, isLinkablePath?: (path: string) => boolean): React.ReactNode {
  if (!isLinkablePath) return rawText;
  // Bold markers would show as raw asterisks: dropped.
  const text = rawText.replace(/\*\*/g, "");
  const parts: React.ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const [whole, label, path] = match;
    const start = match.index ?? 0;
    parts.push(text.slice(last, start));
    parts.push(isLinkablePath(path)
      ? <Link key={start} to={path} className="font-medium text-emerald-300 underline underline-offset-2 hover:text-emerald-200">{label}</Link>
      : whole);
    last = start + whole.length;
  }
  parts.push(text.slice(last));
  return parts;
}

// Widget de chat AI generic, gândit să fie montat pe orice pagină de admin — fiecare pagină
// îi dă doar un rezumat text ("context") al ce e relevant chiar acum. Nu ține memorie între
// pagini sau sesiuni; conversația trăiește doar cât timp componenta e montată.
const AiContextChat: React.FC<AiContextChatProps> = ({ context, accessToken, title = "Întreabă asistentul AI", placeholder = "Scrie o întrebare...", endpoint = "/api/admin/ai-assistant/chat", emptyHint, extraBody, isLinkablePath, defaultOpen = false, alwaysOpen = false, greeting, tone = "neutral" }) => {
  const [openState, setOpen] = React.useState(defaultOpen);
  const open = alwaysOpen || openState;
  const colors = TONES[tone];
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const nextMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ ...extraBody, context, messages: nextMessages.map(({ role, content }) => ({ role, content })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Asistentul nu a putut răspunde.");
      setMessages((current) => [...current, { role: "assistant", content: data.reply as string, sources: Array.isArray(data.sources) ? data.sources : undefined }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Asistentul nu a putut răspunde.");
    } finally {
      setLoading(false);
    }
  }

  const chatIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={colors.icon}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );

  return (
    <div className={`rounded-xl border ${colors.box}`}>
      {alwaysOpen ? (
        <div className={`flex items-center gap-2 px-4 py-3 text-sm font-medium ${colors.title}`}>
          {chatIcon}
          {title}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        >
          <span className={`flex items-center gap-2 text-sm font-medium ${colors.title}`}>
            {chatIcon}
            {title}
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${colors.muted} transition-transform ${open ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {open && (
        <div className={`border-t p-4 ${colors.divider}`}>
          <div ref={scrollRef} className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {greeting && (
              <div className="flex justify-start">
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${colors.assistant}`}>{greeting}</div>
              </div>
            )}
            {messages.length === 0 && !greeting && (
              <p className={`text-xs ${colors.muted}`}>
                {emptyHint ?? 'Întreabă orice despre datele de mai sus — ex. "cât am de plătit luna asta" sau "ce înseamnă taxarea inversă".'}
              </p>
            )}
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  message.role === "user" ? colors.user : colors.assistant
                }`}>
                  {message.role === "assistant" ? renderReply(message.content, isLinkablePath) : message.content}
                  {message.sources && message.sources.length > 0 && (
                    <p className={`mt-1.5 text-[11px] ${colors.muted}`}>Consultat: {message.sources.join(", ")}</p>
                  )}
                </div>
              </div>
            ))}
            {loading && <p className={`text-xs ${colors.muted}`}>Asistentul se uită prin date și scrie...</p>}
          </div>

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

          <div className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }}
              placeholder={placeholder}
              disabled={loading}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm text-white focus:outline-none disabled:opacity-50 ${colors.input}`}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${colors.send}`}
            >
              Trimite
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiContextChat;
