import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Request, Response } from 'express';
import { Timestamp } from 'firebase-admin/firestore';

const state = vi.hoisted(() => ({
  store: new Map<string, Record<string, unknown>>(),
  added: [] as Array<{ collection: string; data: Record<string, unknown> }>,
  updated: [] as Array<{ path: string; data: Record<string, unknown> }>,
  sendEmail: vi.fn(),
}));
vi.mock('src/server/firestore', () => ({ firestore: () => ({
  collection: (name: string) => ({
    doc: (id: string) => ({
      get: async () => ({ id, exists: state.store.has(`${name}/${id}`), data: () => state.store.get(`${name}/${id}`) }),
      update: async (data: Record<string, unknown>) => { state.updated.push({ path: `${name}/${id}`, data }); },
    }),
    add: async (data: Record<string, unknown>) => { state.added.push({ collection: name, data }); return { id: 'wish-1' }; },
    where: () => ({ get: async () => ({ docs: [] }) }),
  }),
}) }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: vi.fn().mockRejectedValue(new Error('no')) }) }));
vi.mock('src/server/notifications/mailer', () => ({ sendEmail: state.sendEmail }));
import router from 'src/server/routes/qrMoments.routes';

async function sendWish(body: Record<string, unknown>) {
  const layer = router.stack.find(entry => entry.route?.path === '/:eventSlug/wish');
  const response = {
    statusCode: 200, body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
  };
  await layer!.route.stack[0].handle(
    { params: { eventSlug: 'event' }, body, headers: {} } as unknown as Request,
    response as unknown as Response,
    vi.fn(),
  );
  return response;
}

beforeEach(() => {
  state.store.clear();
  state.added.length = 0;
  state.updated.length = 0;
  state.sendEmail.mockReset().mockResolvedValue(undefined);
  const soon = new Date();
  state.store.set('qr_events/event', { pin: 'SECRET', eventDate: Timestamp.fromDate(soon), notificationEmail: 'owner@example.com' });
  state.store.set('qr_guests/guest', { eventSlug: 'event', name: 'Ana' });
});

describe('QR Moments written wish', () => {
  test('saves the wish as a text upload and tells the owner', async () => {
    const response = await sendWish({ guestId: 'guest', pass: 'SECRET', text: '  Casă de piatră! 💛  ' });
    expect(response.statusCode).toBe(201);
    expect(state.added).toHaveLength(1);
    expect(state.added[0].collection).toBe('qr_uploads');
    expect(state.added[0].data).toMatchObject({ eventSlug: 'event', guestId: 'guest', type: 'text', text: 'Casă de piatră! 💛', visible: true });
    expect(state.updated[0].path).toBe('qr_guests/guest');
    expect(state.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'owner@example.com',
      subject: 'QR Moments: Ana a încărcat o urare scrisă',
    }));
  });

  test('rejects an empty or too long wish', async () => {
    expect((await sendWish({ guestId: 'guest', pass: 'SECRET', text: '   ' })).statusCode).toBe(400);
    expect((await sendWish({ guestId: 'guest', pass: 'SECRET', text: 'a'.repeat(1501) })).statusCode).toBe(400);
    expect(state.added).toHaveLength(0);
  });

  test('rejects a wrong PIN, a guest of another event and a closed upload window', async () => {
    expect((await sendWish({ guestId: 'guest', pass: 'WRONG', text: 'Hi' })).statusCode).toBe(403);
    state.store.set('qr_guests/guest', { eventSlug: 'other', name: 'Ana' });
    expect((await sendWish({ guestId: 'guest', pass: 'SECRET', text: 'Hi' })).statusCode).toBe(403);
    state.store.set('qr_guests/guest', { eventSlug: 'event', name: 'Ana' });
    state.store.set('qr_events/event', { pin: 'SECRET', eventDate: Timestamp.fromDate(new Date('2020-01-01')) });
    expect((await sendWish({ guestId: 'guest', pass: 'SECRET', text: 'Hi' })).statusCode).toBe(403);
    expect(state.added).toHaveLength(0);
  });
});
