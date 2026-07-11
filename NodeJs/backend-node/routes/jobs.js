import express from "express";
import { v4 as uuidv4 } from "uuid";
import { ScrapeJob, ScrapedPost, FBAccount, User } from "../database.js";
import { authenticateToken } from "../middleware/auth.js";
import { scrapeFbGroup, verifyPostsStatus } from "../scraper/facebook.js";
import { scraperQueue } from "../worker.js";

const router = express.Router();

router.use(authenticateToken);

export const runScrapingProcess = async (jobId, maxPosts, fbAccountId) => {
  const appendLog = async (msg) => {
    try {
      const job = await ScrapeJob.findById(jobId);
      if (job) {
        const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
        job.logs = (job.logs || "") + `[${timestampStr}] ${msg}\n`;
        await job.save();
      }
    } catch (e) {
      console.error("Failed to write log:", e);
    }
  };

  try {
    await ScrapeJob.findByIdAndUpdate(jobId, { status: "running", progress: 5 });
    const jobConfig = await ScrapeJob.findById(jobId);
    
    let account = null;
    if (fbAccountId) {
      account = await FBAccount.findById(fbAccountId);
    } else {
      account = await FBAccount.findOne({ status: "valid" });
    }
    if (!account) {
      account = await FBAccount.findOne({});
    }

    const email = account ? account.email : null;
    const password = account ? account.password : null;
    const cookiesStr = account ? account.cookies_json : null;
    let cookies = [];
    try {
      cookies = typeof cookiesStr === "string" ? JSON.parse(cookiesStr) : cookiesStr;
    } catch (e) {}

    const progressCallback = async (progressVal) => {
      await ScrapeJob.findByIdAndUpdate(jobId, { progress: progressVal });
    };

    const logCallback = async (logMsgText) => {
      await appendLog(logMsgText);
    };

    const { posts, cookies: newCookies } = await scrapeFbGroup({
      groupUrl: jobConfig.group_url,
      maxPosts,
      cookies,
      email,
      password,
      progressCallback,
      sinceDate: jobConfig.since_date,
      untilDate: jobConfig.until_date,
      keywordFilter: jobConfig.keyword_filter,
      minReactions: jobConfig.min_reactions,
      logCallback
    });

    const postsToInsert = posts.map(p => ({
      job_id: jobId,
      post_id: p.post_id,
      author_name: p.author_name,
      author_url: p.author_url,
      author_avatar_url: p.author_avatar_url,
      post_url: p.post_url,
      is_deleted: p.is_deleted,
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

    if (newCookies && newCookies.length > 0 && account) {
      account.cookies_json = newCookies;
      await account.save();
    }

    await ScrapeJob.findByIdAndUpdate(jobId, {
      status: "completed",
      progress: 100,
      completed_at: new Date()
    });

  } catch (err) {
    console.error(`Scraping task failed for job ${jobId}:`, err);
    await ScrapeJob.findByIdAndUpdate(jobId, {
      status: "failed",
      completed_at: new Date(),
      error_message: err.message
    });
    await appendLog(`❌ Gặp lỗi trong tiến trình cào: ${err.message}`);
  }
};

// Create a scrape job
router.post("/", async (req, res) => {
  const { group_url, max_posts, include_comments, since_date, until_date, keyword_filter, min_reactions, fb_account_id } = req.body;
  if (!group_url) {
    return res.status(400).json({ detail: "Facebook Group URL is required" });
  }

  const limit = max_posts || 50;
  const jobId = uuidv4();

  try {
    const accountsCount = await FBAccount.countDocuments({});
    if (accountsCount === 0) {
      return res.status(400).json({ detail: "No Facebook accounts configured. Add one in settings first." });
    }

    const newJob = new ScrapeJob({
      _id: jobId,
      user_id: req.user.id,
      group_url,
      status: "pending",
      max_posts: limit,
      include_comments: !!include_comments,
      since_date: since_date ? new Date(since_date) : null,
      until_date: until_date ? new Date(until_date) : null,
      keyword_filter: keyword_filter || null,
      min_reactions: min_reactions ? parseInt(min_reactions) : 0,
      logs: `[${new Date().toISOString().replace('T', ' ').substring(0, 19)}] ⏳ Đang khởi tạo hàng chờ cào nhóm...\n`,
      progress: 0
    });
    await newJob.save();

    await scraperQueue.add("scrapeJob", { jobId, maxPosts: limit, fbAccountId: fb_account_id });
    res.json(newJob);
  } catch (err) {
    console.error("Error creating job:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// List jobs
router.get("/", async (req, res) => {
  try {
    const jobs = await ScrapeJob.find({ user_id: req.user.id }).sort({ created_at: -1 });
    res.json(jobs);
  } catch (err) {
    console.error("Error listing jobs:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// Get job status
router.get("/:id", async (req, res) => {
  const jobId = req.params.id;
  try {
    const job = await ScrapeJob.findById(jobId);
    if (!job) {
      return res.status(404).json({ detail: "Job profile not found" });
    }
    if (job.user_id.toString() !== req.user.id) {
      return res.status(403).json({ detail: "Not authorized to view this job" });
    }
    res.json(job);
  } catch (err) {
    console.error("Error retrieving job:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// Stop a running job
router.post("/:id/stop", async (req, res) => {
  const jobId = req.params.id;
  try {
    const job = await ScrapeJob.findById(jobId);
    if (!job) {
      return res.status(404).json({ detail: "Job not found" });
    }
    if (job.user_id.toString() !== req.user.id) {
      return res.status(403).json({ detail: "Not authorized to modify this job" });
    }

    if (!["pending", "running"].includes(job.status)) {
      return res.json({ message: `Job is already in ${job.status} state` });
    }

    job.status = "stopped";
    job.completed_at = new Date();
    await job.save();

    res.json({ message: "Job aborted successfully" });
  } catch (err) {
    console.error("Error aborting job:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// Paginated posts list
router.get("/:id/posts", async (req, res) => {
  const jobId = req.params.id;
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 10;
  const search = req.query.search || "";
  const offset = (page - 1) * size;

  try {
    const job = await ScrapeJob.findById(jobId);
    if (!job) {
      return res.status(404).json({ detail: "Job not found" });
    }
    if (job.user_id.toString() !== req.user.id) {
      return res.status(403).json({ detail: "Not authorized to view posts for this job" });
    }

    const query = { job_id: jobId };
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

    res.json({
      total,
      page,
      size,
      posts
    });
  } catch (err) {
    console.error("Error fetching job posts:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// Sync data cào được từ Chrome Extension (Protected)
router.post("/sync-extension", async (req, res) => {
  const { group_url, group_name, posts } = req.body;
  if (!group_url || !posts || !Array.isArray(posts)) {
    return res.status(400).json({ detail: "Missing group_url or posts array" });
  }

  try {
    const jobId = uuidv4();
    const newJob = new ScrapeJob({
      _id: jobId,
      user_id: req.user.id,
      group_url,
      group_name,
      status: "completed",
      max_posts: posts.length,
      include_comments: true,
      progress: 100,
      logs: `[${new Date().toISOString().replace('T', ' ').substring(0, 19)}] 🔌 Đồng bộ hóa bài viết thành công từ Chrome Extension Pro Helper.\n`,
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

    res.json({ message: "Sync successful", job_id: jobId });
  } catch (err) {
    console.error("Error syncing extension data:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

// Delete a job and its posts
router.delete("/:id", async (req, res) => {
  const jobId = req.params.id;
  try {
    const job = await ScrapeJob.findById(jobId);
    if (!job) {
      return res.status(404).json({ detail: "Job not found" });
    }
    if (job.user_id.toString() !== req.user.id) {
      return res.status(403).json({ detail: "Not authorized to delete this job" });
    }

    await ScrapedPost.deleteMany({ job_id: jobId });
    await ScrapeJob.findByIdAndDelete(jobId);

    res.json({ message: "Job deleted successfully" });
  } catch (err) {
    console.error("Error deleting job:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

router.post("/:id/verify-status", async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await ScrapeJob.findById(jobId);
    if (!job) return res.status(404).json({ detail: "Job not found" });

    // Send initial response since verification is a long-running process
    res.json({ message: "Verification started in the background." });

    // Run verification in background
    (async () => {
      try {
        const posts = await ScrapedPost.find({ job_id: jobId });
        const postUrls = posts.map(p => p.post_url || `https://facebook.com/${p.post_id}`);
        
        let account = await FBAccount.findOne({ status: "valid" }) || await FBAccount.findOne({});
        const cookiesStr = account ? account.cookies_json : null;
        let cookies = [];
        try { cookies = typeof cookiesStr === "string" ? JSON.parse(cookiesStr) : cookiesStr; } catch (e) {}

        const results = await verifyPostsStatus(postUrls, cookies);
        
        // Update DB
        for (const post of posts) {
          const pUrl = post.post_url || `https://facebook.com/${post.post_id}`;
          if (results[pUrl] !== undefined) {
            post.is_deleted = results[pUrl];
            await post.save();
          }
        }
        
        job.logs = (job.logs || "") + `[${new Date().toISOString()}] Đã hoàn thành Verify Status: Cập nhật thành công.\n`;
        await job.save();
      } catch (err) {
        console.error("Background verify failed:", err);
      }
    })();
  } catch (err) {
    console.error("Error starting verify:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
