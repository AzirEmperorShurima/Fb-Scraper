import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../utils/api";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  ArrowLeft,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Search,
  FileText,
  BarChart2,
  MessageSquare,
  Heart,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ExternalLink
} from "lucide-react";
import { useGoogleLogin } from '@react-oauth/google';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from "recharts";

interface Post {
  id: number;
  post_id: string;
  author_name: string;
  author_url: string;
  author_avatar_url?: string;
  post_url?: string;
  is_deleted?: boolean;
  text: string;
  timestamp: string;
  reactions_json: {
    total: number;
    like: number;
    love: number;
    haha: number;
    wow: number;
    sad: number;
    angry: number;
  };
  comments_count: number;
  attachments_json: string[];
  created_at?: string;
}

interface Job {
  id: string;
  group_url: string;
  status: string;
  version?: number;
  max_posts: number;
  progress: number;
  created_at: string;
  completed_at?: string;
  error_message?: string;
  logs?: string;
  spreadsheet_url?: string;
  group_name?: string;
}

interface AnalyticsData {
  total_posts: number;
  total_comments: number;
  total_reactions: number;
  reactions_breakdown: Record<string, number>;
  engagement_over_time: Array<{
    date: string;
    posts_count: number;
    reactions_count: number;
    comments_count: number;
  }>;
  top_authors: Array<{
    author_name: string;
    posts_count: number;
  }>;
  word_cloud: Array<{
    text: string;
    value: number;
  }>;
}

