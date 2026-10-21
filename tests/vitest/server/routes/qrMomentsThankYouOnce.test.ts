import { beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  uploads: [] as Array<{ id: string; data: Record<string, unknown> }>,
}));
vi.mock('src/server/firestore', () => ({ firestore: () => ({
  collection: (name: string) => ({
    doc: (id: string) => {
      const key = `${name}/${id}`;
      return {
        get: async () => ({ exists: state.docs.has(key), data: () => state.docs.get(key) }),
        set: async (data: Record<string, unknown>) => { state.docs.set(key, { ...state.docs.get(key), ...data }); },
        update: async (data: Record<string, unknown>) => { state.docs.set(key, { ...state.docs.get(key), ...data }); },
        create: async (data: Record<string, unknown>) => {
          if (state.docs.has(key)) throw new Error('ALREADY_EXISTS');
          state.docs.set(key, data);
        },
      };
    },
    where: () => ({ where: () => ({ get: async () => ({ docs: state.uploads.map((upload) => ({ id: upload.id, data: () => upload.data })) }) }) }),
  }),
}) }));
import { claimThankYouEmail, thankYouEmailDocId } from 'src/server/routes/qrMoments.routes';

const guest = { id: 'guest-1', email: 'ana@example.com', name: 'Ana' };

beforeEach(() => {
  state.docs.clear();
  state.uploads = [];
});

describe('QR Moments thank-you email: once per guest and event', () => {
  test('the first thank-you sends the email and records the guest', async () => {
    await expect(claimThankYouEmail('event', guest, 'upload-1')).resolves.toBe(true);
    expect(state.docs.get(`qr_thank_you_emails/${thankYouEmailDocId('event', 'guest-1')}`)).toMatchObject({ email: 'ana@example.com', uploadId: 'upload-1' });
  });

  test('a second thank-you for another photo does not email again', async () => {
    await claimThankYouEmail('event', guest, 'upload-1');
    await expect(claimThankYouEmail('event', guest, 'upload-2')).resolves.toBe(false);
  });

  test('guests thanked before the record existed are recognised and recorded', async () => {
    state.uploads = [{ id: 'upload-old', data: { thankedAt: new Date() } }, { id: 'upload-2', data: {} }];
    await expect(claimThankYouEmail('event', guest, 'upload-2')).resolves.toBe(false);
    expect(state.docs.get(`qr_thank_you_emails/${thankYouEmailDocId('event', 'guest-1')}`)).toMatchObject({ backfilled: true });
  });

  test('the same guest at another event gets that event\'s email', async () => {
    await claimThankYouEmail('event', guest, 'upload-1');
    await expect(claimThankYouEmail('other-event', guest, 'upload-9')).resolves.toBe(true);
  });
});
