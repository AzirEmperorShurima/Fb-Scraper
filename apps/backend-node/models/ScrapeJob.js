import mongoose from "mongoose";
import { transformOptions } from "./transformOptions.js";
import { redisPub } from "../redis.js";

const ScrapeJobSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Custom UUID string mapped to _id
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  execution_id: { type: String, ref: "ScriptExecution" },
  group_url: { type: String, required: true },
  group_name: { type: String },
  status: { type: String, default: "pending" },
  version: { type: Number, default: 1 },
  max_posts: { type: Number, default: 50 },
  include_comments: { type: Boolean, default: false },
  since_date: { type: Date },
  until_date: { type: Date },
  keyword_filter: { type: String },
  min_reactions: { type: Number, default: 0 },
  sort_order: { type: String, default: "RECENT_ACTIVITY" },
  require_media: { type: Boolean, default: false },
  logs: { type: String, default: "" },
  custom_cookies: { type: mongoose.Schema.Types.Mixed, default: null },
  fb_account_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FBAccount' }],
  created_at: { type: Date, default: Date.now },
  completed_at: { type: Date },
  progress: { type: Number, default: 0 },
  error_message: { type: String },
  spreadsheet_url: { type: String }
}, transformOptions);

const publishJobUpdate = (doc) => {
  if (!doc) return;
  const payload = JSON.stringify({
    job_id: doc.id || doc._id.toString(),
    status: doc.status,
    progress: doc.progress,
    error_message: doc.error_message,
    completed_at: doc.completed_at ? doc.completed_at.toISOString() : null,
    logs: doc.logs || ""
  });
  redisPub.publish(`job_progress:${doc.id || doc._id.toString()}`, payload);
};

ScrapeJobSchema.post('save', function(doc) {
  publishJobUpdate(doc);
});
ScrapeJobSchema.post('findOneAndUpdate', async function() {
  const updatedDoc = await this.model.findOne(this.getQuery());
  publishJobUpdate(updatedDoc);
});

export const ScrapeJob = mongoose.model("ScrapeJob", ScrapeJobSchema);