export const JobDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [job, setJob] = useState<Job | null>(null);
  const [activeTab, setActiveTab] = useState<"results" | "analytics">("results");
  const [loading, setLoading] = useState(true);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      if (!id) return;
      try {
        const res = await api.post(`/api/sheets/sync-job/${id}`, {
          access_token: tokenResponse.access_token
        });
        if (res.data && res.data.detail) {
          alert(res.data.detail);
        }
        fetchJobDetails();
      } catch (err: any) {
        alert(err.response?.data?.detail || "Failed to sync to Google Sheets.");
      } finally {
        setIsSyncing(false);
      }
    },
    onError: () => {
      alert("Cấp quyền Google Drive thất bại.");
      setIsSyncing(false);
    },
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
  });

  const [isDeletingSheet, setIsDeletingSheet] = useState(false);
  const googleLoginDeleteSheet = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      if (!id || !job?.spreadsheet_url) return;
      const sheetIdMatch = job.spreadsheet_url.match(/d\/([a-zA-Z0-9-_]+)/);
      if (!sheetIdMatch || !sheetIdMatch[1]) {
         alert("Không thể trích xuất Google Sheet ID.");
         setIsDeletingSheet(false);
         return;
      }
      const sheetId = sheetIdMatch[1];
      try {
        const res = await api.delete(`/api/sheets/sheet/${sheetId}`, {
          data: { access_token: tokenResponse.access_token }
        });
        if (res.data && res.data.message) {
          alert(res.data.message);
        }
        fetchJobDetails();
      } catch (err: any) {
        alert(err.response?.data?.detail || "Failed to delete Google Sheet.");
      } finally {
        setIsDeletingSheet(false);
      }
    },
    onError: () => {
      alert("Cấp quyền Google Drive thất bại.");
      setIsDeletingSheet(false);
    },
    scope: "https://www.googleapis.com/auth/drive.file",
  });

  // Results pagination & search
  const [posts, setPosts] = useState<Post[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [postsLoading, setPostsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState("scraped_asc");

  // Auto-scroll logs console
  const logEndRef = useRef<HTMLPreElement | null>(null);
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [job?.logs]);

  // Analytics
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const fetchJobDetails = useCallback(async () => {
    if (!id) return;
    try {
      const response = await api.get(`/api/jobs/${id}`);
      setJob(response.data);
      if (selectedVersion === null && response.data.version) {
        setSelectedVersion(response.data.version);
      }
    } catch (err) {
      console.error("Error fetching job details", err);
    } finally {
      setLoading(false);
    }
  }, [id, selectedVersion]);

  const fetchPosts = useCallback(async () => {
    if (!id) return;
    setPostsLoading(true);
    try {
      const response = await api.get(`/api/jobs/${id}/posts`, {
        params: { page, size: pageSize, search, version: selectedVersion || job?.version || 1, sortBy }
      });
      setPosts(response.data.posts);
      setTotalPosts(response.data.total);
    } catch (err) {
      console.error("Error fetching job posts", err);
    } finally {
      setPostsLoading(false);
    }
  }, [id, page, pageSize, search, selectedVersion, job?.version, sortBy]);

  const fetchAnalytics = useCallback(async () => {
    if (!id) return;
    setAnalyticsLoading(true);
    try {
      const response = await api.get(`/api/jobs/${id}/analytics`);
      setAnalytics(response.data);
    } catch (err) {
      console.error("Error fetching job analytics", err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [id]);

  // Initial fetch
  useEffect(() => {
    fetchJobDetails();
  }, [fetchJobDetails]);

  // Fetch posts when page or search queries change
  useEffect(() => {
    if (activeTab === "results") {
      fetchPosts();
    }
  }, [fetchPosts, activeTab]);

  // Fetch analytics when analytics tab is activated
  useEffect(() => {
    if (activeTab === "analytics") {
      fetchAnalytics();
    }
  }, [fetchAnalytics, activeTab]);

  // Handle WebSocket progress stream
  const handleProgressMessage = useCallback((data: any) => {
    console.log("WebSocket progress update:", data);
    setJob(prevJob => {
      if (!prevJob) return null;
      return {
        ...prevJob,
        status: data.status,
        progress: data.progress,
        error_message: data.error_message,
        completed_at: data.completed_at,
        logs: data.logs
      };
    });

    // Refresh posts if the job finishes or is scraping in progress
    if (activeTab === "results") {
      fetchPosts();
    }
  }, [activeTab, fetchPosts]);

  // Connect to WS progress if job is active
  const isJobActive = job?.status === "running" || job?.status === "pending";
  useWebSocket(isJobActive ? id || null : null, handleProgressMessage);

  const handleDownload = (format: string) => {
    if (!id) return;
    api.get(`/api/jobs/${id}/export?format=${format}`, { responseType: "blob" })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `job_${id}_export.${format}`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      })
      .catch((err) => {
        console.error("Export download failed", err);
        alert("Export failed. Make sure posts have been scraped first.");
      });
  };

  const getStatusBadge = (status: string) => {
    const base = "px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 w-fit";
    switch (status) {
      case "pending":
        return <span className={`${base} bg-warning/10 text-warning border border-warning/30`}><Clock className="w-4 h-4" /> Pending</span>;
      case "running":
        return <span className={`${base} bg-info/10 text-info border border-info/30`}><Activity className="w-4 h-4 animate-spin" /> Running</span>;
      case "completed":
        return <span className={`${base} bg-success/10 text-success border border-success/30`}><CheckCircle2 className="w-4 h-4" /> Completed</span>;
      case "failed":
        return <span className={`${base} bg-destructive/10 text-destructive border border-destructive/30`}><XCircle className="w-4 h-4" /> Failed</span>;
      case "stopped":
        return <span className={`${base} bg-muted text-muted-foreground border border-border`}><AlertCircle className="w-4 h-4" /> Stopped</span>;
      default:
        return <span className={`${base} bg-muted text-slate-500`}>Unknown</span>;
    }
  };

  if (loading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm font-medium">Retrieving job profile...</span>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-20">
        <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-bold">Job Not Found</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">The requested scrape task ID does not exist.</p>
        <Link to="/jobs" className="mt-4 inline-flex items-center gap-2 text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Jobs
        </Link>
      </div>
    );
  }

  // Pre-calculate pie data
  const pieColors = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#64748b"];
  const pieData = analytics ? Object.entries(analytics.reactions_breakdown)
    .filter(([_, val]) => val > 0)
    .map(([key, val]) => ({ name: key.toUpperCase(), value: val }))
    : [];

  const totalPages = Math.ceil(totalPosts / pageSize);

  return (
    <div className="space-y-8">
      {/* Back button & title info */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2">
          <Link to="/jobs" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-primary transition mb-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Directory
          </Link>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight truncate max-w-xl" title={job.group_name || job.group_url}>
            Group: {job.group_name || job.group_url}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-mono text-slate-400">{job.id}</span>
            <span className="text-slate-300 dark:text-slate-800">|</span>
            {getStatusBadge(job.status)}
            {isJobActive && (
              <span className="text-xs font-semibold text-info animate-pulse">
                Live updates streaming
              </span>
            )}
          </div>
        </div>

        {/* Download Buttons */}
        {job.status === "completed" && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {job.spreadsheet_url ? (
              <>
                <a
                  href={job.spreadsheet_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/15 transition"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open GSheet
                </a>
                <button
                  onClick={() => {
                    if (window.confirm("Bạn có chắc chắn muốn xóa vĩnh viễn Google Sheet này không?")) {
                      setIsDeletingSheet(true);
                      setTimeout(() => googleLoginDeleteSheet(), 0);
                    }
                  }}
                  disabled={isDeletingSheet}
                  className="flex items-center gap-2 px-4 py-2.5 bg-destructive/10 hover:bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 rounded-xl text-sm font-bold transition disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  {isDeletingSheet ? "Deleting..." : "Delete Sheet"}
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setIsSyncing(true);
                  setTimeout(() => googleLogin(), 0);
                }}
                disabled={isSyncing}
                className="flex items-center gap-2 px-4 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 rounded-xl text-sm font-bold transition disabled:opacity-50"
              >
                {isSyncing ? "Syncing..." : "Sync GSheet"}
              </button>
            )}

            <button
              onClick={async () => {
                setIsVerifying(true);
                try {
                  const res = await api.post(`/api/jobs/${job.id}/verify-status`);
                  alert(res.data.message || "Đã bắt đầu kiểm tra bài viết ngầm.");
                } catch (err) {
                  alert("Lỗi khi gọi API Verify Status.");
                } finally {
                  setIsVerifying(false);
                }
              }}
              disabled={isVerifying}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-xl text-sm font-bold transition disabled:opacity-50"
            >
              {isVerifying ? "Starting..." : "Re-check Status"}
            </button>

            <button
              onClick={() => handleDownload("xlsx")}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/15 transition"
            >
              <Download className="w-4 h-4" />
              Excel
            </button>
            <button
              onClick={() => handleDownload("csv")}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/15 transition"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={() => handleDownload("md")}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-850 text-white rounded-xl text-sm font-bold shadow-lg transition"
            >
              <Download className="w-4 h-4" />
              Markdown
            </button>
          </div>
        )}
      </div>

      {/* Progress Card if running */}
      {isJobActive && (
        <div className="p-6 bg-card border border-blue-200 dark:border-blue-900/40 rounded-xl space-y-4">
          <div className="flex justify-between items-center text-sm font-bold">
            <span className="text-info flex items-center gap-2">
              <Activity className="w-4 h-4 animate-spin" />
              Scraping posts and attachments...
            </span>
            <span>{job.progress}%</span>
          </div>
          <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
            <div className="bg-info/100 h-full transition-all duration-500" style={{ width: `${job.progress}%` }} />
          </div>
          <p className="text-xs text-slate-400">
            Playwright browser is navigating and scrolling. Posts will show up below in real-time.
          </p>
        </div>
      )}

      {/* Live Console Terminal Logs */}
      {job && (isJobActive || job.logs) && (
        <div className="bg-slate-950 rounded-xl border border-slate-900 p-6 font-mono text-xs text-emerald-400 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3 text-slate-500">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-destructive/100/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-warning/100/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-success/100/80 inline-block"></span>
              <span className="ml-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Live Scraper Console</span>
            </div>
            <span className="text-[10px] font-semibold bg-slate-900 px-2.5 py-1 rounded text-emerald-400">Status: {job.status}</span>
          </div>

          <pre
            ref={logEndRef}
            className="max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed text-left pr-2 text-[11px] text-emerald-400/90 font-mono scroll-smooth"
          >
            {job.logs || "⏳ Đang kết nối tới trình duyệt ảo và chờ lệnh khởi tạo..."}
          </pre>
        </div>
      )}

      {/* Error Message alert */}
      {job.error_message && (
        <div className="p-4 bg-destructive/10 border border-rose-250 dark:border-rose-900/50 rounded-xl text-destructive text-sm font-semibold flex gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-bold">Scraper reported an error:</p>
            <p className="font-normal mt-0.5">{job.error_message}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border flex gap-6">
        <button
          onClick={() => setActiveTab("results")}
          className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition ${activeTab === "results"
              ? "border-violet-600 text-primary"
              : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
        >
          <FileText className="w-4 h-4" />
          Scraped Posts ({totalPosts})
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition ${activeTab === "analytics"
              ? "border-violet-600 text-primary"
              : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
        >
          <BarChart2 className="w-4 h-4" />
          Analytics Dashboard
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "results" ? (
        <div className="space-y-6">
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between w-full">
            <div className="flex flex-col sm:flex-row gap-4 items-center w-full max-w-2xl">
              {/* Search bar */}
              <div className="relative w-full sm:max-w-md">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Search className="w-5 h-5" />
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search post text content or authors..."
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-card focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm shadow-sm"
                />
              </div>
              
              {/* Version Selector */}
              {job.version && job.version > 1 && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Job Version:</span>
                  <select
                    value={selectedVersion || job.version}
                    onChange={(e) => { setSelectedVersion(parseInt(e.target.value)); setPage(1); }}
                    className="px-4 py-3 rounded-xl border border-border bg-card focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm shadow-sm w-full sm:w-auto"
                  >
                    {Array.from({ length: job.version }, (_, i) => i + 1).map(v => (
                      <option key={v} value={v}>Version {v}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">Sắp xếp:</span>
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                className="px-4 py-3 rounded-xl border border-border bg-card focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm shadow-sm w-full sm:w-auto min-w-[150px]"
              >
                <option value="scraped_asc">Thứ tự cào (Cũ - Mới)</option>
                <option value="scraped_desc">Thứ tự cào (Mới - Cũ)</option>
                <option value="timestamp_desc">Thời gian đăng (Gần nhất)</option>
                <option value="timestamp_asc">Thời gian đăng (Cũ nhất)</option>
                <option value="reactions_desc">Nhiều tương tác nhất</option>
                <option value="comments_desc">Nhiều bình luận nhất</option>
              </select>
            </div>
          </div>

          {/* Posts List container */}
          {postsLoading && posts.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="text-sm font-medium">Fetching posts...</span>
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-16 text-center text-slate-400 dark:text-slate-500 text-sm">
              No posts matched your criteria or scraping hasn't started saving yet.
            </div>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => (
                <div key={post.id} className="bg-card border border-slate-200/60 dark:border-slate-850 rounded-xl p-6 shadow-sm flex flex-col gap-4">
                  {/* Post author and top row */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-extrabold text-sm shadow overflow-hidden ${post.author_name === "Facebook User" ? "bg-slate-600" : "bg-gradient-to-br from-violet-600 to-indigo-600"}`}>
                        {post.author_avatar_url ? (
                          <img 
                            src={post.author_avatar_url} 
                            alt="Avatar" 
                            className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition" 
                            onClick={() => setZoomedImage(post.author_avatar_url!)}
                          />
                        ) : (
                          post.author_name === "Facebook User" ? "?" : post.author_name.charAt(0)
                        )}
                      </div>
                      <div>
                        {post.author_name === "Facebook User" ? (
                          <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                            Thành viên ẩn danh
                          </span>
                        ) : (
                          <a 
                            href={post.author_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="font-bold text-slate-800 dark:text-slate-100 hover:text-primary hover:underline flex items-center gap-1"
                          >
                            {post.author_name}
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </a>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-400 font-medium" title="Thời gian đăng">
                            Đăng lúc: {new Date(post.timestamp).toLocaleString()}
                          </span>
                          {post.created_at && (
                            <span className="text-xs text-slate-500 font-medium" title="Thời gian cào">
                              • Cào lúc: {new Date(post.created_at).toLocaleString()}
                            </span>
                          )}
                          {post.post_url && (
                            <a href={post.post_url} target="_blank" rel="noreferrer" className="text-xs text-info hover:underline">
                              View Post
                            </a>
                          )}
                          {post.is_deleted === true && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                              DELETED
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-400 font-mono">
                      ID: {post.post_id}
                    </span>
                  </div>

                  {/* Text content */}
                  <p className="text-slate-700 dark:text-slate-200 text-sm leading-relaxed whitespace-pre-line">
                    {post.text}
                  </p>

                  {/* Attachments (if any) */}
                  {post.attachments_json && post.attachments_json.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 my-2">
                      {post.attachments_json.map((src, i) => (
                        <div key={i} className="rounded-xl overflow-hidden border border-border bg-slate-50 dark:bg-slate-800 max-h-48 flex items-center justify-center cursor-pointer group">
                          <img
                            src={src}
                            alt="Attachment"
                            onClick={() => setZoomedImage(src)}
                            className="object-cover w-full h-full group-hover:scale-110 transition duration-300"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <hr className="border-slate-150 dark:border-slate-850" />

                  {/* Engagement bottom panel */}
                  <div className="flex gap-6 text-xs font-semibold text-slate-500">
                    <span className="flex items-center gap-1.5 text-destructive">
                      <Heart className="w-4 h-4 fill-current text-destructive" />
                      {post.reactions_json?.total || 0} Reactions
                    </span>
                    <span className="flex items-center gap-1.5 text-info">
                      <MessageSquare className="w-4 h-4" />
                      {post.comments_count} Comments
                    </span>
                  </div>
                </div>
              ))}

              {/* Pagination row */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center py-4">
                  <span className="text-xs text-slate-400 font-medium">
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalPosts)} of {totalPosts} posts
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg border border-border hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {[...Array(totalPages)].map((_, i) => {
                      const pNum = i + 1;
                      // Display a subset of pages if large
                      if (pNum === 1 || pNum === totalPages || Math.abs(pNum - page) <= 1) {
                        return (
                          <button
                            key={pNum}
                            onClick={() => setPage(pNum)}
                            className={`w-9 h-9 rounded-lg font-bold text-xs transition ${page === pNum
                                ? "bg-primary text-white"
                                : "border border-border hover:bg-slate-100 dark:hover:bg-slate-800"
                              }`}
                          >
                            {pNum}
                          </button>
                        );
                      }
                      if (pNum === 2 || pNum === totalPages - 1) {
                        return <span key={pNum} className="text-slate-400 px-1">...</span>;
                      }
                      return null;
                    })}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-2 rounded-lg border border-border hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Analytics Tab Content */
        <div className="space-y-8">
          {analyticsLoading && !analytics ? (
            <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="text-sm font-medium">Aggregating analytics data...</span>
            </div>
          ) : !analytics ? (
            <div className="text-center py-20 text-slate-400">
              No analytics data could be computed.
            </div>
          ) : (
            <div className="space-y-8">
              {/* Aggregated KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-xl border-l-4 border-violet-500">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Scraped Posts</p>
                  <h3 className="text-3xl font-extrabold mt-1 text-primary">{analytics.total_posts}</h3>
                </div>
                <div className="glass-card p-6 rounded-xl border-l-4 border-rose-500">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Reactions</p>
                  <h3 className="text-3xl font-extrabold mt-1 text-destructive">{analytics.total_reactions}</h3>
                </div>
                <div className="glass-card p-6 rounded-xl border-l-4 border-blue-500">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Comments</p>
                  <h3 className="text-3xl font-extrabold mt-1 text-info">{analytics.total_comments}</h3>
                </div>
              </div>

              {/* Engagement Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Volume over time */}
                <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
                  <h3 className="font-bold text-md mb-6">Posting & Engagement Timeline</h3>
                  <div className="h-72 w-full">
                    {analytics.engagement_over_time.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400">No dates recorded</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analytics.engagement_over_time}>
                          <defs>
                            <linearGradient id="colorReactions" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorComments" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                          <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                          <YAxis stroke="#94a3b8" fontSize={10} />
                          <ChartTooltip contentStyle={{ backgroundColor: "#0f172a", border: "none", borderRadius: "10px", color: "#f8fafc" }} />
                          <Legend verticalAlign="top" height={36} />
                          <Area type="monotone" dataKey="reactions_count" name="Reactions" stroke="#ef4444" fillOpacity={1} fill="url(#colorReactions)" strokeWidth={2} />
                          <Area type="monotone" dataKey="comments_count" name="Comments" stroke="#3b82f6" fillOpacity={1} fill="url(#colorComments)" strokeWidth={2} />
                          <Area type="monotone" dataKey="posts_count" name="Posts" stroke="#8b5cf6" fill="transparent" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Reactions Pie Breakdown */}
                <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
                  <h3 className="font-bold text-md mb-6">Reactions Distribution</h3>
                  <div className="h-72 w-full flex flex-col sm:flex-row items-center justify-between">
                    {pieData.length === 0 ? (
                      <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">No reactions parsed</div>
                    ) : (
                      <>
                        <div className="h-full w-full sm:w-[60%]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {pieData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                                ))}
                              </Pie>
                              <ChartTooltip contentStyle={{ backgroundColor: "#0f172a", border: "none", borderRadius: "10px", color: "#f8fafc" }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex flex-col gap-2 w-full sm:w-[40%] text-xs font-semibold px-4">
                          {pieData.map((item, index) => (
                            <div key={item.name} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: pieColors[index % pieColors.length] }} />
                                <span className="text-slate-500 dark:text-slate-400">{item.name}</span>
                              </div>
                              <span className="font-bold">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Top Active Contributors */}
                <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
                  <h3 className="font-bold text-md mb-6">Top Contributors</h3>
                  <div className="h-72 w-full">
                    {analytics.top_authors.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400">No author data</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.top_authors}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                          <XAxis dataKey="author_name" stroke="#94a3b8" fontSize={9} interval={0} tickFormatter={(val) => val.length > 10 ? val.substring(0, 10) + '...' : val} />
                          <YAxis stroke="#94a3b8" fontSize={10} allowDecimals={false} />
                          <ChartTooltip contentStyle={{ backgroundColor: "#0f172a", border: "none", borderRadius: "10px", color: "#f8fafc" }} />
                          <Bar dataKey="posts_count" name="Posts Written" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Key Frequency Words Cloud list */}
                <div className="bg-card border border-border p-6 rounded-xl shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-md mb-6">Trending Keywords</h3>
                    {analytics.word_cloud.length === 0 ? (
                      <div className="h-48 flex items-center justify-center text-xs text-slate-400">No keyword occurrences</div>
                    ) : (
                      <div className="flex flex-wrap gap-2.5 max-h-[220px] overflow-y-auto pr-2">
                        {analytics.word_cloud.map((w, idx) => {
                          // Dynamic size class
                          const sizeClass =
                            w.value > 15 ? "text-lg bg-violet-100 dark:bg-violet-950/40 text-primary font-extrabold" :
                              w.value > 8 ? "text-sm bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 dark:text-indigo-400 font-bold" :
                                "text-xs bg-muted/50 text-slate-500 font-medium";
                          return (
                            <span key={idx} className={`px-2.5 py-1 rounded-lg ${sizeClass} cursor-default`}>
                              {w.text} <span className="opacity-55 text-[10px] font-mono ml-0.5">({w.value})</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Zoom Modal */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoomedImage(null)}
        >
          <img 
            src={zoomedImage} 
            alt="Zoomed" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" 
          />
          <button 
            className="absolute top-6 right-6 text-white bg-slate-800/50 hover:bg-slate-800 p-2 rounded-full transition cursor-pointer"
            onClick={(e) => { e.stopPropagation(); setZoomedImage(null); }}
          >
            <XCircle className="w-8 h-8" />
          </button>
        </div>
      )}
    </div>
  );
};
