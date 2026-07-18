import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { getJobAnalytics } from "../controllers/analyticsController.js";

const router = express.Router();

router.use(authenticateToken);
router.get("/:id/analytics", getJobAnalytics);

export default router;
