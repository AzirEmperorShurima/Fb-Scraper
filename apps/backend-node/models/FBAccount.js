import mongoose from "mongoose";
import { transformOptions } from "./transformOptions.js";

const FBAccountSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String },
  cookies_json: { type: mongoose.Schema.Types.Mixed, default: [] },
  status: { type: String, default: "valid" },
  last_used: { type: Date },
  success_count: { type: Number, default: 0 },
  fail_count: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
}, transformOptions);

export const FBAccount = mongoose.model("FBAccount", FBAccountSchema);
