import { SystemConfig } from "../models/index.js";

export const getSystemConfig = async (req, res) => {
  try {
    let config = await SystemConfig.findById("global_config");
    if (!config) {
      config = new SystemConfig({ _id: "global_config" });
      await config.save();
    }
    res.json({
      google_client_id: config.google_client_id || process.env.VITE_GOOGLE_CLIENT_ID || "",
      restart_behavior: config.restart_behavior || "clear",
      chrome_user_data_dir: config.chrome_user_data_dir || "",
      proxies: config.proxies || [],
      webrtc_defense: config.webrtc_defense !== false,
      real_ip_defense: config.real_ip_defense !== false
    });
  } catch (err) {
    console.error("Error fetching config:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
};

export const updateSystemConfig = async (req, res) => {
  try {
    const { google_client_id, restart_behavior, chrome_user_data_dir, proxies, webrtc_defense, real_ip_defense } = req.body;
    let config = await SystemConfig.findById("global_config");
    if (!config) {
      config = new SystemConfig({ _id: "global_config" });
    }
    
    if (google_client_id !== undefined) config.google_client_id = google_client_id.trim();
    if (restart_behavior !== undefined) config.restart_behavior = restart_behavior;
    if (chrome_user_data_dir !== undefined) config.chrome_user_data_dir = chrome_user_data_dir.trim();
    if (proxies !== undefined) config.proxies = proxies;
    if (webrtc_defense !== undefined) config.webrtc_defense = webrtc_defense;
    if (real_ip_defense !== undefined) config.real_ip_defense = real_ip_defense;
    config.updated_at = new Date();
    await config.save();

    res.json({ message: "Config updated successfully", config });
  } catch (err) {
    console.error("Error updating config:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
};
