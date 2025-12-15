import { Router } from "express";
import { signBunnyUrl } from "../../utils/signBunnyUrl";

const router = Router();

router.get("/*", (req, res) => {
  const raw = req.path.replace(/^\/+/, "");
  if (!raw) return res.status(400).send("Missing path");

  const safe = raw.replace(/\.\./g, "").replace(/^\/+/, "");
  const url = signBunnyUrl(`/${safe}`);

  return res.redirect(302, url);
});

export default router;
