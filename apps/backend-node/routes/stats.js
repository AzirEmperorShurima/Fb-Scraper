import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { getDashboardStats } from "../controllers/statsController.js";

const router = express.Router();

router.use(authenticateToken);
router.get("/dashboard", getDashboardStats);

export default router;
