import mongoose from "mongoose";
import { transformOptions } from "./transformOptions.js";
import { redisPub } from "../redis.js";

const ScriptExecutionSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  script_id: { type: String, ref: "CrawlerScript", required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, default: "pending" }, // pending, running, completed, failed, stopped
  current_step: { type: Number, default: 0 },
  total_steps: { type: Number, default: 0 },
  logs: { type: String, default: "" },
  progress: { type: Number, default: 0 },
  spreadsheet_url: { type: String },
  created_at: { type: Date, default: Date.now },
  completed_at: { type: Date }
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

ScriptExecutionSchema.post('save', function(doc) {
  publishJobUpdate(doc);
});
ScriptExecutionSchema.post('findOneAndUpdate', async function() {
  const updatedDoc = await this.model.findOne(this.getQuery());
  publishJobUpdate(updatedDoc);
});

export const ScriptExecution = mongoose.model("ScriptExecution", ScriptExecutionSchema);
