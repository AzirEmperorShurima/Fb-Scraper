import { v4 as uuidv4 } from "uuid";
import { ScriptExecution, ScrapeJob, ScrapedPost, FBAccount, SystemConfig } from "../models/index.js";
import { scrapeFbGroup } from "../scraper/facebook.js";
import { runWithAccountRotation } from "./accountRotator.js";

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

  const config = await SystemConfig.findById("global_config");
  const userDataDir = config?.chrome_user_data_dir || null;
  const webrtcDefense = config?.webrtc_defense !== false;
  const realIpDefense = config?.real_ip_defense !== false;
  const proxies = config?.proxies || [];

  try {
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

      let stepSuccess = false;
      const task = async (account, cookies) => {
        return await scrapeFbGroup({
          groupUrl: step.group_url,
          maxPosts: step.max_posts,
          cookies: cookies,
          email: account ? account.email : null,
          password: account ? account.password : null,
          progressCallback: async (p) => { await ScrapeJob.findByIdAndUpdate(jobId, { progress: p }); },
          sinceDate: script.since_date,
          untilDate: script.until_date,
          keywordFilter: step.keyword_filter,
          minReactions: step.min_reactions,
          sortOrder: step.sort_order,
          requireMedia: step.require_media,
          logCallback: async (l) => {
            const j = await ScrapeJob.findById(jobId);
            if(j) { j.logs += l + "\n"; await j.save(); }
          },
          checkStatusCallback: async () => {
            const j = await ScrapeJob.findById(jobId);
            return j ? j.status : "stopped";
          },
          userDataDir,
          webrtcDefense,
          realIpDefense,
          proxies
        });
      };

      try {
        const { result } = await runWithAccountRotation(fbAccountIds, null, appendLog, task);
        
        if (result && result.posts) {
          const postsToInsert = result.posts.map(p => ({
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
        }
        
        const finalJobCheck = await ScrapeJob.findById(jobId).select("status");
        if (finalJobCheck && !["stopped", "failed"].includes(finalJobCheck.status)) {
          await ScrapeJob.findByIdAndUpdate(jobId, { status: "completed", progress: 100, completed_at: new Date() });
        }
        await appendLog(`✅ Hoàn thành Step ${i + 1}. Thu được ${result.posts.length} bài viết.`);
        stepSuccess = true;
      } catch (err) {
        await ScrapeJob.findByIdAndUpdate(jobId, { status: "failed", error_message: err.message });
        await appendLog(`❌ Không thể hoàn thành Step ${i + 1}. Lỗi: ${err.message}`);
        // If a step fails completely, we break out of the script steps
        break;
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
