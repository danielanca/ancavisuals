interface DateCheckTemplateData {
  humanDate: string;
  isBooked: boolean;
}

export function renderDateCheckTemplate({ humanDate, isBooked }: DateCheckTemplateData): string {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f9f9f9;border-radius:8px">
      <h2 style="margin:0 0 16px;color:#111">Verificare disponibilitate prin chatbot</h2>
      <p style="margin:0 0 8px;color:#444">Un vizitator a verificat disponibilitatea pentru data:</p>
      <div style="font-size:22px;font-weight:700;color:#111;padding:12px 16px;background:#fff;border-left:4px solid #f4d067;border-radius:4px;margin-bottom:16px">
        ${humanDate}
      </div>
      <p style="margin:0;color:#444">
        Status: <strong style="color:${isBooked ? "#e04444" : "#22c55e"}">${isBooked ? "❌ Ocupată" : "✅ Disponibilă"}</strong>
      </p>
    </div>
  `;
}
