import React from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AiContextChatProps {
  // Rezumat text al datelor curent afișate pe pagină — asistentul răspunde STRICT pe baza
  // acestui context, ca să nu inventeze cifre. Actualizează-l când se schimbă datele vizibile.
  context: string;
  accessToken: string;
  title?: string;
  placeholder?: string;
}

// Widget de chat AI generic, gândit să fie montat pe orice pagină de admin — fiecare pagină
// îi dă doar un rezumat text ("context") al ce e relevant chiar acum. Nu ține memorie între
// pagini sau sesiuni; conversația trăiește doar cât timp componenta e montată.
const AiContextChat: React.FC<AiContextChatProps> = ({ context, accessToken, title = "Întreabă asistentul AI", placeholder = "Scrie o întrebare..." }) => {
  const [open, setOpen] = React.useState(false);
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
      const response = await fetch("/api/admin/ai-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ context, messages: nextMessages }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Asistentul nu a putut răspunde.");
      setMessages((current) => [...current, { role: "assistant", content: data.reply as string }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Asistentul nu a putut răspunde.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-white">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          {title}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-neutral-800 p-4">
          <div ref={scrollRef} className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <p className="text-xs text-neutral-500">
                Întreabă orice despre datele de mai sus — ex. "cât am de plătit luna asta" sau "ce înseamnă taxarea inversă".
              </p>
            )}
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  message.role === "user" ? "bg-emerald-500/15 text-emerald-100" : "bg-neutral-800 text-neutral-200"
                }`}>
                  {message.content}
                </div>
              </div>
            ))}
            {loading && <p className="text-xs text-neutral-500">Asistentul scrie...</p>}
          </div>

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

          <div className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }}
              placeholder={placeholder}
              disabled={loading}
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30 disabled:opacity-40"
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
