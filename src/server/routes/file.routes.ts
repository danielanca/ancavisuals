import { Router } from "express";
import { signBunnyUrl } from "../utils/signBunnyUrl";
import { publicMediaPath } from "../constants/bunny";

const router = Router();

router.get("/*", (req, res) => {
  const raw = req.path.replace(/^\/+/, "");
  if (!raw) return res.status(400).send("Missing path");

  // Checked on the decoded path; signed as received, like before.
  if (!publicMediaPath(raw)) return res.status(403).send("Forbidden");
  const url = signBunnyUrl(`/${raw}`);

  return res.redirect(302, url);
});

export default router;
