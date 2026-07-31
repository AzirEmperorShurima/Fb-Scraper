import mongoose from "mongoose";
import { transformOptions } from "./transformOptions.js";

const SystemConfigSchema = new mongoose.Schema({
  _id: { type: String, required: true, default: "global_config" },
  google_client_id: { type: String, default: "" },
  restart_behavior: { type: String, enum: ['clear', 'version'], default: 'clear' },
  chrome_user_data_dir: { type: String, default: "" },
  proxies: [{
    server: String,
    username: String,
    password: String,
    type: { type: String, default: 'HTTP' }, // HTTP, SOCKS4, SOCKS5
    status: { type: String, default: 'active' }
  }],
  webrtc_defense: { type: Boolean, default: true },
  real_ip_defense: { type: Boolean, default: true },
  updated_at: { type: Date, default: Date.now }
}, transformOptions);

export const SystemConfig = mongoose.model("SystemConfig", SystemConfigSchema);
