import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { getSystemConfig, updateSystemConfig } from "../controllers/systemConfigController.js";

const router = express.Router();

router.get("/", getSystemConfig);
router.post("/", authenticateToken, updateSystemConfig);

export default router;
