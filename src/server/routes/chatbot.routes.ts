import { Router } from "express";

const router = Router();

// Legacy public AI endpoint is retired, including requests made outside the website UI.
router.post("/", (_req, res) => {
  res.set("Cache-Control", "no-store");
  return res.status(410).json({ error: "Chatbotul AI nu mai este disponibil. Ne poți contacta prin /contact." });
});

export default router;
