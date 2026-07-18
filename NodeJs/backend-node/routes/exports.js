import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { exportData } from "../controllers/exportsController.js";

const router = express.Router();

router.use(authenticateToken);
router.get("/:id/export", exportData);

export default router;
