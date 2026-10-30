/*
 * Purpose: /copiaza — the target of the copy icons in our emails (IBAN, payment description, login
 * code…). Email clients block scripts, so the icon opens this page: it copies the tapped value at
 * once and lists every value with its own "Copiază" button. The values travel in the URL hash
 * (`#IBAN=…&Descriere=…&c=IBAN`), so they never reach the server, its logs or analytics.
 */
import { useEffect, useState } from "react";

const COPY_KEY = "c";

function readFields(): { fields: [string, string][]; copyFirst: string | null } {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const fields = [...params.entries()].filter(([label, value]) => label !== COPY_KEY && value.trim() !== "");
  return { fields, copyFirst: params.get(COPY_KEY) };
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function CopyPage() {
  const [{ fields, copyFirst }, setData] = useState<ReturnType<typeof readFields>>({ fields: [], copyFirst: null });
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    document.title = "Copiază — Anca Visuals";
    const data = readFields();
    setData(data);
    const first = data.fields.find(([label]) => label === data.copyFirst);
    // Browsers may refuse a copy that no tap started; the buttons below always work.
    if (first) void copyText(first[1]).then((ok) => ok && setCopied(first[0]));
    return () => { document.head.removeChild(meta); };
  }, []);

  const copy = async (label: string, value: string) => {
    if (await copyText(value)) setCopied(label);
  };

  return (
    <main style={{ minHeight: "100vh", background: "#fff", color: "#111", fontFamily: "Arial, Helvetica, sans-serif", padding: "48px 16px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ fontSize: 12, letterSpacing: 5, marginBottom: 14 }}>ANCA VISUALS</div>
        <hr style={{ border: "none", borderTop: "1px solid #111", margin: "0 0 28px" }} />
        {fields.length === 0 ? (
          <p style={{ fontSize: 15 }}>Nu e nimic de copiat. Deschide din nou linkul din email.</p>
        ) : (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 400, margin: "0 0 20px" }}>
              {copied ? `${copied} a fost copiat` : "Apasă pe ce vrei să copiezi"}
            </h1>
            <div style={{ border: "1px solid #111" }}>
              {fields.map(([label, value], index) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: index ? "1px solid #e5e5e5" : "none", background: copied === label ? "#f5f5f5" : "#fff" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#666", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 16, fontFamily: "'SFMono-Regular', Menlo, Consolas, monospace", wordBreak: "break-all" }}>{value}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(label, value)}
                    style={{ flexShrink: 0, padding: "10px 14px", border: "1px solid #111", borderRadius: 0, background: copied === label ? "#111" : "#fff", color: copied === label ? "#fff" : "#111", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}
                  >
                    {copied === label ? "Copiat ✓" : "Copiază"}
                  </button>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "#777", marginTop: 16 }}>Te poți întoarce în email după ce ai copiat.</p>
          </>
        )}
      </div>
    </main>
  );
}
