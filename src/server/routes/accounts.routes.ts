import { Router } from "express";
import type { Request, Response } from "express";
import { getAuth } from "firebase-admin/auth";
import { firestore } from "../firestore";
import { requireFirebaseAuth, requireSupremeAdmin } from "../middleware/requireFirebaseAuth";

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

export default router;
