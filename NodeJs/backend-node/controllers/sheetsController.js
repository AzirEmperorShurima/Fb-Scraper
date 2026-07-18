import { google } from "googleapis";
import { User, ScrapedPost, ScrapeJob, ScriptExecution } from "../models/index.js";

export const syncSheets = async (req, res) => {
  try {
    const { posts, group_url } = req.body;
    if (!posts || posts.length === 0) {
      return res.status(400).json({ detail: "Không có dữ liệu bài viết để đồng bộ." });
    }

    if (!req.body.access_token) {
       return res.status(400).json({ detail: "Không có access_token của Google." });
    }
    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token: req.body.access_token });
    const sheets = google.sheets({ version: "v4", auth: authClient });

    const spreadsheet = await sheets.spreadsheets.create({
      resource: {
        properties: {
          title: `FBScraper Sync - ${new Date().toLocaleString()}`,
        },
      },
    });
    const spreadsheetId = spreadsheet.data.spreadsheetId;
    const spreadsheetUrl = spreadsheet.data.spreadsheetUrl;

    const values = [
      ["Source URL", "Post ID", "Post URL", "Author Name", "Author URL", "Content", "Image Count", "Reactions", "Comments", "Scraped At"]
    ];
    for (const p of posts) {
      values.push([
        group_url, p.post_id, p.post_url, p.author_name, p.author_url, p.content, p.image_count, p.reactions, p.comments, p.scraped_at
      ]);
    }

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
};

export const syncJob = async (req, res) => {
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
};

export const syncExecution = async (req, res) => {
  try {
    const executionId = req.params.id;
    const { access_token } = req.body;
    
    const exec = await ScriptExecution.findById(executionId).populate("script_id", "name");
    if (!exec) return res.status(404).json({ detail: "Execution not found" });

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
};

export const deleteSheet = async (req, res) => {
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

    await ScrapeJob.updateMany(
      { spreadsheet_url: { $regex: sheetId } }, 
      { $set: { spreadsheet_url: null } }
    );

    res.json({ message: "Đã xóa Google Sheet thành công." });
  } catch (error) {
    console.error("Error deleting Google Sheet:", error);
    res.status(500).json({ detail: "Lỗi khi xóa Google Sheet (có thể do thiếu quyền)." });
  }
};
