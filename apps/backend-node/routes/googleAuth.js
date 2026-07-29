import express from "express";
import { googleLogin } from "../controllers/googleAuthController.js";

const router = express.Router();

router.post("/", googleLogin);

export default router;
