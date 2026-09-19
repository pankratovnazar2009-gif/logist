import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { lookupCompanyByNip } from "../services/gus";

export const nipRouter = Router();

/**
 * GET /api/nip/:nip — предпросмотр данных фирмы из GUS до сохранения профиля.
 */
nipRouter.get("/:nip", requireAuth, async (req, res) => {
  const nip = req.params.nip;
  if (!/^\d{10}$/.test(nip)) return res.status(400).json({ error: "invalid_nip" });

  const company = await lookupCompanyByNip(nip).catch((err) => {
    console.error("GUS lookup failed", err);
    return null;
  });
  if (!company) return res.status(404).json({ error: "nip_not_found" });
  res.json({ company });
});
