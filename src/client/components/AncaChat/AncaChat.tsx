import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Suggestion {
  label: string;
  intentId: string;
}

interface ChatMessage {
  sender: "bot" | "user";
  text: string;
}

interface ChatNode {
  botMessage: string;
  suggestions: Suggestion[];
}

const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export default function AncaChat() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(localStorage.getItem("anca_chat_open") === "true");
  }, []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [awaitingDate, setAwaitingDate] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen && !initialized) {
      setLoading(true);
      fetch("/api/assistant/init")
        .then(r => r.json())
        .then((node: ChatNode) => {
          setMessages([{ sender: "bot", text: node.botMessage }]);
          setSuggestions(node.suggestions);
          setInitialized(true);
        })
        .catch(() => {
          setMessages([{ sender: "bot", text: "Ne pare rău, ceva nu a funcționat. Te rugăm să ne contactezi direct." }]);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, initialized]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendIntent = async (intentId: string, label: string) => {
    if (intentId === "link_contact") {
      navigate("/contact");
      setIsOpen(false);
      return;
    }

    if (intentId === "verificare_data") {
      setAwaitingDate(true);
    }

    setMessages(prev => [...prev, { sender: "user", text: label }]);
    setSuggestions([]);
    setLoading(true);

    try {
      const res = await fetch("/api/assistant/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId }),
      });
      const node: ChatNode = await res.json();
      setMessages(prev => [...prev, { sender: "bot", text: node.botMessage }]);
      setSuggestions(node.suggestions);
    } catch {
      setMessages(prev => [...prev, { sender: "bot", text: "Eroare de rețea. Încearcă din nou." }]);
    } finally {
      setLoading(false);
    }
  };

  const sendText = async () => {
    const text = inputText.trim();
    if (!text || loading) return;
    setInputText("");

    if (awaitingDate) {
      if (!DATE_RE.test(text)) {
        setMessages(prev => [...prev, { sender: "user", text }]);
        setMessages(prev => [...prev, { sender: "bot", text: "Formatul datei nu e corect. Te rog introdu data în formatul ZZ/LL/AAAA (ex: 15/06/2026)." }]);
        return;
      }
      setAwaitingDate(false);
    }

    setMessages(prev => [...prev, { sender: "user", text }]);
    setSuggestions([]);
    setLoading(true);

    try {
      const res = await fetch("/api/assistant/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const node: ChatNode = await res.json();
      setMessages(prev => [...prev, { sender: "bot", text: node.botMessage }]);
      setSuggestions(node.suggestions);
    } catch {
      setMessages(prev => [...prev, { sender: "bot", text: "Eroare de rețea. Încearcă din nou." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed bottom-20 right-4 z-50 w-80 sm:w-96 flex flex-col bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden"
          style={{ maxHeight: "520px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-neutral-800 border-b border-neutral-700 flex-shrink-0">
            <div>
              <p className="text-white text-sm font-medium tracking-wide">Anca Visuals</p>
              <p className="text-neutral-400 text-xs">Asistent online</p>
            </div>
            <button
              onClick={() => { setIsOpen(false); localStorage.setItem("anca_chat_open", "false"); }}
              className="text-neutral-400 hover:text-white transition-colors w-7 h-7 flex items-center justify-center rounded-full hover:bg-neutral-700"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: "200px" }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.sender === "user"
                      ? "bg-amber-100 text-neutral-900"
                      : "bg-neutral-800 text-neutral-100"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-neutral-800 text-neutral-400 px-4 py-2 rounded-xl text-sm tracking-widest">
                  · · ·
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="px-3 pt-2 pb-2 flex flex-wrap gap-2 border-t border-neutral-800 flex-shrink-0">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendIntent(s.intentId, s.label)}
                  className={
                    s.intentId === "verificare_data"
                      ? "text-xs px-3 py-1.5 rounded-full border border-yellow-400 text-yellow-300 font-medium animate-pulse hover:animate-none hover:bg-yellow-400 hover:text-black transition-colors"
                      : "text-xs px-3 py-1.5 rounded-full border border-neutral-600 text-neutral-200 hover:bg-neutral-700 transition-colors"
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-3 border-t border-neutral-700 flex-shrink-0">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendText()}
              placeholder={awaitingDate ? "ex: 15/06/2026" : "Scrie un mesaj..."}
              className="flex-1 bg-neutral-800 text-white text-sm placeholder-neutral-500 rounded-full px-4 py-2 outline-none border border-neutral-700 focus:border-neutral-500 transition-colors"
            />
            <button
              onClick={sendText}
              disabled={!inputText.trim() || loading}
              className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center disabled:opacity-30 hover:bg-neutral-200 transition-colors flex-shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(o => { const next = !o; localStorage.setItem("anca_chat_open", String(next)); return next; })}
        className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-white text-black shadow-xl flex items-center justify-center hover:bg-neutral-100 transition-colors"
        aria-label={isOpen ? "Închide chat" : "Deschide chat"}
      >
        {isOpen ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </>
  );
}
