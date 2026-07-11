import mongoose from "mongoose";
import { redisPub } from "./redis.js";

const mongoUri = process.env.DATABASE_URL || "mongodb://localhost:27017/fbscraper";

// Global schema transform options to map MongoDB's _id to standard API id
const transformOptions = {
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
};

const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  hashed_password: { type: String }, // Optional for Google OAuth users
  googleId: { type: String, sparse: true, unique: true },
  name: { type: String },
  gsheet_webhook: { type: String },
  is_active: { type: Boolean, default: true }
}, transformOptions);

const FBAccountSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String },
  cookies_json: { type: mongoose.Schema.Types.Mixed, default: [] },
  status: { type: String, default: "valid" },
  last_used: { type: Date },
  created_at: { type: Date, default: Date.now }
}, transformOptions);

const ScrapeJobSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Custom UUID string mapped to _id
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  execution_id: { type: String, ref: "ScriptExecution" },
  group_url: { type: String, required: true },
  group_name: { type: String },
  status: { type: String, default: "pending" },
  max_posts: { type: Number, default: 50 },
  include_comments: { type: Boolean, default: false },
  since_date: { type: Date },
  until_date: { type: Date },
  keyword_filter: { type: String },
  min_reactions: { type: Number, default: 0 },
  logs: { type: String, default: "" },
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

const ScrapedPostSchema = new mongoose.Schema({
  job_id: { type: String, ref: "ScrapeJob", required: true },
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

// Declare Models
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

ScriptExecutionSchema.post('save', function(doc) {
  publishJobUpdate(doc);
});
ScriptExecutionSchema.post('findOneAndUpdate', async function() {
  const updatedDoc = await this.model.findOne(this.getQuery());
  publishJobUpdate(updatedDoc);
});

export const User = mongoose.model("User", UserSchema);
export const FBAccount = mongoose.model("FBAccount", FBAccountSchema);
export const ScrapeJob = mongoose.model("ScrapeJob", ScrapeJobSchema);
export const ScrapedPost = mongoose.model("ScrapedPost", ScrapedPostSchema);
export const CrawlerScript = mongoose.model("CrawlerScript", CrawlerScriptSchema);
export const ScriptExecution = mongoose.model("ScriptExecution", ScriptExecutionSchema);

const SystemConfigSchema = new mongoose.Schema({
  _id: { type: String, required: true, default: "global_config" },
  google_client_id: { type: String, default: "" },
  updated_at: { type: Date, default: Date.now }
}, transformOptions);
export const SystemConfig = mongoose.model("SystemConfig", SystemConfigSchema);

// Connection logic
export const initDatabase = async () => {
  console.log(`Connecting to MongoDB at URI: ${mongoUri}`);
  await mongoose.connect(mongoUri);
  console.log("MongoDB connected successfully.");
};
