/*
 * Purpose: one helper bar for every long text field in the admin (any <textarea> and the clause
 * editor's contentEditable), mounted once in AdminLayout: 🎙 dictation (browser speech-to-text, ro-RO)
 * and ✨ "Înfrumusețează" (POST /api/admin/ai-assistant/polish — fixes dictation, grammar and
 * diacritics, natural tone), with ↩ undo. It writes through the native value setter + an "input"
 * event, so the page's own React state updates as if the owner had typed.
 * Opt out: data-text-assist="off" on the field or a parent; "ai-only" hides the mic (field has its own).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import useAuth from "../auth/useAuth";
import { appendDictation, useSpeechToText } from "../../../hooks/useSpeechToText";

type Field = HTMLTextAreaElement | HTMLElement;

const isRichText = (el: Field) => !(el instanceof HTMLTextAreaElement);

function assistMode(el: Element): string | null {
  return el.closest("[data-text-assist]")?.getAttribute("data-text-assist") ?? null;
}

/** The field the bar should attach to, or null (inputs, read-only fields, opted-out areas). */
export function assistableField(target: EventTarget | null): Field | null {
  if (!(target instanceof HTMLElement)) return null;
  if (assistMode(target) === "off") return null;
  if (target instanceof HTMLTextAreaElement) return target.readOnly || target.disabled ? null : target;
  const editable = target.closest<HTMLElement>("[contenteditable]");
  return editable && editable.getAttribute("contenteditable") !== "false" ? editable : null;
}

const readField = (el: Field) => (isRichText(el) ? el.innerHTML : (el as HTMLTextAreaElement).value);

function writeField(el: Field, value: string) {
  if (isRichText(el)) {
    el.innerHTML = value;
  } else {
    // React tracks the value itself; the prototype setter makes the next "input" event count as a change.
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(el, value);
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Dictated phrase appended to the field; in the rich editor it continues the last paragraph. */
export function appendSpoken(el: Field, spoken: string): string {
  if (!isRichText(el)) return appendDictation((el as HTMLTextAreaElement).value, spoken);
  const html = el.innerHTML;
  if (!el.textContent?.trim()) return `<p>${escapeHtml(appendDictation("", spoken))}</p>`;
  const lastClose = html.lastIndexOf("</p>");
  if (lastClose !== -1 && !html.slice(lastClose + 4).trim()) return `${html.slice(0, lastClose).replace(/\s+$/, "")} ${escapeHtml(spoken)}</p>`;
  return `${html.replace(/\s+$/, "")} ${escapeHtml(spoken)}`;
}

function fieldName(el: Field): string {
  const labelled = el.getAttribute("aria-label")
    ?? (el instanceof HTMLTextAreaElement ? el.labels?.[0]?.textContent : null)
    ?? el.getAttribute("placeholder");
  return (labelled ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}

type Position = { top: number; left: number };

export default function AdminTextAssist() {
  const { auth } = useAuth();
  const [field, setField] = useState<Field | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ field: Field; value: string; polished: string } | null>(null);
  const fieldRef = useRef<Field | null>(null);
  fieldRef.current = field;
  const barRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);

  const dictation = useSpeechToText((spoken) => {
    const el = fieldRef.current;
    if (el?.isConnected) writeField(el, appendSpoken(el, spoken));
  });
  const keepOpen = useRef(false);
  keepOpen.current = busy || dictation.listening;

  const place = useCallback(() => {
    const el = fieldRef.current;
    if (!el || !el.isConnected) {
      setField(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    // Above the field's top-right corner; below it when there is no room at the top of the screen.
    setPosition({ top: rect.top >= 36 ? rect.top - 32 : rect.bottom + 4, left: rect.right });
  }, []);

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      if (barRef.current?.contains(event.target as Node)) return;
      const next = assistableField(event.target);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (!next) {
        if (!keepOpen.current) setField(null);
        return;
      }
      if (next !== fieldRef.current) {
        dictation.stop();
        setError(null);
      }
      setField(next);
    };
    const onFocusOut = (event: FocusEvent) => {
      if (barRef.current?.contains(event.relatedTarget as Node)) return;
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => {
        if (!keepOpen.current && !barRef.current?.contains(document.activeElement)) setField(null);
      }, 200);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [dictation.stop]);

  useEffect(() => {
    if (!field) {
      setPosition(null);
      return;
    }
    place();
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    field.addEventListener("input", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      field.removeEventListener("input", schedule);
    };
  }, [field, place]);

  // The undo only applies while the field still holds the AI text.
  useEffect(() => {
    if (undo && (undo.field !== field || readField(undo.field) !== undo.polished)) setUndo(null);
  });

  const polish = async () => {
    const el = fieldRef.current;
    if (!el || busy) return;
    const original = readField(el);
    if (!(isRichText(el) ? el.textContent ?? "" : original).trim()) {
      setError("Scrie sau dictează ceva mai întâi.");
      return;
    }
    dictation.stop();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai-assistant/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.accessToken}` },
        body: JSON.stringify({ text: original, format: isRichText(el) ? "html" : "plain", field: fieldName(el) }),
      });
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok || !data.text) throw new Error(data.error ?? `Eroare ${res.status}`);
      if (readField(el) !== original) throw new Error("Textul s-a schimbat între timp. Apasă din nou.");
      writeField(el, data.text);
      setUndo({ field: el, value: original, polished: readField(el) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Textul nu a putut fi înfrumusețat.");
    } finally {
      setBusy(false);
    }
  };

  const revert = () => {
    if (!undo) return;
    writeField(undo.field, undo.value);
    setUndo(null);
  };

  if (!field || !position) return null;
  const showMic = dictation.supported && assistMode(field) !== "ai-only";
  const button = "flex items-center gap-1 border px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50";

  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label="Ajutor pentru text"
      // Keeps the focus (and the caret) in the field while clicking the bar.
      onMouseDown={(event) => event.preventDefault()}
      style={{ position: "fixed", top: position.top, left: position.left, transform: "translateX(-100%)", zIndex: 60 }}
      className="flex max-w-[calc(100vw-16px)] items-center gap-1"
    >
      {(dictation.listening || error) && (
        <span className={`truncate bg-neutral-950/95 px-2 py-1 text-[11px] ${error || dictation.error ? "text-red-400" : "text-red-300"}`} aria-live="polite">
          {error ?? dictation.error ?? (dictation.interim ? `„${dictation.interim}”` : "Te ascult…")}
        </span>
      )}
      {undo && (
        <button type="button" onClick={revert} className={`${button} border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-white hover:text-white`}>
          ↩ Anulează
        </button>
      )}
      {showMic && (
        <button
          type="button"
          onClick={dictation.toggle}
          disabled={busy}
          aria-pressed={dictation.listening}
          title={dictation.listening ? "Oprește dictarea" : "Dictează (vorbește în română)"}
          className={`${button} ${dictation.listening ? "animate-pulse border-red-500 bg-red-950 text-red-300" : "border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-white hover:text-white"}`}
        >
          🎙 {dictation.listening ? "Oprește" : "Dictează"}
        </button>
      )}
      <button
        type="button"
        onClick={() => void polish()}
        disabled={busy}
        title="AI corectează dictarea, gramatica și diacriticele și face textul natural, fără să-i schimbe sensul"
        className={`${button} border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-white hover:text-white`}
      >
        {busy ? "Se înfrumusețează…" : "✨ Înfrumusețează"}
      </button>
    </div>
  );
}
