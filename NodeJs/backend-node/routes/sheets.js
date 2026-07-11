import express from "express";
import { google } from "googleapis";
import jwt from "jsonwebtoken";
import { User, ScrapedPost } from "../database.js";

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY || "super-secret-development-key-change-in-production";

// Middleware to authenticate JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

router.post("/sync", authenticateToken, async (req, res) => {
  try {
    const { posts, group_url } = req.body;
    if (!posts || posts.length === 0) {
      return res.status(400).json({ detail: "Không có dữ liệu bài viết để đồng bộ." });
    }

    // 2. No need to share if we use access_token directly, but this route is currently not used for jobs. We'll leave it as is or require access_token.
    // For now, let's just use the access_token if provided.
    if (!req.body.access_token) {
       return res.status(400).json({ detail: "Không có access_token của Google." });
    }
    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token: req.body.access_token });
    const sheets = google.sheets({ version: "v4", auth: authClient });

    // 1. Create a new Spreadsheet
    const spreadsheet = await sheets.spreadsheets.create({
      resource: {
        properties: {
          title: `FBScraper Sync - ${new Date().toLocaleString()}`,
        },
      },
    });
    const spreadsheetId = spreadsheet.data.spreadsheetId;
    const spreadsheetUrl = spreadsheet.data.spreadsheetUrl;

    // 3. Prepare data
    const values = [
      ["Source URL", "Post ID", "Post URL", "Author Name", "Author URL", "Content", "Image Count", "Reactions", "Comments", "Scraped At"]
    ];
    for (const p of posts) {
      values.push([
        group_url, p.post_id, p.post_url, p.author_name, p.author_url, p.content, p.image_count, p.reactions, p.comments, p.scraped_at
      ]);
    }

    // 4. Write data to the Spreadsheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Sheet1!A1",
      valueInputOption: "USER_ENTERED",
      resource: {
        values,
      },
    });

    res.json({
      detail: "Đồng bộ thành công",
      spreadsheetId,
      spreadsheetUrl
    });

  } catch (error) {
    console.error("Sheets Sync Error:", error);
    res.status(500).json({ detail: "Lỗi khi đồng bộ lên Google Sheets qua API" });
  }
});

import { ScrapeJob } from "../database.js";

router.post("/sync-job/:id", authenticateToken, async (req, res) => {
  try {
    const jobId = req.params.id;
    const { access_token } = req.body;
    const job = await ScrapeJob.findById(jobId);
    if (!job) return res.status(404).json({ detail: "Job not found" });

    const postsDb = await ScrapedPost.find({ job_id: jobId }).sort({ _id: 1 });
    if (postsDb.length === 0) return res.status(400).json({ detail: "Không có dữ liệu bài viết để đồng bộ." });

    let spreadsheetId, spreadsheetUrl;
    let authClient;

    try {
      if (!access_token) {
        return res.status(400).json({ detail: "Vui lòng kết nối tài khoản Google trong phần Cài đặt trước khi đồng bộ." });
      }
      
      authClient = new google.auth.OAuth2();
      authClient.setCredentials({ access_token });

      const sheets = google.sheets({ version: "v4", auth: authClient });

      const spreadsheet = await sheets.spreadsheets.create({
        resource: { properties: { title: `FBScraper Job ${jobId} - ${new Date().toLocaleString()}` } }
      });
      spreadsheetId = spreadsheet.data.spreadsheetId;
      spreadsheetUrl = spreadsheet.data.spreadsheetUrl;

      const firstSheetName = spreadsheet.data.sheets[0].properties.title;

      const values = [["Trạng thái", "Group Name", "Group URL", "Post ID", "Author Name", "Author URL", "Post URL", "Avatar Link", "Content", "Scraped At", "Reactions"]];
      for (const p of postsDb) {
        const statusStr = p.is_deleted ? "❌ Đã xóa" : "✅ Tồn tại";
        values.push([
          statusStr,
          job.group_name || job.group_url,
          job.group_url, 
          p.post_id, 
          p.author_name, 
          p.author_url || "",
          p.post_url || "",
          p.author_avatar_url || "",
          p.text, 
          p.timestamp ? p.timestamp.toISOString() : "", 
          JSON.stringify(p.reactions_json)
        ]);
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId, range: `'${firstSheetName}'!A1`, valueInputOption: "USER_ENTERED", resource: { values }
      });
    } catch (err) {
      console.error("Google API execution failed:", err.message);
      return res.status(400).json({ detail: "Google Sheets Error: " + err.message });
    }

    job.spreadsheet_url = spreadsheetUrl;
    await job.save();

    res.json({ detail: "Đồng bộ thành công", spreadsheetId, spreadsheetUrl });

  } catch (error) {
    console.error("Sheets Sync Job Error:", error);
    res.status(500).json({ detail: "Lỗi khi đồng bộ lên Google Sheets qua API" });
  }
});

