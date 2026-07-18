import { v4 as uuidv4 } from "uuid";
import { ScriptExecution, ScrapeJob, ScrapedPost, FBAccount } from "../models/index.js";
import { scrapeFbGroup } from "../scraper/facebook.js";

export const runScriptProcess = async (executionId, script, fbAccountIds) => {
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
    let accountsToTry = [];
    if (fbAccountIds && Array.isArray(fbAccountIds) && fbAccountIds.length > 0) {
      for (const id of fbAccountIds) {
        const acc = await FBAccount.findById(id);
        if (acc) accountsToTry.push(acc);
      }
    }
    if (accountsToTry.length === 0) {
      const acc = await FBAccount.findOne({ status: "valid" });
      if (acc) accountsToTry.push(acc);
    }
    
    if (accountsToTry.length === 0) {
      throw new Error("No Facebook accounts available to run the script.");
    }

    await ScriptExecution.findByIdAndUpdate(executionId, { status: "running" });

    let currentAccountIndex = 0;
    
    for (let i = 0; i < script.steps.length; i++) {
      if (currentAccountIndex >= accountsToTry.length) {
        await appendLog(`❌ Hết tài khoản dự phòng hợp lệ, dừng kịch bản sớm tại bước ${i + 1}.`);
        break;
      }
      
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

      let stepSuccess = false;
      
      while (currentAccountIndex < accountsToTry.length) {
        const account = accountsToTry[currentAccountIndex];
        let cookies = [];
        try { cookies = typeof account.cookies_json === "string" ? JSON.parse(account.cookies_json) : account.cookies_json || []; } catch(e) {}
        
        await appendLog(`🔄 Đang thử cào Step ${i + 1} bằng tài khoản: ${account.email} (${currentAccountIndex + 1}/${accountsToTry.length})`);
        
        try {
          const { posts, cookies: newCookies } = await scrapeFbGroup({
            groupUrl: step.group_url,
            maxPosts: step.max_posts,
            cookies: cookies,
            email: account.email,
            password: account.password,
            progressCallback: async (p) => { await ScrapeJob.findByIdAndUpdate(jobId, { progress: p }); },
            sinceDate: script.since_date,
            untilDate: script.until_date,
            keywordFilter: step.keyword_filter,
            minReactions: step.min_reactions,
            logCallback: async (l) => {
              const j = await ScrapeJob.findById(jobId);
              if(j) { j.logs += l + "\n"; await j.save(); }
            },
            checkStatusCallback: async () => {
              const j = await ScrapeJob.findById(jobId);
              return j ? j.status : "stopped";
            }
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

          if (newCookies && newCookies.length > 0) {
            account.cookies_json = newCookies;
          }
          account.status = "valid";
          account.last_used = new Date();
          account.success_count = (account.success_count || 0) + 1;
          await account.save();

          const finalJobCheck = await ScrapeJob.findById(jobId).select("status");
          if (finalJobCheck && !["stopped", "failed"].includes(finalJobCheck.status)) {
            await ScrapeJob.findByIdAndUpdate(jobId, { status: "completed", progress: 100, completed_at: new Date() });
          }
          await appendLog(`✅ Hoàn thành Step ${i + 1}. Thu được ${posts.length} bài viết.`);
          
          stepSuccess = true;
          break; // Đã cào thành công step này, thoát vòng lặp account
          
        } catch (err) {
          await appendLog(`❌ Lỗi Step ${i + 1} với tài khoản ${account.email}: ${err.message}`);
          account.fail_count = (account.fail_count || 0) + 1;
          await account.save();
          currentAccountIndex++;
          if (currentAccountIndex < accountsToTry.length) {
            await appendLog(`➡️ Chuyển sang tài khoản dự phòng tiếp theo...`);
          }
        }
      }
      
      if (!stepSuccess) {
        await ScrapeJob.findByIdAndUpdate(jobId, { status: "failed", error_message: "Failed on all backup accounts" });
        await appendLog(`❌ Không thể hoàn thành Step ${i + 1} bằng bất kỳ tài khoản nào.`);
      }
    }

    const finalExecCheck = await ScriptExecution.findById(executionId).select("status");
    if (finalExecCheck && !["stopped", "failed"].includes(finalExecCheck.status)) {
      await ScriptExecution.findByIdAndUpdate(executionId, {
        status: "completed",
        progress: 100,
        completed_at: new Date()
      });
    }
    await appendLog(`🎉 Kịch bản đã chạy xong toàn bộ ${script.steps.length} bước!`);

  } catch (err) {
    console.error("Script Execution Error:", err);
    await ScriptExecution.findByIdAndUpdate(executionId, { status: "failed", completed_at: new Date() });
    await appendLog(`❌ Kịch bản thất bại: ${err.message}`);
  }
};
