import express from "express";
import multer from "multer";
import { authenticateToken } from "../middleware/auth.js";
import { register, login, getMe, updateSettings } from "../controllers/authController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", multer().none(), login);
router.get("/me", authenticateToken, getMe);
router.put("/me/settings", authenticateToken, updateSettings);

export default router;
