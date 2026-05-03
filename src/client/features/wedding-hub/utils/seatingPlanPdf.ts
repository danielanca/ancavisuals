import type { WeddingProfile, WeddingGuest, WeddingTable } from "../types";

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("ro-RO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

function rsvpLabel(status: string): string {
  if (status === "confirmat") return "✓";
  if (status === "refuzat") return "✗";
  return "?";
}

function rsvpColor(status: string): string {
  if (status === "confirmat") return "#4b7c57";
  if (status === "refuzat") return "#a05050";
  return "#8a7a4a";
}

function buildGuestRow(guest: WeddingGuest): string {
  const name = `${guest.firstName} ${guest.lastName}`.trim();
  const badge = rsvpLabel(guest.rsvpStatus);
  const color = rsvpColor(guest.rsvpStatus);

  const accompanying = [
    ...(guest.accompanyingAdultNames ?? []).filter(Boolean),
    ...(guest.childrenNames ?? []).filter(Boolean),
  ];
  const subline = accompanying.length > 0
    ? `<div style="font-size:10px;color:#999;margin-top:1px;">${accompanying.join(", ")}</div>`
    : "";

  return `
    <div style="display:flex;align-items:baseline;gap:6px;padding:4px 0;border-bottom:1px solid #f0eded;">
      <span style="font-size:10px;font-weight:600;color:${color};min-width:12px;">${badge}</span>
      <div style="flex:1;">
        <span style="font-size:12px;color:#2a2a2a;">${name}</span>
        ${subline}
      </div>
    </div>
  `;
}

function buildTableCard(
  table: WeddingTable,
  tableGuests: WeddingGuest[],
): string {
  const confirmed = tableGuests.filter((g) => g.rsvpStatus === "confirmat").length;
  const total = tableGuests.length;
  const fillPercent = table.capacity > 0 ? Math.round((total / table.capacity) * 100) : 0;
  const isFull = total >= table.capacity;

  const guestRows = tableGuests.length > 0
    ? tableGuests.map(buildGuestRow).join("")
    : `<div style="font-size:11px;color:#bbb;padding:6px 0;">— masă goală —</div>`;

  const aliasHtml = table.tableAlias
    ? `<div style="font-size:10px;color:#aaa;margin-top:1px;">${table.tableAlias}</div>`
    : "";

  const capacityColor = isFull ? "#c0392b" : total > 0 ? "#4b7c57" : "#aaa";

  return `
    <div style="
      background:#fff;
      border:1px solid #e0dbd8;
      border-radius:10px;
      padding:14px 16px;
      break-inside:avoid;
      page-break-inside:avoid;
      margin-bottom:12px;
    ">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <div>
          <div style="font-size:13px;font-weight:700;color:#1a1a1a;letter-spacing:0.01em;">${table.tableName}</div>
          ${aliasHtml}
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px;font-weight:600;color:${capacityColor};">${total}/${table.capacity}</div>
          <div style="font-size:9px;color:#aaa;">${fillPercent}% · ${confirmed} conf.</div>
        </div>
      </div>
      <div style="width:100%;height:2px;background:#f0eded;border-radius:2px;margin-bottom:8px;">
        <div style="width:${fillPercent}%;height:100%;background:${isFull ? "#c0392b" : "#c8b89a"};border-radius:2px;transition:width 0.2s;"></div>
      </div>
      <div>${guestRows}</div>
    </div>
  `;
}

export function printSeatingPlan(
  profile: WeddingProfile,
  tables: WeddingTable[],
  guests: WeddingGuest[],
): void {
  const tableGuestsMap = new Map<string, WeddingGuest[]>();
  tables.forEach((table) => {
    tableGuestsMap.set(table.id, guests.filter((g) => g.tableId === table.id));
  });

  const unassigned = guests.filter((g) => g.tableId === null);
  const totalAssigned = guests.filter((g) => g.tableId !== null).length;
  const totalConfirmed = guests.filter((g) => g.rsvpStatus === "confirmat").length;
  const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);

  const tableCards = tables.map((table) =>
    buildTableCard(table, tableGuestsMap.get(table.id) ?? [])
  ).join("");

  const unassignedSection = unassigned.length > 0 ? `
    <div style="margin-top:28px;page-break-before:auto;">
      <div style="font-size:13px;font-weight:700;color:#888;border-top:1px solid #e0dbd8;padding-top:16px;margin-bottom:10px;">
        Fără masă alocată (${unassigned.length})
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${unassigned.map((g) => `
          <span style="
            font-size:11px;
            color:#555;
            background:#f7f5f3;
            border:1px solid #e0dbd8;
            border-radius:20px;
            padding:3px 10px;
          ">${g.firstName} ${g.lastName}</span>
        `).join("")}
      </div>
    </div>
  ` : "";

  const html = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <title>Plan de mese — ${profile.brideFirstName} & ${profile.groomFirstName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      background: #faf8f6;
      color: #1a1a1a;
      padding: 32px 40px;
    }
    @media print {
      body { padding: 20px 28px; background: #fff; }
      @page { margin: 14mm 14mm; size: A4; }
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 24px;
    }
    @media (max-width: 700px) {
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #e0dbd8;">
    <div style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:#aaa;margin-bottom:6px;">Plan de mese</div>
    <div style="font-size:26px;font-weight:400;color:#1a1a1a;letter-spacing:0.02em;">
      ${profile.brideFirstName} &amp; ${profile.groomFirstName}
    </div>
    ${profile.weddingDate ? `<div style="font-size:13px;color:#888;margin-top:6px;">${formatDate(profile.weddingDate)}${profile.city ? ` · ${profile.city}` : ""}</div>` : ""}
  </div>

  <!-- Stats -->
  <div style="display:flex;gap:24px;justify-content:center;margin-bottom:24px;flex-wrap:wrap;">
    ${[
      { label: "Mese", value: tables.length },
      { label: "Locuri totale", value: totalCapacity },
      { label: "Alocați", value: totalAssigned },
      { label: "Confirmați", value: totalConfirmed },
      ...(unassigned.length > 0 ? [{ label: "Nealocați", value: unassigned.length }] : []),
    ].map(({ label, value }) => `
      <div style="text-align:center;">
        <div style="font-size:22px;font-weight:700;color:#2a2a2a;">${value}</div>
        <div style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#aaa;">${label}</div>
      </div>
    `).join("")}
  </div>

  <!-- Legend -->
  <div style="display:flex;gap:16px;justify-content:center;margin-bottom:20px;font-size:10px;color:#888;">
    <span><b style="color:#4b7c57;">✓</b> Confirmat</span>
    <span><b style="color:#8a7a4a;">?</b> În așteptare</span>
    <span><b style="color:#a05050;">✗</b> Refuzat</span>
  </div>

  <!-- Tables grid -->
  <div class="grid">${tableCards}</div>

  ${unassignedSection}

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:14px;border-top:1px solid #e8e4e1;text-align:center;font-size:9px;color:#ccc;letter-spacing:0.05em;">
    Generat de ancavisuals.ro · ${new Date().toLocaleDateString("ro-RO")}
  </div>
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.addEventListener("load", () => {
    printWindow.print();
  });
}
