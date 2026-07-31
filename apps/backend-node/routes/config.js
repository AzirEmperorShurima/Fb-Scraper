import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { createOrUpdateFBAccount, listFBAccounts, deleteFBAccount, updateFBAccount, checkFBAccountCookie, checkAllFBAccountsCookies } from "../controllers/configController.js";

const router = express.Router();
router.use(authenticateToken);

router.post("/check-all", checkAllFBAccountsCookies);
router.post("/:id/check", checkFBAccountCookie);

router.post("/", createOrUpdateFBAccount);
router.get("/", listFBAccounts);
router.delete("/:id", deleteFBAccount);
router.put("/:id", updateFBAccount);

export default router;
