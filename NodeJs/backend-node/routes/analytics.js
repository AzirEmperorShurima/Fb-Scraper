import express from "express";
import { ScrapeJob, ScrapedPost } from "../database.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken);

const STOPWORDS = new Set([
  // English
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "about", 
  "as", "from", "that", "this", "these", "those", "it", "its", "they", "them", "their", "we", "us", 
  "you", "your", "he", "him", "his", "she", "her", "is", "are", "was", "were", "be", "been", "have", 
  "has", "had", "do", "does", "did", "not", "no", "yes", "can", "will", "would", "should", "just", 
  // Vietnamese
  "và", "của", "cho", "để", "có", "trong", "là", "các", "những", "một", "hai", "này", "được", "bị", 
  "ra", "vào", "lên", "xuống", "đi", "đến", "với", "từ", "ở", "tại", "như", "nhiều", "ít", "đang", 
  "đã", "sẽ", "cũng", "đều", "hơn", "khi", "nào", "gì", "ai", "đâu", "thì", "mà", "nhưng"
]);

router.get("/:id/analytics", async (req, res) => {
  const jobId = req.params.id;

  try {
    const job = await ScrapeJob.findById(jobId);
    if (!job) {
      return res.status(404).json({ detail: "Job profile not found" });
    }
    if (job.user_id.toString() !== req.user.id) {
      return res.status(403).json({ detail: "Not authorized to view analytics for this job" });
    }

    const posts = await ScrapedPost.find({ job_id: jobId });
    
    if (posts.length === 0) {
      return res.json({
        total_posts: 0,
        total_comments: 0,
        total_reactions: 0,
        reactions_breakdown: { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
        engagement_over_time: [],
        top_authors: [],
        word_cloud: []
      });
    }

    let totalComments = 0;
    let totalReactions = 0;
    const reactionsBreakdown = { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 };
    
    const authorCounts = {};
    const overTimeData = {};
    const wordsList = [];

    posts.forEach(p => {
      totalComments += p.comments_count;
      
      const reacts = p.reactions_json || {};
      totalReactions += reacts.total || 0;
      
      Object.keys(reactionsBreakdown).forEach(k => {
        reactionsBreakdown[k] += reacts[k] || 0;
      });

      if (p.author_name) {
        authorCounts[p.author_name] = (authorCounts[p.author_name] || 0) + 1;
      }

      if (p.timestamp) {
        const dateStr = p.timestamp.toISOString().substring(0, 10);
        if (!overTimeData[dateStr]) {
          overTimeData[dateStr] = { posts_count: 0, reactions_count: 0, comments_count: 0 };
        }
        overTimeData[dateStr].posts_count += 1;
        overTimeData[dateStr].reactions_count += reacts.total || 0;
        overTimeData[dateStr].comments_count += p.comments_count;
      }

      if (p.text) {
        const words = p.text.toLowerCase()
          .replace(/[^\w\s]/g, "")
          .split(/\s+/)
          .filter(w => w.length > 1 && !STOPWORDS.has(w));
        wordsList.push(...words);
      }
    });

    const engagementOverTime = Object.keys(overTimeData).sort().map(dStr => ({
      date: dStr,
      posts_count: overTimeData[dStr].posts_count,
      reactions_count: overTimeData[dStr].reactions_count,
      comments_count: overTimeData[dStr].comments_count
    }));

    const topAuthors = Object.entries(authorCounts)
      .map(([name, count]) => ({ author_name: name, posts_count: count }))
      .sort((a, b) => b.posts_count - a.posts_count)
      .slice(0, 10);

    const wordCounts = {};
    wordsList.forEach(w => {
      wordCounts[w] = (wordCounts[w] || 0) + 1;
    });

    const wordCloud = Object.entries(wordCounts)
      .map(([text, value]) => ({ text, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 50);

    res.json({
      total_posts: posts.length,
      total_comments: totalComments,
      total_reactions: totalReactions,
      reactions_breakdown: reactionsBreakdown,
      engagement_over_time: engagementOverTime,
      top_authors: topAuthors,
      word_cloud: wordCloud
    });
  } catch (err) {
    console.error("Analytics error in Node.js:", err);
    res.status(500).json({ detail: "Internal server error" });
  }
});

export default router;
