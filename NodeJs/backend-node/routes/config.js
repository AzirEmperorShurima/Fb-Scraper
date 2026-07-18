import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { createOrUpdateFBAccount, listFBAccounts, deleteFBAccount, updateFBAccount } from "../controllers/configController.js";

const router = express.Router();
router.use(authenticateToken);

router.post("/", createOrUpdateFBAccount);
router.get("/", listFBAccounts);
router.delete("/:id", deleteFBAccount);
router.put("/:id", updateFBAccount);

export default router;
