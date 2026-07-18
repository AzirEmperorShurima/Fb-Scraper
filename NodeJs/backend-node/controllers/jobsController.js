import { v4 as uuidv4 } from "uuid";
import { ScrapeJob, ScrapedPost, FBAccount, SystemConfig } from "../models/index.js";
import { scraperQueue } from "../worker.js";
import { redisClient } from "../redis.js";
import { verifyPostsStatus } from "../scraper/facebook.js";

export const createJob = async (req, res) => {
  const { group_url, max_posts, include_comments, since_date, until_date, keyword_filter, min_reactions, fb_account_ids, custom_cookies } = req.body;
  if (!group_url) {
    return res.status(400).json({ detail: "Facebook Group URL is required" });
  }

  const limit = max_posts || 50;
  const jobId = uuidv4();

  try {
    const accountsCount = await FBAccount.countDocuments({});
    if (accountsCount === 0 && !custom_cookies) {
      return res.status(400).json({ detail: "No Facebook accounts configured and no custom cookies provided." });
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
      fb_account_ids: fb_account_ids || [],
      custom_cookies: custom_cookies || null,
      logs: `[${new Date().toISOString().replace('T', ' ').substring(0, 19)}] ⏳ Đang khởi tạo hàng chờ cào nhóm...\n`,
      progress: 0
    });
    await newJob.save();

    await scraperQueue.add("scrapeJob", { jobId, maxPosts: limit, fbAccountIds: fb_account_ids });
    res.json(newJob);
  } catch (err) {
    console.error("Error creating job:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
};

export const listJobs = async (req, res) => {
  try {
    const jobs = await ScrapeJob.find({ user_id: req.user.id }).sort({ created_at: -1 });
    res.json(jobs);
  } catch (err) {
    console.error("Error listing jobs:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
};

export const getJobStatus = async (req, res) => {
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
};

export const stopJob = async (req, res) => {
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
};

export const pauseJob = async (req, res) => {
  const jobId = req.params.id;
  try {
    const job = await ScrapeJob.findById(jobId);
    if (!job) return res.status(404).json({ detail: "Job not found" });
    if (job.user_id && job.user_id.toString() !== req.user.id) return res.status(403).json({ detail: "Not authorized" });

    if (job.status !== "running") return res.status(400).json({ message: `Cannot pause job in ${job.status} state` });

    job.status = "paused";
    await job.save();
    res.json({ message: "Job paused successfully" });
  } catch (err) {
    res.status(500).json({ detail: "Internal server error" });
  }
};

export const resumeJob = async (req, res) => {
  const jobId = req.params.id;
  try {
    const job = await ScrapeJob.findById(jobId);
    if (!job) return res.status(404).json({ detail: "Job not found" });
    if (job.user_id && job.user_id.toString() !== req.user.id) return res.status(403).json({ detail: "Not authorized" });

    if (job.status !== "paused") return res.status(400).json({ message: `Cannot resume job in ${job.status} state` });

    job.status = "running";
    await job.save();
    res.json({ message: "Job resumed successfully" });
  } catch (err) {
    res.status(500).json({ detail: "Internal server error" });
  }
};

export const restartJob = async (req, res) => {
  const jobId = req.params.id;
  try {
    const job = await ScrapeJob.findById(jobId);
    if (!job) return res.status(404).json({ detail: "Job not found" });
    if (job.user_id && job.user_id.toString() !== req.user.id) return res.status(403).json({ detail: "Not authorized" });

    if (!["completed", "stopped", "failed"].includes(job.status)) {
      return res.status(400).json({ message: `Cannot restart job in ${job.status} state` });
    }

    let config = await SystemConfig.findById("global_config");
    const restartBehavior = config?.restart_behavior || "clear";

    if (restartBehavior === "clear") {
      await ScrapedPost.deleteMany({ job_id: jobId });
    } else {
      job.version = (job.version || 1) + 1;
    }

    job.status = "pending";
    job.progress = 0;
    job.logs = `Job restarted (Version: ${job.version || 1}).\n`;
    job.completed_at = null;
    await job.save();

    await redisClient.lPush("scraperQueue", JSON.stringify({
      id: Date.now().toString(),
      name: "scrapeJob",
      data: {
        jobId: job._id.toString(),
        maxPosts: job.max_posts,
        fbAccountId: null
      }
    }));

    res.json({ message: "Job restarted successfully" });
  } catch (err) {
    console.error("Error restarting job:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
};

export const getJobPosts = async (req, res) => {
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

    const version = req.query.version ? parseInt(req.query.version) : job.version || 1;
    const query = { job_id: jobId, job_version: version };
    if (search) {
      query.$or = [
        { text: { $regex: search, $options: "i" } },
        { author_name: { $regex: search, $options: "i" } }
      ];
    }

    const sortBy = req.query.sortBy || "scraped_asc";
    let sortObj = { _id: 1 };
    
    switch (sortBy) {
      case "timestamp_desc":
        sortObj = { timestamp: -1, _id: 1 };
        break;
      case "timestamp_asc":
        sortObj = { timestamp: 1, _id: 1 };
        break;
      case "scraped_desc":
        sortObj = { _id: -1 };
        break;
      case "scraped_asc":
        sortObj = { _id: 1 };
        break;
      case "reactions_desc":
        sortObj = { "reactions_json.total": -1, _id: 1 };
        break;
      case "comments_desc":
        sortObj = { comments_count: -1, _id: 1 };
        break;
    }

    const total = await ScrapedPost.countDocuments(query);
    const posts = await ScrapedPost.find(query)
      .sort(sortObj)
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
};

export const syncExtension = async (req, res) => {
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
};

export const deleteJob = async (req, res) => {
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
};

export const verifyStatus = async (req, res) => {
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
};
