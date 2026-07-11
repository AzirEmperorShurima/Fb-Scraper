import express from "express";
import { v4 as uuidv4 } from "uuid";
import { CrawlerScript, ScriptExecution, ScrapeJob, ScrapedPost, FBAccount } from "../database.js";
import { authenticateToken } from "../middleware/auth.js";
import { scrapeFbGroup } from "../scraper/facebook.js";
import { scraperQueue } from "../worker.js";

const router = express.Router();
router.use(authenticateToken);

// Create a new script
router.post("/", async (req, res) => {
  try {
    const { name, description, steps, since_date, until_date } = req.body;
    if (!name || !steps || steps.length === 0) {
      return res.status(400).json({ detail: "Name and steps are required" });
    }

    const scriptId = uuidv4();
    const newScript = new CrawlerScript({
      _id: scriptId,
      user_id: req.user.id || req.user.user_id,
      name,
      description,
      steps,
      since_date: since_date ? new Date(since_date) : null,
      until_date: until_date ? new Date(until_date) : null
    });
    
    await newScript.save();
    res.json(newScript);
  } catch (err) {
    console.error("Create script error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// List all scripts
router.get("/", async (req, res) => {
  try {
    const scripts = await CrawlerScript.find({ user_id: req.user.id || req.user.user_id }).sort({ created_at: -1 });
    res.json(scripts);
  } catch (err) {
    console.error("List scripts error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// Delete a script
router.delete("/:id", async (req, res) => {
  try {
    const script = await CrawlerScript.findById(req.params.id);
    if (!script) return res.status(404).json({ detail: "Script not found" });
    if (script.user_id.toString() !== (req.user.id || req.user.user_id)) {
      return res.status(403).json({ detail: "Forbidden" });
    }
    await CrawlerScript.findByIdAndDelete(req.params.id);
    res.json({ message: "Script deleted" });
  } catch (err) {
    res.status(500).json({ detail: "Internal server error" });
  }
});

// Update a script
router.put("/:id", async (req, res) => {
  try {
    const script = await CrawlerScript.findById(req.params.id);
    if (!script) return res.status(404).json({ detail: "Script not found" });
    if (script.user_id.toString() !== (req.user.id || req.user.user_id)) {
      return res.status(403).json({ detail: "Forbidden" });
    }
    
    const { name, description, steps, since_date, until_date } = req.body;
    if (name) script.name = name;
    if (description !== undefined) script.description = description;
    if (steps) script.steps = steps;
    if (since_date !== undefined) script.since_date = since_date ? new Date(since_date) : null;
    if (until_date !== undefined) script.until_date = until_date ? new Date(until_date) : null;
    
    await script.save();
    res.json(script);
  } catch (err) {
    console.error("Update script error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// Worker to run a script
export const runScriptProcess = async (executionId, script, fbAccountId) => {
  const appendLog = async (msg) => {
    try {
      const exec = await ScriptExecution.findById(executionId);
      if (exec) {
        const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
        exec.logs = (exec.logs || "") + `[${ts}] ${msg}\n`;
        await exec.save();
      }
    } catch (e) {}
  };

  try {
    let account = fbAccountId ? await FBAccount.findById(fbAccountId) : await FBAccount.findOne({ status: "valid" });
    if (!account) account = await FBAccount.findOne({});
    
    const email = account ? account.email : null;
    const password = account ? account.password : null;
    let cookies = [];
    try { cookies = typeof account?.cookies_json === "string" ? JSON.parse(account.cookies_json) : account?.cookies_json || []; } catch(e) {}

    await ScriptExecution.findByIdAndUpdate(executionId, { status: "running" });

    let currentCookies = cookies;
    for (let i = 0; i < script.steps.length; i++) {
      const step = script.steps[i];
      await ScriptExecution.findByIdAndUpdate(executionId, { current_step: i + 1, progress: Math.floor((i / script.steps.length) * 100) });
      await appendLog(`▶ Bắt đầu chạy Step ${i + 1}: ${step.group_url}`);

      // Create a sub-job for this step
      const jobId = uuidv4();
      const newJob = new ScrapeJob({
        _id: jobId,
        user_id: script.user_id,
        execution_id: executionId,
        group_url: step.group_url,
        status: "running",
        max_posts: step.max_posts,
        since_date: script.since_date,
        until_date: script.until_date,
        keyword_filter: step.keyword_filter,
        min_reactions: step.min_reactions,
        logs: `Chạy từ Script Execution: ${executionId}\n`
      });
      await newJob.save();

      try {
        const { posts, cookies: newCookies } = await scrapeFbGroup({
          groupUrl: step.group_url,
          maxPosts: step.max_posts,
          cookies: currentCookies,
          email,
          password,
          progressCallback: async (p) => { await ScrapeJob.findByIdAndUpdate(jobId, { progress: p }); },
          sinceDate: script.since_date,
          untilDate: script.until_date,
          keywordFilter: step.keyword_filter,
          minReactions: step.min_reactions,
          logCallback: async (l) => {
            const j = await ScrapeJob.findById(jobId);
            if(j) { j.logs += l + "\n"; await j.save(); }
          }
        });

        const postsToInsert = posts.map(p => ({
          job_id: jobId,
          post_id: p.post_id,
          author_name: p.author_name,
          author_url: p.author_url,
          text: p.text,
          timestamp: p.timestamp,
          reactions_json: p.reactions_json,
          comments_count: p.comments_count,
          comments_json: p.comments_json,
          attachments_json: p.attachments_json
        }));

        if (postsToInsert.length > 0) {
          await ScrapedPost.insertMany(postsToInsert);
        }

        if (newCookies && newCookies.length > 0) currentCookies = newCookies;

        await ScrapeJob.findByIdAndUpdate(jobId, { status: "completed", progress: 100, completed_at: new Date() });
        await appendLog(`✅ Hoàn thành Step ${i + 1}. Thu được ${posts.length} bài viết.`);

      } catch (err) {
        await ScrapeJob.findByIdAndUpdate(jobId, { status: "failed", error_message: err.message });
        await appendLog(`❌ Lỗi ở Step ${i + 1}: ${err.message}`);
        // Optionally continue or break. We continue for scripts.
      }
    }

    if (account && currentCookies !== cookies) {
      account.cookies_json = currentCookies;
      await account.save();
    }

    await ScriptExecution.findByIdAndUpdate(executionId, {
      status: "completed",
      progress: 100,
      completed_at: new Date()
    });
    await appendLog(`🎉 Kịch bản đã chạy xong toàn bộ ${script.steps.length} bước!`);

  } catch (err) {
    console.error("Script Execution Error:", err);
    await ScriptExecution.findByIdAndUpdate(executionId, { status: "failed", completed_at: new Date() });
    await appendLog(`❌ Kịch bản thất bại: ${err.message}`);
  }
};

// Execute a script via Extension
router.post("/:id/execute", async (req, res) => {
  try {
    const script = await CrawlerScript.findById(req.params.id);
    if (!script) return res.status(404).json({ detail: "Script not found" });
    if (script.user_id.toString() !== (req.user.id || req.user.user_id)) {
      return res.status(403).json({ detail: "Forbidden" });
    }

    const fbAccountId = req.body ? req.body.fb_account_id : null;
    let account = fbAccountId ? await FBAccount.findById(fbAccountId) : await FBAccount.findOne({ status: "valid" });
    if (!account) account = await FBAccount.findOne({});

    const executionId = uuidv4();
    const newExec = new ScriptExecution({
      _id: executionId,
      script_id: script._id,
      user_id: script.user_id,
      status: "running",
      total_steps: script.steps.length,
      current_step: 0,
      logs: `[${new Date().toISOString().replace('T', ' ').substring(0, 19)}] Khởi chạy kịch bản thông qua Chrome Extension: ${script.name}\n`
    });
    await newExec.save();

    await scraperQueue.add("scriptJob", { executionId, script, fbAccountId });

    res.json({
      execution: newExec,
      script,
      fbAccount: account ? { email: account.email, password: account.password } : null
    });
  } catch (err) {
    console.error("Execute script error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// List executions
router.get("/executions", async (req, res) => {
  try {
    const execs = await ScriptExecution.find({ user_id: req.user.id || req.user.user_id })
      .populate("script_id", "name")
      .sort({ created_at: -1 });
    res.json(execs);
  } catch (err) {
    console.error("List executions error:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// Delete an execution
router.delete("/executions/:id", async (req, res) => {
  try {
    const exec = await ScriptExecution.findById(req.params.id);
    if (!exec) return res.status(404).json({ detail: "Execution not found" });
    if (exec.user_id.toString() !== (req.user.id || req.user.user_id)) {
      return res.status(403).json({ detail: "Forbidden" });
    }
    await ScriptExecution.findByIdAndDelete(req.params.id);
    res.json({ message: "Execution deleted" });
  } catch (err) {
    res.status(500).json({ detail: "Internal server error" });
  }
});

// Get execution details
router.get("/executions/:id", async (req, res) => {
  try {
    console.log("GET /executions/:id called with ID:", req.params.id);
    const exec = await ScriptExecution.findById(req.params.id).populate("script_id", "name");
    console.log("Found exec:", exec ? exec._id : "null");
    if (!exec) return res.status(404).json({ detail: "Execution not found" });
    if (exec.user_id.toString() !== (req.user.id || req.user.user_id)) {
      return res.status(403).json({ detail: "Forbidden" });
    }
    res.json(exec);
  } catch (err) {
    res.status(500).json({ detail: "Internal server error" });
  }
});

// Paginated posts list for an execution (aggregates all jobs of this execution)
router.get("/executions/:id/posts", async (req, res) => {
  const executionId = req.params.id;
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 10;
  const search = req.query.search || "";
  const offset = (page - 1) * size;

  try {
    const exec = await ScriptExecution.findById(executionId);
    if (!exec) return res.status(404).json({ detail: "Execution not found" });
    if (exec.user_id.toString() !== (req.user.id || req.user.user_id)) {
      return res.status(403).json({ detail: "Forbidden" });
    }

    const jobs = await ScrapeJob.find({ execution_id: executionId });
    const jobIds = jobs.map(j => j._id);

    const query = { job_id: { $in: jobIds } };
    if (search) {
      query.$or = [
        { text: { $regex: search, $options: "i" } },
        { author_name: { $regex: search, $options: "i" } }
      ];
    }

    const total = await ScrapedPost.countDocuments(query);
    const posts = await ScrapedPost.find(query)
      .sort({ _id: 1 })
      .skip(offset)
      .limit(size);

    res.json({ total, page, size, posts });
  } catch (err) {
    res.status(500).json({ detail: "Internal server error" });
  }
});

// Extension callbacks
router.post("/executions/:id/log", async (req, res) => {
  try {
    const exec = await ScriptExecution.findById(req.params.id);
    if (exec) {
      const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
      exec.logs = (exec.logs || "") + `[${ts}] ${req.body.message}\n`;
      await exec.save();
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({}); }
});

router.post("/executions/:id/progress", async (req, res) => {
  try {
    await ScriptExecution.findByIdAndUpdate(req.params.id, { progress: req.body.progress });
    res.json({ success: true });
  } catch (err) { res.status(500).json({}); }
});

router.post("/executions/:id/sync-step", async (req, res) => {
  try {
    const { step_index, group_url, group_name, posts } = req.body;
    const executionId = req.params.id;
    
    const exec = await ScriptExecution.findById(executionId);
    if (!exec) return res.status(404).json({});

    // Create a sub-job for this step
    const jobId = uuidv4();
    const newJob = new ScrapeJob({
      _id: jobId,
      user_id: exec.user_id,
      execution_id: executionId,
      group_url: group_url,
      group_name: group_name,
      status: "completed",
      max_posts: posts.length,
      progress: 100,
      logs: `Sync from extension for step ${step_index}\n`,
      completed_at: new Date()
    });
    await newJob.save();

    const postsToInsert = posts.map(p => ({
      job_id: jobId,
      post_id: p.post_id,
      author_name: p.author_name || "Facebook User",
      author_url: p.author_url || "",
      author_avatar_url: p.author_avatar_url || "",
      post_url: p.post_url || "",
      text: p.text || "",
      timestamp: p.timestamp ? new Date(p.timestamp) : new Date(),
      reactions_json: p.reactions_json || {},
      comments_count: p.comments_count || 0,
      comments_json: p.comments_json || [],
      attachments_json: p.attachments_json || []
    }));

    if (postsToInsert.length > 0) {
      await ScrapedPost.insertMany(postsToInsert);
    }

    res.json({ success: true, job_id: jobId });
  } catch (err) {
    console.error(err);
    res.status(500).json({});
  }
});

router.post("/executions/:id/complete", async (req, res) => {
  try {
    await ScriptExecution.findByIdAndUpdate(req.params.id, {
      status: "completed",
      progress: 100,
      completed_at: new Date()
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({}); }
});

export default router;
