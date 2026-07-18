import mongoose from "mongoose";
import { transformOptions } from "./transformOptions.js";

const ScrapedPostSchema = new mongoose.Schema({
  job_id: { type: String, ref: "ScrapeJob", required: true },
  job_version: { type: Number, default: 1 },
  post_id: { type: String, required: true },
  author_name: { type: String },
  author_url: { type: String },
  author_avatar_url: { type: String },
  post_url: { type: String },
  is_deleted: { type: Boolean, default: false },
  text: { type: String },
  timestamp: { type: Date },
  reactions_json: { type: mongoose.Schema.Types.Mixed, default: {} },
  comments_count: { type: Number, default: 0 },
  comments_json: { type: mongoose.Schema.Types.Mixed, default: [] },
  attachments_json: { type: [String], default: [] },
  created_at: { type: Date, default: Date.now }
}, transformOptions);

export const ScrapedPost = mongoose.model("ScrapedPost", ScrapedPostSchema);