router.post("/sync-execution/:id", authenticateToken, async (req, res) => {
  try {
    const executionId = req.params.id;
    const { access_token } = req.body;
    
    // Check execution
    const mongoose = (await import("mongoose")).default;
    const { ScriptExecution } = await import("../database.js");
    const exec = await ScriptExecution.findById(executionId).populate("script_id", "name");
    if (!exec) return res.status(404).json({ detail: "Execution not found" });

    // Fetch jobs for this execution
    const jobs = await ScrapeJob.find({ execution_id: executionId });
    const jobIds = jobs.map(j => j._id);

    const postsDb = await ScrapedPost.find({ job_id: { $in: jobIds } }).sort({ _id: 1 });
    if (postsDb.length === 0) return res.status(400).json({ detail: "Không có dữ liệu bài viết để đồng bộ." });

    let spreadsheetId, spreadsheetUrl;
    let authClient;

    try {
      if (!access_token) {
        return res.status(400).json({ detail: "Vui lòng kết nối tài khoản Google trong phần Cài đặt trước khi đồng bộ." });
      }
      
      authClient = new google.auth.OAuth2();
      authClient.setCredentials({ access_token });

      const sheets = google.sheets({ version: "v4", auth: authClient });
      const scriptName = exec.script_id ? exec.script_id.name : "Campaign";
      const spreadsheet = await sheets.spreadsheets.create({
        resource: { properties: { title: `FBScraper Campaign: ${scriptName} - ${new Date().toLocaleString()}` } }
      });
      spreadsheetId = spreadsheet.data.spreadsheetId;
      spreadsheetUrl = spreadsheet.data.spreadsheetUrl;

      const firstSheetName = spreadsheet.data.sheets[0].properties.title;

      const values = [["Trạng thái", "Group Name", "Group URL", "Post ID", "Author Name", "Author URL", "Post URL", "Avatar Link", "Content", "Scraped At", "Reactions"]];
      for (const p of postsDb) {
        // Find which job this post belongs to, to get group info
        const parentJob = jobs.find(j => j._id === p.job_id);
        const statusStr = p.is_deleted ? "❌ Đã xóa" : "✅ Tồn tại";
        values.push([
          statusStr,
          parentJob ? (parentJob.group_name || parentJob.group_url) : "",
          parentJob ? parentJob.group_url : "", 
          p.post_id, 
          p.author_name, 
          p.author_url || "",
          p.post_url || "",
          p.author_avatar_url || "",
          p.text, 
          p.timestamp ? p.timestamp.toISOString() : "", 
          JSON.stringify(p.reactions_json)
        ]);
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId, range: `'${firstSheetName}'!A1`, valueInputOption: "USER_ENTERED", resource: { values }
      });
    } catch (err) {
      console.error("Google API execution failed:", err.message);
      return res.status(400).json({ detail: "Google Sheets Error: " + err.message });
    }

    exec.spreadsheet_url = spreadsheetUrl;
    await exec.save();

    res.json({ detail: "Đồng bộ thành công", spreadsheetId, spreadsheetUrl });

  } catch (error) {
    console.error("Sheets Sync Execution Error:", error);
    res.status(500).json({ detail: "Lỗi khi đồng bộ lên Google Sheets qua API" });
  }
});

router.delete("/sheet/:sheetId", authenticateToken, async (req, res) => {
  try {
    const sheetId = req.params.sheetId;
    const { access_token } = req.body;
    
    if (!access_token) {
      return res.status(400).json({ detail: "Vui lòng đăng nhập Google để xóa Sheet." });
    }

    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token });
    const drive = google.drive({ version: "v3", auth: authClient });

    await drive.files.delete({ fileId: sheetId });

    // Try to update any job that might be linked to this sheet
    // We just find a job that has this spreadsheetUrl
    const urlMatches = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
    await ScrapeJob.updateMany(
      { spreadsheet_url: { $regex: sheetId } }, 
      { $set: { spreadsheet_url: null } }
    );

    res.json({ message: "Đã xóa Google Sheet thành công." });
  } catch (error) {
    console.error("Error deleting Google Sheet:", error);
    res.status(500).json({ detail: "Lỗi khi xóa Google Sheet (có thể do thiếu quyền)." });
  }
});

export default router;
