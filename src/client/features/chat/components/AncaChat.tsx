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
const MAX_BOT_MESSAGE_LENGTH = 280;

const wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

function splitLongPart(part: string): string[] {
  if (part.length <= MAX_BOT_MESSAGE_LENGTH) return [part];

  const units = part.includes("\n")
    ? part.split("\n")
    : part.match(/[^.!?…]+[.!?…]+(?:\s+|$)|[^.!?…]+$/g)?.map(unit => unit.trim()) ?? [part];
  const chunks: string[] = [];
  let current = "";

  const addUnit = (unit: string) => {
    const separator = current ? (part.includes("\n") ? "\n" : " ") : "";
    if (current && current.length + separator.length + unit.length > MAX_BOT_MESSAGE_LENGTH) {
      chunks.push(current);
      current = unit;
    } else {
      current += `${separator}${unit}`;
    }
  };

  units.filter(Boolean).forEach(unit => {
    if (unit.length <= MAX_BOT_MESSAGE_LENGTH) {
      addUnit(unit);
      return;
    }

    // Un rând foarte lung este împărțit doar la cuvinte, ca să rămână ușor de citit.
    unit.split(/\s+/).forEach(word => addUnit(word));
  });

  if (current) chunks.push(current);
  return chunks;
}

function splitBotMessage(message: string): string[] {
  return message
    .split(/\n\s*\n/)
    .flatMap(part => splitLongPart(part.trim()))
    .filter(Boolean);
}

function typingDelay(text: string, isFirstMessage: boolean) {
  const baseDelay = isFirstMessage ? 500 : 380;
  return Math.min(baseDelay + text.length * 4, 1450);
}

function saveEventDate(text: string) {
  const m = text.match(DATE_RE);
  if (!m) return;
  const [, d, mo, y] = m;
  const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  localStorage.setItem("anca_event_date", iso);
}

