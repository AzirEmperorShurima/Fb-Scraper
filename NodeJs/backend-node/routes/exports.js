import express from "express";
import XLSX from "xlsx";
import PDFDocument from "pdfkit";
import { ScrapeJob, ScrapedPost, ScriptExecution } from "../database.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken);

router.get("/:id/export", async (req, res) => {
  const targetId = req.params.id;
  const format = req.query.format || "xlsx";

  try {
    let job = await ScrapeJob.findById(targetId);
    let isExecution = false;
    if (!job) {
      job = await ScriptExecution.findById(targetId);
      isExecution = true;
    }
    
    if (!job) {
      return res.status(404).json({ detail: "Job or Execution profile not found" });
    }
    if (job.user_id.toString() !== (req.user.id || req.user.user_id)) {
      return res.status(403).json({ detail: "Not authorized to export data" });
    }

    let posts = [];
    if (isExecution) {
      const subJobs = await ScrapeJob.find({ execution_id: targetId });
      const jobIds = subJobs.map(j => j._id);
      posts = await ScrapedPost.find({ job_id: { $in: jobIds } }).sort({ _id: 1 });
    } else {
      posts = await ScrapedPost.find({ job_id: targetId }).sort({ _id: 1 });
    }
    if (posts.length === 0) {
      return res.status(400).json({ detail: "No scraped posts found for this job to export" });
    }

    const rows = posts.map(p => {
      const reactions = p.reactions_json || {};
      const attachments = p.attachments_json || [];
      return {
        "Post ID": p.post_id,
        "Author Name": p.author_name || "",
        "Author URL": p.author_url || "",
        "Post URL": p.post_url || "",
        "Text Content": p.text || "",
        "Timestamp": p.timestamp ? p.timestamp.toISOString() : "",
        "Comments Count": p.comments_count,
        "Reactions Total": reactions.total || 0,
        "Likes": reactions.like || 0,
        "Love": reactions.love || 0,
        "Haha": reactions.haha || 0,
        "Wow": reactions.wow || 0,
        "Sad": reactions.sad || 0,
        "Angry": reactions.angry || 0,
        "Attachments": attachments.join(", ")
      };
    });

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename=job_${jobId}_export.json`);
      return res.send(JSON.stringify(rows, null, 2));
    }

    if (format === "csv") {
      const headers = Object.keys(rows[0]);
      let csvContent = headers.join(",") + "\n";
      rows.forEach(row => {
        const line = headers.map(header => {
          const val = row[header] !== undefined ? String(row[header]) : "";
          return `"${val.replace(/"/g, '""')}"`;
        }).join(",");
        csvContent += line + "\n";
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=job_${jobId}_export.csv`);
      return res.send(csvContent);
    }

    if (format === "xlsx") {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Scraped Posts");
      
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=job_${jobId}_export.xlsx`);
      return res.send(buffer);
    }

    if (format === "md") {
      let mdContent = `# Scrape Report for Group: ${job.group_url}\n`;
      mdContent += `- **Job ID**: ${jobId}\n`;
      mdContent += `- **Scraped At**: ${job.completed_at || job.created_at}\n`;
      mdContent += `- **Total Posts**: ${posts.length}\n\n`;
      mdContent += "---\n\n";

      rows.forEach((r, idx) => {
        mdContent += `### ${idx + 1}. Post by **${r["Author Name"]}** (${r["Timestamp"]})\n`;
        mdContent += `- **Post URL**: ${r["Post URL"]}\n`;
        mdContent += `- **Engagement**: ${r["Reactions Total"]} Reactions, ${r["Comments Count"]} Comments\n`;
        if (r["Attachments"]) {
          mdContent += `- **Attachments**: ${r["Attachments"]}\n`;
        }
        mdContent += `\n**Content**:\n${r["Text Content"]}\n\n`;
        mdContent += "---\n\n";
      });

      res.setHeader("Content-Type", "text/markdown");
      res.setHeader("Content-Disposition", `attachment; filename=job_${jobId}_export.md`);
      return res.send(mdContent);
    }

    if (format === "pdf") {
      const doc = new PDFDocument();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=job_${jobId}_export.pdf`);
      
      doc.pipe(res);

      doc.fontSize(18).text("FBGroupScraper Pro Report (Node.js)", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Group: ${job.group_url}`);
      doc.text(`Job ID: ${jobId}`);
      doc.text(`Total Posts Scraped: ${posts.length}`);
      doc.moveDown(1.5);

      rows.forEach((r, idx) => {
        if (idx > 0) {
          doc.moveDown(1);
          doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
          doc.moveDown(1);
        }

        doc.fontSize(12).font("Helvetica-Bold").text(`${idx + 1}. Post by ${r["Author Name"]} - ${r["Timestamp"]}`);
        doc.fontSize(9).font("Helvetica-Oblique").text(`Reactions: ${r["Reactions Total"]} | Comments: ${r["Comments Count"]}`);
        doc.moveDown(0.5);
        
        let textContent = r["Text Content"];
        if (textContent.length > 350) {
          textContent = textContent.substring(0, 350) + "...";
        }
        doc.fontSize(10).font("Helvetica").text(textContent, { width: 500, align: "left" });
      });

      doc.end();
      return;
    }

    res.status(400).json({ detail: "Unsupported export format" });
  } catch (err) {
    console.error("Export error in Node.js:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
