/*
 * Purpose: verifies voice dictation glue — appending recognised phrases and
 * driving a (fake) browser SpeechRecognition with Romanian.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { appendDictation, useSpeechToText } from "src/client/hooks/useSpeechToText";

class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: any = null;
  onerror: any = null;
  onend: any = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  constructor() { FakeRecognition.last = this; }
}

describe("useSpeechToText", () => {
  afterEach(() => {
    delete (window as any).webkitSpeechRecognition;
  });

  test("appendDictation capitalises a fresh field and spaces appended phrases", () => {
    expect(appendDictation("", "trimite preview")).toBe("Trimite preview");
    expect(appendDictation("Sună clientul ", "pentru avans")).toBe("Sună clientul pentru avans");
  });

  test("is unsupported without a browser recogniser", () => {
    const { result } = renderHook(() => useSpeechToText(() => {}));
    expect(result.current.supported).toBe(false);
  });

  test("dictates in Romanian and forwards only final phrases", () => {
    (window as any).webkitSpeechRecognition = FakeRecognition;
    const onFinal = vi.fn();
    const { result } = renderHook(() => useSpeechToText(onFinal));
    expect(result.current.supported).toBe(true);

    act(() => result.current.toggle());
    const recognition = FakeRecognition.last!;
    expect(recognition.lang).toBe("ro-RO");
    expect(result.current.listening).toBe(true);

    act(() => recognition.onresult({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: "editează" } }] }));
    expect(result.current.interim).toBe("editează");
    expect(onFinal).not.toHaveBeenCalled();

    act(() => recognition.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: " editează filmul " } }] }));
    expect(onFinal).toHaveBeenCalledWith("editează filmul");

    act(() => result.current.toggle());
    expect(recognition.stop).toHaveBeenCalled();
    expect(result.current.listening).toBe(false);
  });
});
