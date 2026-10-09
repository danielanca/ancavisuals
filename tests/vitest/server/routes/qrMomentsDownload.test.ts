import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Request, Response } from 'express';

const state = vi.hoisted(() => ({
  store: new Map<string, Record<string, unknown>>(),
  download: vi.fn(),
  verify: vi.fn(),
}));
vi.mock('src/server/firestore', () => ({ firestore: () => ({
  collection: (name: string) => ({ doc: (id: string) => ({ get: async () => ({
    exists: state.store.has(`${name}/${id}`), data: () => state.store.get(`${name}/${id}`),
  }) }) }),
}) }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: state.verify }) }));
vi.mock('src/server/utils/downloadBunnyOriginal', () => ({ downloadBunnyOriginal: state.download }));
import router from 'src/server/routes/qrMoments.routes';

async function call(pin?: string, authorization?: string) {
  const layer = router.stack.find(entry => entry.route?.path === '/:eventSlug/photo/:uploadId/download');
  const response = {
    statusCode: 200, body: undefined as unknown,
    setHeader: vi.fn(), attachment: vi.fn(),
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
    send(body: unknown) { this.body = body; return this; },
  };
  await layer!.route.stack[0].handle({
    params: { eventSlug: 'event', uploadId: 'photo' }, query: { pin }, headers: { authorization },
  } as unknown as Request, response as unknown as Response, vi.fn());
  return response;
}

beforeEach(() => {
  state.store.clear();
  state.store.set('qr_events/event', { pin: 'SECRET' });
  state.store.set('qr_uploads/photo', { eventSlug: 'event', visible: true, type: 'photo', bunnyUrl: 'https://cdn.example.com/photo.jpg', originalName: 'Amintire.jpg' });
  state.download.mockReset().mockResolvedValue({ buffer: Buffer.from('photo-bytes'), contentType: 'image/jpeg' });
  state.verify.mockReset().mockResolvedValue({ email: 'ancadaniel1994@gmail.com' });
});

describe('QR Moments photo downloads', () => {
  test('returns the uploaded file as an attachment with a valid PIN', async () => {
    const response = await call('SECRET');
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(Buffer.from('photo-bytes'));
    expect(response.attachment).toHaveBeenCalledWith('Amintire.jpg');
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(state.download).toHaveBeenCalledWith('https://cdn.example.com/photo.jpg');
  });
  test('rejects missing and incorrect PINs before accessing the file', async () => {
    expect((await call()).statusCode).toBe(401);
    expect((await call('WRONG')).statusCode).toBe(403);
    expect(state.download).not.toHaveBeenCalled();
  });
  test('allows the supreme admin without a PIN, rejects other accounts', async () => {
    expect((await call(undefined, 'Bearer admin')).statusCode).toBe(200);
    state.verify.mockResolvedValue({ email: 'other@example.com' });
    expect((await call(undefined, 'Bearer other')).statusCode).toBe(401);
  });
  test('rejects uploads from another event, hidden uploads, videos and missing photos', async () => {
    for (const change of [{ eventSlug: 'other' }, { visible: false }, { type: 'video' }]) {
      state.store.set('qr_uploads/photo', { eventSlug: 'event', visible: true, type: 'photo', ...change });
      expect((await call('SECRET')).statusCode).toBe(404);
    }
    state.store.delete('qr_uploads/photo');
    expect((await call('SECRET')).statusCode).toBe(404);
    expect(state.download).not.toHaveBeenCalled();
  });
  test('reports upstream failure without returning an attachment', async () => {
    state.download.mockRejectedValue(new Error('Unavailable'));
    const response = await call('SECRET');
    expect(response.statusCode).toBe(502);
    expect(response.attachment).not.toHaveBeenCalled();
  });
});
