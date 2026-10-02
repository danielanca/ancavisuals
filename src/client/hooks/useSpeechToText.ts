import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API nu are tipuri în lib.dom pentru toate browserele, deci descriem doar ce folosim.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Browserul nu are acces la microfon. Permite-l din bara de adresă.",
  "service-not-allowed": "Browserul nu are acces la microfon. Permite-l din bara de adresă.",
  "audio-capture": "Nu am găsit niciun microfon.",
  network: "Dictarea are nevoie de internet.",
};

/**
 * Dictare vocală → text prin recunoașterea vocală a browserului.
 * `onFinalText` primește fiecare frază confirmată; `interim` arată ce se aude în timp real.
 */
export function useSpeechToText(onFinalText: (text: string) => void, lang = "ro-RO") {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onFinalText);
  onFinalRef.current = onFinalText;

  // Verificat după mount ca SSR-ul și primul render client să fie identice.
  useEffect(() => setSupported(getRecognitionCtor() !== null), []);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || recognitionRef.current) return;
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;
        if (result.isFinal) onFinalRef.current(text);
        else pending += `${text} `;
      }
      setInterim(pending.trim());
    };
    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setError(ERROR_MESSAGES[event.error] ?? "Dictarea s-a oprit neașteptat.");
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim("");
    };
    setError(null);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setError("Nu am putut porni dictarea.");
    }
  }, [lang]);

  const toggle = useCallback(() => (recognitionRef.current ? stop() : start()), [start, stop]);

  return { supported, listening, interim, error, start, stop, toggle };
}

/** Lipește textul dictat la finalul valorii existente, cu spațiu între ele. */
export function appendDictation(current: string, text: string): string {
  if (!current.trim()) return text.charAt(0).toUpperCase() + text.slice(1);
  return `${current.replace(/\s+$/, "")} ${text}`;
}
