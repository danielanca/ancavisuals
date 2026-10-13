import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Request, Response } from 'express';
import { Timestamp } from 'firebase-admin/firestore';

const state = vi.hoisted(() => ({ store: new Map<string, Record<string, unknown>>(), fail: false }));
vi.mock('src/server/firestore', () => ({ firestore: () => ({ collection: (name: string) => ({
  get: async () => {
    if (state.fail) throw new Error('offline');
    return { docs: [...state.store].filter(([key]) => key.startsWith(`${name}/`)).map(([key, value]) => ({ id: key.slice(name.length + 1), data: () => value })) };
  },
  doc: (id: string) => ({
    get: async () => ({ exists: state.store.has(`${name}/${id}`), data: () => state.store.get(`${name}/${id}`) }),
    update: async (value: Record<string, unknown>) => state.store.set(`${name}/${id}`, { ...state.store.get(`${name}/${id}`), ...value }),
  }),
}) }) }));
vi.mock('src/server/notifications/mailer', () => ({ sendEmail: vi.fn() }));
import router, { resolveQrAlbumSlug } from 'src/server/routes/qrMoments.routes';
import { listQrParticipants } from 'src/server/services/qrParticipants.service';
import { requireFirebaseAuth, requireSupremeAdmin } from 'src/server/middleware/requireFirebaseAuth';

beforeEach(() => {
  state.store.clear(); state.fail = false;
  state.store.set('qr_events/qr-event', { eventSlug: 'qr-event', bride: 'Ana', groom: 'Dan', adminEventId: 'admin-event' });
  state.store.set('adminEvents/admin-event', { albumSlug: 'album-real' });
  state.store.set('qr_guests/guest', { eventSlug: 'qr-event', name: 'Maria', email: ' MARIA@EXAMPLE.COM ', emailConsent: false, uploadIds: ['stale', 'photo'] });
  state.store.set('qr_uploads/photo', { eventSlug: 'qr-event', guestId: 'guest', albumSlug: 'album-original', visible: false });
  state.store.set('qr_uploads/unrelated', { eventSlug: 'other', guestId: 'guest', albumSlug: 'other-album' });
});

describe('QR participants directory', () => {
  test('returns registration time and first/last actual uploads independently of storage order', async () => {
    const at = (value: string) => Timestamp.fromDate(new Date(value));
    state.store.set('qr_guests/guest', { ...state.store.get('qr_guests/guest'), createdAt: at('2026-10-10T08:00:00Z') });
    state.store.set('qr_uploads/photo', { ...state.store.get('qr_uploads/photo'), createdAt: at('2026-10-13T20:15:00Z') });
    state.store.set('qr_uploads/earlier', { eventSlug: 'qr-event', guestId: 'guest', createdAt: at('2026-10-10T08:20:00Z') });
    state.store.set('qr_uploads/unrelated', { eventSlug: 'other', guestId: 'guest', createdAt: at('2026-10-15T00:00:00Z') });
    expect((await listQrParticipants(resolveQrAlbumSlug))[0]).toMatchObject({
      createdAt: '2026-10-10T08:00:00.000Z', firstUploadAt: '2026-10-10T08:20:00.000Z', lastUploadAt: '2026-10-13T20:15:00.000Z', uploadCount: 2,
    });
  });
  test('keeps unavailable upload dates unknown instead of using registration time', async () => {
    state.store.set('qr_guests/guest', { ...state.store.get('qr_guests/guest'), createdAt: Timestamp.now() });
    state.store.set('qr_uploads/invalid-date', { eventSlug: 'qr-event', guestId: 'guest', createdAt: { toDate: () => new Date('invalid') } });
    expect((await listQrParticipants(resolveQrAlbumSlug))[0]).toMatchObject({ firstUploadAt: null, lastUploadAt: null, uploadCount: 2 });
  });
  test('uses actual uploads and their album, retains unsubscribed contacts and normalizes email', async () => {
    expect(await listQrParticipants(resolveQrAlbumSlug)).toEqual([expect.objectContaining({
      name: 'Maria', email: 'maria@example.com', eventLabel: 'Ana & Dan', eventSlug: 'qr-event',
      uploadCount: 1, albumSlugs: ['album-original'], emailConsent: false,
    })]);
  });
  test('includes guests without email or uploads and resolves the linked album', async () => {
    state.store.set('qr_guests/no-email', { eventSlug: 'qr-event', name: 'Ioana' });
    const people = await listQrParticipants(resolveQrAlbumSlug);
    expect(people.find(person => person.id === 'no-email')).toMatchObject({ email: '', uploadCount: 0, albumSlugs: ['album-real'], emailConsent: false, firstUploadAt: null, lastUploadAt: null });
  });
  test('keeps participation at multiple events separate and supports standalone events', async () => {
    state.store.set('qr_events/standalone', { eventSlug: 'standalone', bride: 'Echipa' });
    state.store.set('qr_guests/second', { eventSlug: 'standalone', name: 'Maria', email: 'maria@example.com', emailConsent: true });
    const people = await listQrParticipants(resolveQrAlbumSlug);
    expect(people).toHaveLength(2);
    expect(people.find(person => person.id === 'second')).toMatchObject({ eventLabel: 'Echipa', albumSlugs: ['standalone'], emailConsent: true });
  });
  test('protects the endpoint with both admin middleware and disables caching', async () => {
    const route = router.stack.find(layer => layer.route?.path === '/admin/participants')!.route;
    expect(route.stack[0].handle).toBe(requireFirebaseAuth);
    expect(route.stack[1].handle).toBe(requireSupremeAdmin);
    const res = { setHeader: vi.fn(), json: vi.fn(), status: vi.fn().mockReturnThis() };
    await route.stack[2].handle({} as Request, res as unknown as Response, vi.fn());
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.json).toHaveBeenCalledWith({ participants: expect.any(Array) });
    state.fail = true;
    await route.stack[2].handle({} as Request, res as unknown as Response, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
  test('unsubscribe persists emailConsent=false and is reflected in the directory', async () => {
    state.store.set('qr_guests/guest', { ...state.store.get('qr_guests/guest'), emailConsent: true });
    const route = router.stack.find(layer => layer.route?.path === '/unsubscribe/:guestId')!.route;
    const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
    await route.stack[0].handle({ params: { guestId: 'guest' } } as unknown as Request, res as unknown as Response, vi.fn());
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect((await listQrParticipants(resolveQrAlbumSlug))[0].emailConsent).toBe(false);
  });
});
