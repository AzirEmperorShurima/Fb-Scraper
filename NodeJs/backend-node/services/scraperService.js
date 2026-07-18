import { ScrapeJob, ScrapedPost, FBAccount } from "../models/index.js";
import { scrapeFbGroup } from "../scraper/facebook.js";

export const runScrapingProcess = async (jobId, maxPosts, fbAccountIds) => {
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

    // Prepare list of accounts to try
    let accountsToTry = [];
    if (fbAccountIds && Array.isArray(fbAccountIds) && fbAccountIds.length > 0) {
      for (const id of fbAccountIds) {
        const acc = await FBAccount.findById(id);
        if (acc) accountsToTry.push(acc);
      }
    }

    let scrapingSuccess = false;
    let lastError = null;

    if (accountsToTry.length === 0 && !jobConfig.custom_cookies) {
      // Fallback
      const acc = await FBAccount.findOne({ status: "valid" });
      if (acc) accountsToTry.push(acc);
    }

    if (accountsToTry.length === 0 && !jobConfig.custom_cookies) {
      throw new Error("No Facebook accounts or custom cookies available to run the job.");
    }

    if (jobConfig.custom_cookies && accountsToTry.length === 0) {
      let cookies = [];
      try {
        cookies = typeof jobConfig.custom_cookies === "string" ? JSON.parse(jobConfig.custom_cookies) : jobConfig.custom_cookies;
      } catch (e) {}

      await appendLog(`🔄 Bắt đầu cào bằng Custom Cookies...`);
      const { posts, cookies: newCookies } = await scrapeFbGroup({
        groupUrl: jobConfig.group_url,
        maxPosts,
        cookies,
        email: null,
        password: null,
        progressCallback,
        sinceDate: jobConfig.since_date,
        untilDate: jobConfig.until_date,
        keywordFilter: jobConfig.keyword_filter,
        minReactions: jobConfig.min_reactions,
        logCallback,
        checkStatusCallback
      });

      const postsToInsert = posts.map(p => ({
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
      scrapingSuccess = true;
    } else {
      for (let i = 0; i < accountsToTry.length; i++) {
        const account = accountsToTry[i];
        let cookies = [];
        try {
          cookies = typeof account.cookies_json === "string" ? JSON.parse(account.cookies_json) : account.cookies_json;
        } catch (e) {}

        await appendLog(`🔄 Đang thử cào với tài khoản: ${account.email} (${i+1}/${accountsToTry.length})`);

        try {
          const { posts, cookies: newCookies } = await scrapeFbGroup({
            groupUrl: jobConfig.group_url,
            maxPosts,
            cookies,
            email: account.email,
            password: account.password,
            progressCallback,
            sinceDate: jobConfig.since_date,
            untilDate: jobConfig.until_date,
            keywordFilter: jobConfig.keyword_filter,
            minReactions: jobConfig.min_reactions,
            logCallback,
            checkStatusCallback
          });

          const postsToInsert = posts.map(p => ({
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

          if (newCookies && newCookies.length > 0) {
            account.cookies_json = newCookies;
          }
          account.status = "valid";
          account.last_used = new Date();
          account.success_count = (account.success_count || 0) + 1;
          await account.save();
          
          scrapingSuccess = true;
          break; // Success!
        } catch (err) {
          lastError = err;
          await appendLog(`❌ Lỗi với tài khoản ${account.email}: ${err.message}`);
          account.fail_count = (account.fail_count || 0) + 1;
          await account.save();

          if (i < accountsToTry.length - 1) {
             await appendLog(`➡️ Chuyển sang tài khoản dự phòng tiếp theo...`);
          }
        }
      }
    }

    if (!scrapingSuccess) {
      throw lastError || new Error("Quá trình cào thất bại trên tất cả các tài khoản dự phòng.");
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
