import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../utils/api";
import { 
  Play, 
  Activity, 
  Layers, 
  Users, 
  TrendingUp,
  ArrowRight
} from "lucide-react";

interface Job {
  id: string;
  group_url: string;
  status: string;
  max_posts: number;
  progress: number;
  created_at: string;
  error_message?: string;
}

interface FBAccount {
  id: number;
  email: string;
  status: string;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [groupUrl, setGroupUrl] = useState("");
  const [maxPosts, setMaxPosts] = useState(50);
  const [includeComments, setIncludeComments] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [sinceDate, setSinceDate] = useState("");
  const [untilDate, setUntilDate] = useState("");
  const [keywordFilter, setKeywordFilter] = useState("");
  const [minReactions, setMinReactions] = useState(0);
  
  const [accounts, setAccounts] = useState<FBAccount[]>([]);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      const [jobsRes, accountsRes] = await Promise.all([
        api.get("/api/jobs?limit=5"),
        api.get("/api/config/fb-accounts")
      ]);
      setRecentJobs(jobsRes.data);
      setAccounts(accountsRes.data);
      if (accountsRes.data.length > 0) {
        setSelectedAccount(accountsRes.data[0].id.toString());
      }
    } catch (err) {
      console.error("Error fetching dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupUrl) return;
    setError("");
    setLaunching(true);

    try {
      const payload = {
        group_url: groupUrl,
        max_posts: maxPosts,
        include_comments: includeComments,
        fb_account_id: selectedAccount ? parseInt(selectedAccount) : undefined,
        since_date: sinceDate || undefined,
        until_date: untilDate || undefined,
        keyword_filter: keywordFilter || undefined,
        min_reactions: minReactions || 0
      };
      const response = await api.post("/api/jobs", payload);
      const newJob = response.data;
      navigate(`/jobs/${newJob.id}`);
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.detail || 
        "Failed to launch job. Please verify your settings and account setup."
      );
    } finally {
      setLaunching(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const base = "px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 w-fit";
    switch (status) {
      case "pending": return `${base} bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30`;
      case "running": return `${base} bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30`;
      case "completed": return `${base} bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30`;
      case "failed": return `${base} bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30`;
      case "stopped": return `${base} bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700`;
      default: return `${base} bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400`;
    }
  };

  // Compute stat totals
  const totalJobsCount = recentJobs.length > 0 ? recentJobs.length : 0; // Simple fallback calculation
  const activeJobsCount = recentJobs.filter(j => j.status === "running" || j.status === "pending").length;
  const activeAccountsCount = accounts.filter(a => a.status === "valid").length;

  return (
    <div className="space-y-10">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Dashboard Overview</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Monitor scraping operations, check active runners, and compile reports.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-2xl flex items-center gap-5">
          <div className="p-4 bg-violet-600/10 rounded-xl text-violet-600 dark:text-violet-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total Scrapes</p>
            <h3 className="text-2xl font-bold mt-1">{totalJobsCount}</h3>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl flex items-center gap-5">
          <div className="p-4 bg-blue-600/10 rounded-xl text-blue-600 dark:text-blue-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Active Jobs</p>
            <h3 className="text-2xl font-bold mt-1">{activeJobsCount}</h3>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl flex items-center gap-5">
          <div className="p-4 bg-emerald-600/10 rounded-xl text-emerald-600 dark:text-emerald-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">FB Accounts</p>
            <h3 className="text-2xl font-bold mt-1">{activeAccountsCount}/{accounts.length}</h3>
          </div>
        </div>
      </div>

      {/* Main split section */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Launch New Job Card (3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/40 shadow-xl shadow-slate-100/50 dark:shadow-none rounded-2xl p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            <h2 className="text-xl font-bold">Quick Start Scraper</h2>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-600 dark:text-rose-400 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLaunch} className="space-y-6">
            <div>
              <label className="block text-sm font-bold mb-2">Facebook Group URL</label>
              <input
                type="url"
                required
                value={groupUrl}
                onChange={(e) => setGroupUrl(e.target.value)}
                placeholder="https://www.facebook.com/groups/your-group-name"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-transparent focus:ring-2 focus:ring-violet-600 dark:focus:ring-violet-500 focus:border-transparent outline-none transition text-sm"
              />
              <span className="text-xs text-slate-400 mt-1.5 block">
                Supports public groups. For private groups, make sure valid cookies are saved in Settings.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold mb-2">Max Posts to Scrape</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={maxPosts}
                  onChange={(e) => setMaxPosts(parseInt(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-transparent focus:ring-2 focus:ring-violet-600 dark:focus:ring-violet-500 focus:border-transparent outline-none transition text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Facebook Account Session</label>
                {accounts.length === 0 ? (
                  <div className="py-3 px-4 bg-slate-50 dark:bg-slate-850 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-400 flex items-center justify-between">
                    <span>No accounts found</span>
                    <Link to="/settings" className="text-violet-600 hover:underline font-semibold">Add one</Link>
                  </div>
                ) : (
                  <select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-violet-600 dark:focus:ring-violet-500 focus:border-transparent outline-none transition text-sm"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.email} ({acc.status})</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Advanced Filters */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-6">
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Advanced Filters</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold mb-2">Since Date (Từ ngày)</label>
                  <input
                    type="date"
                    value={sinceDate}
                    onChange={(e) => setSinceDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-transparent focus:ring-2 focus:ring-violet-600 dark:focus:ring-violet-500 focus:border-transparent outline-none transition text-sm text-slate-600 dark:text-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Until Date (Đến ngày)</label>
                  <input
                    type="date"
                    value={untilDate}
                    onChange={(e) => setUntilDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-transparent focus:ring-2 focus:ring-violet-600 dark:focus:ring-violet-500 focus:border-transparent outline-none transition text-sm text-slate-600 dark:text-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold mb-2">Keyword Filter (Lọc từ khóa)</label>
                  <input
                    type="text"
                    value={keywordFilter}
                    onChange={(e) => setKeywordFilter(e.target.value)}
                    placeholder="e.g. Python, AI, Off..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-transparent focus:ring-2 focus:ring-violet-600 dark:focus:ring-violet-500 focus:border-transparent outline-none transition text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Min Reactions (Tương tác tối thiểu)</label>
                  <input
                    type="number"
                    min={0}
                    value={minReactions}
                    onChange={(e) => setMinReactions(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-transparent focus:ring-2 focus:ring-violet-600 dark:focus:ring-violet-500 focus:border-transparent outline-none transition text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-slate-100 dark:border-slate-800 pt-6">
              <input
                id="comments"
                type="checkbox"
                checked={includeComments}
                onChange={(e) => setIncludeComments(e.target.checked)}
                className="w-4.5 h-4.5 rounded border-slate-300 dark:border-slate-800 text-violet-600 focus:ring-violet-500 focus:ring-offset-0"
              />
              <label htmlFor="comments" className="text-sm font-semibold select-none cursor-pointer">
                Scrape comments (may increase scraping execution time)
              </label>
            </div>

            <button
              type="submit"
              disabled={launching || accounts.length === 0}
              className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/25 dark:shadow-indigo-500/10 hover:shadow-indigo-500/35 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Play className="w-5 h-5 fill-current" />
              Launch Scraper Task
            </button>
          </form>
        </div>

        {/* Recent Jobs List (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/40 shadow-xl shadow-slate-100/50 dark:shadow-none rounded-2xl p-6 flex flex-col justify-between">
          <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Activity className="w-6 h-6 text-violet-600" />
              Recent Jobs
            </h2>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : recentJobs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
                No recent scrapers launched yet.
              </div>
            ) : (
              <div className="space-y-4">
                {recentJobs.map(job => (
                  <Link 
                    key={job.id} 
                    to={`/jobs/${job.id}`}
                    className="block p-4 border border-slate-150 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs text-slate-400 truncate max-w-[150px]" title={job.group_url}>
                        {job.group_url.replace("https://www.facebook.com/groups/", "")}
                      </span>
                      {getStatusBadge(job.status)}
                    </div>
                    
                    {job.status === "running" && (
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                        <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${job.progress}%` }} />
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center text-xs text-slate-400 mt-2 font-medium">
                      <span>Limit: {job.max_posts} posts</span>
                      <span>{new Date(job.created_at).toLocaleDateString()}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {recentJobs.length > 0 && (
            <Link 
              to="/jobs" 
              className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline"
            >
              See all jobs
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
