import React, { useEffect, useRef, useState } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
}

function ToolbarButton({ onClick, label, title, bold }: { onClick: () => void; label: string; title: string; bold?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`w-7 h-7 rounded text-xs text-neutral-300 hover:bg-neutral-700 hover:text-white transition-colors ${bold ? "font-bold" : ""}`}
    >
      {label}
    </button>
  );
}

// Simple WYSIWYG for clause text — bold / listă / paragraf, fără să vezi tag-urile HTML.
// document.execCommand e deprecat dar încă funcțional pentru comenzi de bază; un editor de tip
// TipTap/Quill ar fi overkill pentru cât de puțină formatare au clauzele. „Sursă HTML" rămâne ca
// supapă pentru cazuri speciale (ex. caseta stilizată de avertisment VideoBooth 360°).
const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, minHeight = 100 }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceValue, setSourceValue] = useState(value);
  const isInternalUpdate = useRef(false);

  useEffect(() => {
    if (sourceMode) return;
    if (isInternalUpdate.current) { isInternalUpdate.current = false; return; }
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value, sourceMode]);

  function handleInput() {
    if (!editorRef.current) return;
    isInternalUpdate.current = true;
    onChange(editorRef.current.innerHTML);
  }

  function exec(command: string, arg?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    handleInput();
  }

  function toggleSource() {
    if (!sourceMode) {
      setSourceValue(value);
      setSourceMode(true);
    } else {
      onChange(sourceValue);
      setSourceMode(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-800 overflow-hidden">
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-neutral-700 bg-neutral-900/40">
        <ToolbarButton onClick={() => exec("bold")} label="B" title="Bold" bold />
        <ToolbarButton onClick={() => exec("insertUnorderedList")} label="•" title="Listă cu puncte" />
        <ToolbarButton onClick={() => exec("formatBlock", "p")} label="¶" title="Paragraf nou" />
        <ToolbarButton onClick={() => exec("removeFormat")} label="✕" title="Elimină formatarea" />
        <button
          type="button"
          onClick={toggleSource}
          className="ml-auto text-[11px] text-neutral-500 hover:text-white px-2 py-1 transition-colors"
        >
          {sourceMode ? "← Vizual" : "Sursă HTML"}
        </button>
      </div>
      {sourceMode ? (
        <textarea
          value={sourceValue}
          onChange={(e) => setSourceValue(e.target.value)}
          onBlur={() => onChange(sourceValue)}
          rows={6}
          className="w-full bg-neutral-800 text-white text-xs font-mono p-3 outline-none"
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          style={{ minHeight }}
          className="max-h-64 overflow-y-auto p-3 text-sm text-neutral-100 outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0"
        />
      )}
    </div>
  );
};

export default RichTextEditor;
