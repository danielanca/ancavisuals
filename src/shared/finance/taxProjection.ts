// Proiecția la 31 decembrie = facturile emise + ce mai e de facturat din evenimentele viitoare
// marcate „Fiscalizat” din acel an. Folosită de tab-ul Taxe și de asistentul financiar, ca
// ambele să numere la fel. Nefiscalizatele nu intră în niciun calcul (regula utilizatorului).

export interface ProjectionEvent {
  id: string;
  eventDate: Date | string | null;
  status: string;
  fiscalized?: boolean;
  pricing?: { total?: number } | null;
}

export interface ProjectionInvoice {
  eventId?: string | null;
  totalAmount: number;
  currency: string;
  taxExchangeRate?: number | null;
}

const PROJECTED_STATUSES = new Set(["confirmat", "tentativ"]);

/**
 * Evenimentele fiscalizate, confirmate sau tentative, de după `now` și până la 31 dec din
 * `year`, cu suma rămasă de facturat: prețul (EUR) minus facturile deja legate de eveniment,
 * din orice an (ex. avansul facturat anul trecut). Facturile în RON se convertesc la EUR cu
 * cursul de pe factură, altfel cu `eurRate`.
 */
export function fiscalizedEventsToInvoice<T extends ProjectionEvent>(
  events: T[],
  invoices: ProjectionInvoice[],
  { year, now, eurRate }: { year: number; now: Date; eurRate: number },
) {
  const invoicedEurByEvent = new Map<string, number>();
  for (const invoice of invoices) {
    if (!invoice.eventId) continue;
    const amount = Number(invoice.totalAmount) || 0;
    const eur = invoice.currency === "EUR" ? amount : amount / (invoice.taxExchangeRate || eurRate);
    invoicedEurByEvent.set(invoice.eventId, (invoicedEurByEvent.get(invoice.eventId) ?? 0) + eur);
  }

  const endOfYear = new Date(year, 11, 31, 23, 59, 59);
  return events
    .map((event) => ({ event, date: event.eventDate ? new Date(event.eventDate) : null }))
    .filter((row): row is { event: T; date: Date } => row.date !== null && !Number.isNaN(row.date.getTime()))
    .filter(({ event, date }) =>
      event.fiscalized === true && PROJECTED_STATUSES.has(event.status) && date > now && date <= endOfYear)
    .map(({ event, date }) => {
      const totalEur = Number(event.pricing?.total) || 0;
      const invoicedEur = invoicedEurByEvent.get(event.id) ?? 0;
      const toInvoiceEur = Math.max(0, totalEur - invoicedEur);
      return { event, date, totalEur, invoicedEur, toInvoiceEur, toInvoiceRon: toInvoiceEur * eurRate };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}
