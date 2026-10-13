import { firestore } from '../firestore';
import type { QrParticipant } from '../../shared/qrMoments/participants';

function isoDate(value: unknown): string | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  return null;
}

export async function listQrParticipants(
  resolveAlbum: (data: { adminEventId?: string | null; albumSlug?: string | null }, slug: string) => Promise<string | null>,
): Promise<QrParticipant[]> {
  const db = firestore();
  const [events, guests, uploads] = await Promise.all([
    db.collection('qr_events').get(), db.collection('qr_guests').get(), db.collection('qr_uploads').get(),
  ]);
  const eventMap = new Map(events.docs.map(doc => [String(doc.data().eventSlug || doc.id), doc.data()]));
  const albums = new Map(await Promise.all([...eventMap].map(async ([slug, data]) =>
    [slug, await resolveAlbum(data, slug)] as const,
  )));
  const guestUploads = new Map<string, Array<{ albumSlug: string; createdAt: string | null }>>();
  for (const doc of uploads.docs) {
    const data = doc.data();
    const key = JSON.stringify([data.eventSlug, data.guestId]);
    const entries = guestUploads.get(key) ?? [];
    entries.push({ albumSlug: typeof data.albumSlug === 'string' ? data.albumSlug.trim() : '', createdAt: isoDate(data.createdAt) });
    guestUploads.set(key, entries);
  }
  return guests.docs.flatMap(doc => {
    const data = doc.data();
    const eventSlug = String(data.eventSlug ?? '');
    if (!eventSlug) return [];
    const event = eventMap.get(eventSlug);
    const materials = guestUploads.get(JSON.stringify([eventSlug, doc.id])) ?? [];
    const uploadDates = materials.map(upload => upload.createdAt).filter((date): date is string => date !== null).sort();
    const albumSlugs = [...new Set(materials.map(upload => upload.albumSlug || albums.get(eventSlug)).filter((slug): slug is string => !!slug))];
    if (!albumSlugs.length && albums.get(eventSlug)) albumSlugs.push(albums.get(eventSlug)!);
    return [{
      id: doc.id, name: String(data.name || 'Anonim'), email: String(data.email ?? '').trim().toLowerCase(),
      eventSlug, eventLabel: [event?.bride, event?.groom].filter(Boolean).join(' & ') || eventSlug,
      albumSlugs, uploadCount: materials.length, emailConsent: data.emailConsent === true,
      createdAt: isoDate(data.createdAt),
      firstUploadAt: uploadDates[0] ?? null,
      lastUploadAt: uploadDates[uploadDates.length - 1] ?? null,
    }];
  }).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || a.name.localeCompare(b.name, 'ro'));
}