export default function AncaChat() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [awaitingDate, setAwaitingDate] = useState(false);
  const [awaitingPhone, setAwaitingPhone] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setIsOpen(localStorage.getItem("anca_chat_open") === "true");
    setHasInteracted(localStorage.getItem("anca_chat_interacted") === "true");
  }, []);

  useEffect(() => {
    if (isOpen && !initialized) {
      const conversationId = conversationIdRef.current;
      setLoading(true);
      fetch("/api/assistant/init")
        .then(r => r.json())
        .then((node: ChatNode) => {
          if (conversationId !== conversationIdRef.current) return;
          setInitialized(true);
          void deliverBotResponse(node, conversationId);
        })
        .catch(() => {
          if (conversationId !== conversationIdRef.current) return;
          setMessages([{ sender: "bot", text: "Ne pare rău, ceva nu a funcționat. Te rugăm să ne contactezi direct." }]);
        })
        .finally(() => {
          if (conversationId === conversationIdRef.current) setLoading(false);
        });
    }
  }, [isOpen, initialized]);

  useEffect(() => () => {
    conversationIdRef.current += 1;
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleToggle = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
      localStorage.setItem("anca_chat_interacted", "true");
    }
    setIsOpen(o => {
      const next = !o;
      localStorage.setItem("anca_chat_open", String(next));
      return next;
    });
  };

  if (!mounted) return null;

  const resetChat = () => {
    conversationIdRef.current += 1;
    setMessages([]);
    setSuggestions([]);
    setInputText("");
    setLoading(false);
    setThinking(false);
    setAwaitingDate(false);
    setAwaitingPhone(false);
    setInitialized(false);
  };

  const deliverBotResponse = async (node: ChatNode, conversationId = conversationIdRef.current) => {
    if (conversationId !== conversationIdRef.current) return;
    setLoading(false);
    setSuggestions([]);

    const chunks = splitBotMessage(node.botMessage);
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      setThinking(true);
      await wait(typingDelay(chunk, index === 0));
      if (conversationId !== conversationIdRef.current) return;

      setThinking(false);
      setMessages(prev => [...prev, { sender: "bot", text: chunk }]);
    }

    if (conversationId === conversationIdRef.current) {
      setSuggestions(node.suggestions);
    }
  };

  const sendIntent = async (intentId: string, label: string) => {
    if (loading || thinking) return;

    if (intentId === "link_contact") {
      navigate("/contact");
      setIsOpen(false);
      return;
    }

    if (intentId === "check_date") {
      setAwaitingDate(true);
      setAwaitingPhone(false);
    }
    if (intentId === "leave_phone") {
      setAwaitingPhone(true);
      setAwaitingDate(false);
    }

    setMessages(prev => [...prev, { sender: "user", text: label }]);
    setSuggestions([]);
    setLoading(true);
    const conversationId = conversationIdRef.current;

    try {
      const res = await fetch("/api/assistant/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId }),
      });
      const node: ChatNode = await res.json();
      void deliverBotResponse(node, conversationId);
    } catch {
      if (conversationId !== conversationIdRef.current) return;
      setLoading(false);
      setMessages(prev => [...prev, { sender: "bot", text: "Eroare de rețea. Încearcă din nou." }]);
    }
  };

  const sendText = async () => {
    const text = inputText.trim();
    if (!text || loading || thinking) return;
    setInputText("");

    if (awaitingDate) {
      if (!DATE_RE.test(text)) {
        setMessages(prev => [...prev, { sender: "user", text }]);
        setMessages(prev => [...prev, { sender: "bot", text: "Formatul datei nu e corect. Te rog introdu data în formatul ZZ/LL/AAAA (ex: 15/06/2026)." }]);
        return;
      }
      saveEventDate(text);
      setAwaitingDate(false);
    }

    if (awaitingPhone) {
      setMessages(prev => [...prev, { sender: "user", text }]);
      setSuggestions([]);
      setLoading(true);
      setAwaitingPhone(false);
      const conversationId = conversationIdRef.current;
      try {
        const res = await fetch("/api/assistant/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: text,
            date: localStorage.getItem("anca_event_date") ?? undefined,
          }),
        });
        const node: ChatNode = await res.json();
        void deliverBotResponse(node, conversationId);
      } catch {
        if (conversationId !== conversationIdRef.current) return;
        setLoading(false);
        setMessages(prev => [...prev, { sender: "bot", text: "Eroare de rețea. Încearcă din nou." }]);
      }
      return;
    }

    setMessages(prev => [...prev, { sender: "user", text }]);
    setSuggestions([]);
    setLoading(true);
    const conversationId = conversationIdRef.current;

    try {
      const res = await fetch("/api/assistant/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const node: ChatNode = await res.json();
      void deliverBotResponse(node, conversationId);
    } catch {
      if (conversationId !== conversationIdRef.current) return;
      setLoading(false);
      setMessages(prev => [...prev, { sender: "bot", text: "Eroare de rețea. Încearcă din nou." }]);
    }
  };

  return (
    <>
      <style>{`
        @keyframes chatWiggle {
          0%   { transform: rotate(0deg) scale(1); }
          1%   { transform: rotate(-14deg) scale(1.05); }
          2.5% { transform: rotate(14deg) scale(1.05); }
          4%   { transform: rotate(-10deg) scale(1.02); }
          5.5% { transform: rotate(10deg) scale(1.02); }
          7%   { transform: rotate(-5deg) scale(1); }
          8%   { transform: rotate(0deg) scale(1); }
          100% { transform: rotate(0deg) scale(1); }
        }
        @keyframes chatGlow {
          0%, 100% { box-shadow: 0 0 8px 2px rgba(255,255,255,0.25), 0 10px 30px rgba(0,0,0,0.3); }
          50%       { box-shadow: 0 0 22px 8px rgba(255,255,255,0.45), 0 10px 30px rgba(0,0,0,0.3); }
        }
        .chat-btn-idle {
          animation: chatWiggle 20s ease-in-out infinite, chatGlow 3s ease-in-out infinite;
        }
      `}</style>

      {isOpen && (
        <div
          className="fixed bottom-20 right-4 md:bottom-32 md:right-10 z-50 w-80 sm:w-96 flex flex-col bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden"
          style={{ maxHeight: "520px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-neutral-800 border-b border-neutral-700 flex-shrink-0">
            <div>
              <p className="text-white text-sm font-medium tracking-wide">Anca Visuals</p>
              <p className="text-neutral-400 text-xs">{thinking ? "Scrie un mesaj..." : "Asistent online"}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={resetChat}
                title="Reîncepe conversația"
                className="text-neutral-400 hover:text-white transition-colors w-7 h-7 flex items-center justify-center rounded-full hover:bg-neutral-700"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
                </svg>
              </button>
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
            {(loading || thinking) && (
              <div className="flex justify-start items-end gap-2">
                <div className="bg-neutral-800 px-4 py-3 rounded-xl flex items-center gap-1" aria-label="Anca scrie un mesaj">
                  <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "0ms", animationDuration: "900ms" }} />
                  <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "150ms", animationDuration: "900ms" }} />
                  <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: "300ms", animationDuration: "900ms" }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {(suggestions.length > 0 || (!loading && !thinking && messages.length > 0)) && (
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
              {suggestions.length === 0 && (
                <button
                  onClick={resetChat}
                  className="text-xs px-3 py-1.5 rounded-full border border-neutral-500 text-neutral-400 hover:bg-neutral-700 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
                  </svg>
                  Reîncepe de la capăt
                </button>
              )}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-3 border-t border-neutral-700 flex-shrink-0">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendText()}
              placeholder={awaitingDate ? "ex: 15/06/2026" : awaitingPhone ? "ex: 0722 123 456" : "Scrie un mesaj..."}
              className="flex-1 bg-neutral-800 text-white text-sm placeholder-neutral-500 rounded-full px-4 py-2 outline-none border border-neutral-700 focus:border-neutral-500 transition-colors"
            />
            <button
              onClick={sendText}
              disabled={!inputText.trim() || loading || thinking}
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
        onClick={handleToggle}
        className={`fixed bottom-4 right-4 md:bottom-14 md:right-10 z-50 w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:bg-neutral-100 transition-colors${!hasInteracted ? " chat-btn-idle" : " shadow-xl"}`}
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
