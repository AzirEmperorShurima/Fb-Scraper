import mongoose from "mongoose";
import { transformOptions } from "./transformOptions.js";

const CrawlerScriptSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  description: { type: String },
  steps: [{
    step_order: { type: Number },
    group_url: { type: String, required: true },
    max_posts: { type: Number, default: 50 },
    keyword_filter: { type: String },
    min_reactions: { type: Number, default: 0 }
  }],
  since_date: { type: Date },
  until_date: { type: Date },
  created_at: { type: Date, default: Date.now }
}, transformOptions);

export const CrawlerScript = mongoose.model("CrawlerScript", CrawlerScriptSchema);
