interface ChatbotLeadTemplateData {
  phone: string;
  dateLabel: string;
}

export function renderChatbotLeadTemplate({ phone, dateLabel }: ChatbotLeadTemplateData): string {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f9f9f9;border-radius:8px">
      <h2 style="margin:0 0 16px;color:#111">Lead nou prin chatbot</h2>
      <p style="margin:0 0 8px;color:#444">Un vizitator și-a lăsat numărul de telefon:</p>
      <div style="font-size:22px;font-weight:700;color:#111;padding:12px 16px;background:#fff;border-left:4px solid #22c55e;border-radius:4px;margin-bottom:16px">
        ${phone}
      </div>
      <p style="margin:0;color:#444">Data de interes: <strong>${dateLabel}</strong></p>
    </div>
  `;
}
