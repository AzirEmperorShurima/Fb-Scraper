import express from "express";
import { SystemConfig } from "../database.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    let config = await SystemConfig.findById("global_config");
    if (!config) {
      config = new SystemConfig({ _id: "global_config" });
      await config.save();
    }
    res.json({
      google_client_id: config.google_client_id || process.env.VITE_GOOGLE_CLIENT_ID || ""
    });
  } catch (err) {
    console.error("Error fetching config:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

router.post("/", authenticateToken, async (req, res) => {
  try {
    const { google_client_id } = req.body;
    let config = await SystemConfig.findById("global_config");
    if (!config) {
      config = new SystemConfig({ _id: "global_config" });
    }
    
    if (google_client_id !== undefined) config.google_client_id = google_client_id.trim();
    config.updated_at = new Date();
    await config.save();

    res.json({ message: "Config updated successfully", config });
  } catch (err) {
    console.error("Error updating config:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
