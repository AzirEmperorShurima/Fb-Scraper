import { ScrapeJob, ScrapedPost, FBAccount } from "../models/index.js";

export const getDashboardStats = async (req, res) => {
  try {
    // Basic Counts
    const totalJobs = await ScrapeJob.countDocuments();
    const activeJobs = await ScrapeJob.countDocuments({ status: { $in: ["running", "pending"] } });
    
    const accounts = await FBAccount.find({});
    const totalAccounts = accounts.length;
    const validAccounts = accounts.filter(a => a.status === 'valid').length;

    // Aggregate posts over the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Aggregate by day
    const postsByDay = await ScrapedPost.aggregate([
      {
        $match: {
          timestamp: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Format for Recharts
    const chartData = postsByDay.map(item => ({
      date: item._id,
      posts: item.count
    }));

    // Jobs status distribution for pie chart
    const jobsByStatus = await ScrapeJob.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);
    const jobStatusData = jobsByStatus.map(item => ({
      name: item._id,
      value: item.count
    }));

    res.json({
      totalJobs,
      activeJobs,
      totalAccounts,
      validAccounts,
      postsTimeline: chartData,
      jobStatusDistribution: jobStatusData,
      accountsList: accounts // Send raw accounts for the performance table
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
};
