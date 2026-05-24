import { Router } from "express";
import type { Request, Response } from "express";
import { getAuth } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin, type AuthenticatedRequest } from "../middleware/requireFirebaseAuth";
import { sendEmail } from "../notifications/mailer";
import { buildCollaboratorInviteHtml, buildCollaboratorInviteSubject } from "../notifications/templates/collaboratorInviteTemplate";
import { upsertCollaboratorInvite } from "../services/collaboratorInvite.service";

const router = Router();

router.use(requireFirebaseAuth, requireSupremeAdmin);

// GET /api/admin/accounts — list all Firebase Auth users
router.get("/accounts", async (_req: Request, res: Response) => {
  try {
    firestore(); // ensure Admin SDK initialized
    const listResult = await getAuth().listUsers(100);
    const users = listResult.users.map((user) => ({
      uid: user.uid,
      email: user.email ?? "",
      displayName: user.displayName ?? "",
      disabled: user.disabled,
      createdAt: user.metadata.creationTime,
      lastSignIn: user.metadata.lastSignInTime,
    }));
    res.json({ users });
  } catch (error) {
    console.error("[accounts] GET failed:", error);
    res.status(500).json({ error: "Nu s-au putut încărca conturile." });
  }
});

// PATCH /api/admin/accounts/:uid — update email and/or password
router.patch("/accounts/:uid", async (req: Request, res: Response) => {
  try {
    const { uid } = req.params;
    const { email, password } = req.body as { email?: string; password?: string };
    const updates: { email?: string; password?: string } = {};
    if (email) updates.email = email.trim();
    if (password) updates.password = password;
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: "Nimic de actualizat." });
    }
    await getAuth().updateUser(uid, updates);
    res.json({ ok: true });
  } catch (error) {
    console.error("[accounts] PATCH failed:", error);
    res.status(500).json({ error: String(error) });
  }
});

// GET /api/admin/account-invitations — list active/completed collaborator invites
router.get("/account-invitations", async (_req: Request, res: Response) => {
  try {
    const snapshot = await firestore()
      .collection("collaboratorInvites")
      .orderBy("updatedAt", "desc")
      .limit(100)
      .get();

    const invitations = snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const toIso = (value: unknown) =>
        value instanceof Timestamp ? value.toDate().toISOString() : null;

      return {
        id: doc.id,
        email: String(data.email ?? ""),
        albumSlug: String(data.albumSlug ?? ""),
        albumUrl: String(data.albumUrl ?? ""),
        inviteInstagram: Boolean(data.inviteInstagram),
        inviteModeration: Boolean(data.inviteModeration),
        status: String(data.status ?? "active"),
        reminderCount: Number(data.reminderCount ?? 0),
        createdByEmail: String(data.createdByEmail ?? ""),
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt),
        lastSentAt: toIso(data.lastSentAt),
        nextReminderAt: toIso(data.nextReminderAt),
        completedAt: toIso(data.completedAt),
        completedActionType: data.completedActionType ? String(data.completedActionType) : null,
        completedByEmail: data.completedByEmail ? String(data.completedByEmail) : null,
      };
    });

    res.json({ invitations });
  } catch (error) {
    console.error("[accounts] GET /account-invitations failed:", error);
    res.status(500).json({ error: "Nu s-au putut încărca invitațiile." });
  }
});

// POST /api/admin/account-invitations — send/re-send collaborator invite
router.post("/account-invitations", async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const { email, albumSlug, inviteInstagram, inviteModeration } = req.body as {
      email?: string;
      albumSlug?: string;
      inviteInstagram?: boolean;
      inviteModeration?: boolean;
    };

    const normalizedEmail = email?.trim().toLowerCase() ?? "";
    const normalizedSlug = albumSlug?.trim() ?? "";

    if (!normalizedEmail || !normalizedSlug) {
      return res.status(400).json({ error: "Emailul și albumul sunt obligatorii." });
    }
    if (!inviteInstagram && !inviteModeration) {
      return res.status(400).json({ error: "Alege cel puțin un tip de invitație." });
    }

    const user = await getAuth().getUserByEmail(normalizedEmail);
    const passwordSetupUrl = await getAuth().generatePasswordResetLink(normalizedEmail).catch(() => null);
    const invite = await upsertCollaboratorInvite({
      email: normalizedEmail,
      albumSlug: normalizedSlug,
      inviteInstagram: Boolean(inviteInstagram),
      inviteModeration: Boolean(inviteModeration),
      createdByEmail: authReq.firebaseEmail,
    });

    await sendEmail({
      to: normalizedEmail,
      subject: buildCollaboratorInviteSubject({
        recipientName: user.displayName ?? "",
        albumSlug: normalizedSlug,
        albumUrl: invite.albumUrl,
        inviteInstagram: invite.inviteInstagram,
        inviteModeration: invite.inviteModeration,
        senderName: "Daniel",
        passwordSetupUrl,
      }),
      html: buildCollaboratorInviteHtml({
        recipientName: user.displayName ?? "",
        albumSlug: normalizedSlug,
        albumUrl: invite.albumUrl,
        inviteInstagram: invite.inviteInstagram,
        inviteModeration: invite.inviteModeration,
        senderName: "Daniel",
        passwordSetupUrl,
      }),
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("[accounts] POST /account-invitations failed:", error);
    res.status(500).json({ error: "Invitația nu a putut fi trimisă." });
  }
});

export default router;
