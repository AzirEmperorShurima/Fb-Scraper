import { ScrapeJob, ScrapedPost, FBAccount, SystemConfig } from "../models/index.js";
import { scrapeFbGroup } from "../scraper/facebook.js";
import { runWithAccountRotation } from "./accountRotator.js";

export const runScrapingProcess = async (jobId, maxPosts, fbAccountIds) => {
  const appendLog = async (msg) => {
    try {
      const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const logLine = `[${timestampStr}] ${msg}\n`;
      await ScrapeJob.findByIdAndUpdate(jobId, [
        { $set: { logs: { $concat: [ { $ifNull: ["$logs", ""] }, logLine ] } } }
      ]);
    } catch (e) {
      console.error("Failed to write log:", e);
    }
  };

  try {
    await ScrapeJob.findByIdAndUpdate(jobId, { status: "running", progress: 5 });
    const jobConfig = await ScrapeJob.findById(jobId);
    
    const progressCallback = async (progressVal) => {
      await ScrapeJob.findByIdAndUpdate(jobId, { progress: progressVal });
    };

    const logCallback = async (logMsgText) => {
      await appendLog(logMsgText);
    };

    const checkStatusCallback = async () => {
      const currentJob = await ScrapeJob.findById(jobId).select("status");
      return currentJob ? currentJob.status : "stopped";
    };

    const config = await SystemConfig.findById("global_config");
    const userDataDir = config?.chrome_user_data_dir || null;
    const webrtcDefense = config?.webrtc_defense !== false;
    const realIpDefense = config?.real_ip_defense !== false;
    const proxies = config?.proxies || [];

    const task = async (account, cookies) => {
      return await scrapeFbGroup({
        groupUrl: jobConfig.group_url,
        maxPosts,
        cookies,
        email: account ? account.email : null,
        password: account ? account.password : null,
        progressCallback,
        sinceDate: jobConfig.since_date,
        untilDate: jobConfig.until_date,
        keywordFilter: jobConfig.keyword_filter,
        minReactions: jobConfig.min_reactions,
        sortOrder: jobConfig.sort_order,
        requireMedia: jobConfig.require_media,
        logCallback,
        checkStatusCallback,
        userDataDir,
        webrtcDefense,
        realIpDefense,
        proxies
      });
    };

    const { result } = await runWithAccountRotation(fbAccountIds, jobConfig.custom_cookies, appendLog, task);
    
    if (result && result.posts) {
      const postsToInsert = result.posts.map(p => ({
        job_id: jobId,
        job_version: jobConfig.version || 1,
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
    }

    const finalJobCheck = await ScrapeJob.findById(jobId).select("status");
    if (finalJobCheck && !["stopped", "failed"].includes(finalJobCheck.status)) {
      await ScrapeJob.findByIdAndUpdate(jobId, {
        status: "completed",
        progress: 100,
        completed_at: new Date()
      });
    }

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
