import { Router, type Request, type Response } from 'express';
import { Timestamp } from 'firebase-admin/firestore';
import { firestore } from '../firestore';
import { sendEmail } from '../notifications/mailer';

const router = Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'ancadaniel1994@gmail.com';

router.post('/lead', async (request: Request, response: Response) => {
  const { referredName, referredContact, fromAlbum, source } = request.body as {
    referredName?: string;
    referredContact?: string;
    fromAlbum?: string;
    source?: string;
  };

  if (!referredName?.trim() || !referredContact?.trim()) {
    response.status(400).json({ error: 'Numele și contactul sunt obligatorii.' });
    return;
  }

  try {
    await firestore().collection('leads').add({
      source: source ?? 'referral',
      referredName: referredName.trim(),
      referredContact: referredContact.trim(),
      fromAlbum: fromAlbum?.trim() ?? null,
      createdAt: Timestamp.now(),
    });

    sendEmail({
      to: ADMIN_EMAIL,
      subject: `🎁 Recomandare nouă de la ${fromAlbum ?? 'QR Moments'}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0a0a0a;color:#e5e5e5;border-radius:12px;">
          <h2 style="color:#f5c842;margin:0 0 16px;">Recomandare nouă!</h2>
          <p style="color:#a3a3a3;margin:0 0 8px;">
            Un invitat de la <strong style="color:#fff;">${fromAlbum ?? 'un eveniment'}</strong> a recomandat pe cineva:
          </p>
          <table style="width:100%;border-collapse:collapse;margin:12px 0;">
            <tr>
              <td style="color:#737373;padding:6px 0;width:120px;">Nume recomandat</td>
              <td style="color:#fff;font-weight:600;">${referredName.trim()}</td>
            </tr>
            <tr>
              <td style="color:#737373;padding:6px 0;">Contact</td>
              <td style="color:#fff;font-weight:600;">${referredContact.trim()}</td>
            </tr>
          </table>
          <p style="color:#444;font-size:11px;margin:20px 0 0;">AncaVisuals · ancavisuals.ro</p>
        </div>
      `,
    }).catch(() => {});

    response.json({ ok: true });
  } catch {
    response.status(500).json({ error: 'Eroare server.' });
  }
});

export default router;
