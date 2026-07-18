import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { syncSheets, syncJob, syncExecution, deleteSheet } from "../controllers/sheetsController.js";

const router = express.Router();

router.post("/sync", authenticateToken, syncSheets);
router.post("/sync-job/:id", authenticateToken, syncJob);
router.post("/sync-execution/:id", authenticateToken, syncExecution);
router.delete("/sheet/:sheetId", authenticateToken, deleteSheet);

export default router;
