import { Router } from "express";
import { requireAuth, AuthedRequest } from "../auth.js";

const router = Router();

router.get("/", requireAuth, (req: AuthedRequest, res) => {
  return res.json({ user: req.user });
});

export default router;
