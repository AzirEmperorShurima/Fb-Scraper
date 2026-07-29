import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../utils/api";
import {
  Search,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Square,
  Play,
  Pause,
  Loader2,
  Trash2,
  ExternalLink
} from "lucide-react";
import { useGoogleLogin } from '@react-oauth/google';

interface Job {
  id: string;
  group_url: string;
  group_name?: string;
  status: string;
  max_posts: number;
  include_comments: boolean;
  progress: number;
  spreadsheet_url?: string;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export const Jobs: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [syncingJobId, setSyncingJobId] = useState<string | null>(null);
  const syncingJobIdRef = React.useRef<string | null>(null);

  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "error" | "success" | "confirm";
    onConfirm?: () => void;
  }>({ isOpen: false, title: "", message: "", type: "error" });

  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  const showModal = (title: string, message: string, type: "error" | "success" | "confirm" = "error", onConfirm?: () => void) => {
    setModal({ isOpen: true, title, message, type, onConfirm });
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const jobId = syncingJobIdRef.current;
      if (!jobId) return;
      try {
        const res = await api.post(`/api/sheets/sync-job/${jobId}`, {
          access_token: tokenResponse.access_token
        });
        if (res.data && res.data.detail) {
          showModal("Thông báo", res.data.detail, "success");
        }
        fetchJobs();
      } catch (err: any) {
        showModal("Lỗi Đồng Bộ", err.response?.data?.detail || "Failed to sync to Google Sheets.", "error");
      } finally {
        setSyncingJobId(null);
        syncingJobIdRef.current = null;
      }
    },
    onError: () => {
      showModal("Lỗi", "Cấp quyền Google Drive thất bại.", "error");
      setSyncingJobId(null);
      syncingJobIdRef.current = null;
    },
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
  });

  const fetchJobs = async () => {
    try {
      const response = await api.get("/api/jobs");
      setJobs(response.data);
    } catch (err) {
      console.error("Error fetching jobs list", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // Set up polling for real-time list updating
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStopJob = async (jobId: string) => {
    setActionLoadingId(jobId);
    try {
      await api.post(`/api/jobs/${jobId}/stop`);
      await fetchJobs();
    } catch (err) {
      console.error("Error stopping job", err);
      showModal("Lỗi", "Failed to stop job.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePauseJob = async (jobId: string) => {
    setActionLoadingId(jobId);
    try {
      await api.post(`/api/jobs/${jobId}/pause`);
      await fetchJobs();
    } catch (err: any) {
      console.error("Error pausing job", err);
      showModal("Lỗi", err.response?.data?.message || "Failed to pause job.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResumeJob = async (jobId: string) => {
    setActionLoadingId(jobId);
    try {
      await api.post(`/api/jobs/${jobId}/resume`);
      await fetchJobs();
    } catch (err: any) {
      console.error("Error resuming job", err);
      showModal("Lỗi", err.response?.data?.message || "Failed to resume job.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRestartJob = (jobId: string) => {
    showModal("Xác nhận chạy lại", "Bạn có chắc chắn muốn chạy lại job này không? Tiến trình sẽ bị reset về 0%.", "confirm", async () => {
      setActionLoadingId(jobId);
      try {
        await api.post(`/api/jobs/${jobId}/restart`);
        await fetchJobs();
      } catch (err: any) {
        console.error("Error restarting job", err);
        showModal("Lỗi", err.response?.data?.message || "Failed to restart job.", "error");
      } finally {
        setActionLoadingId(null);
      }
    });
  };

  const handleDownload = (jobId: string, format: string) => {
    // Direct link to the API download endpoint with Auth token passed as a query param
    // or we fetch using Axios, convert to blob, and trigger download.
    // Fetching as a blob is cleaner and secures the token!
    api.get(`/api/jobs/${jobId}/export?format=${format}`, { responseType: "blob" })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `job_${jobId}_export.${format}`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      })
      .catch((err) => {
        console.error("Export download failed", err);
        showModal("Lỗi Xuất File", "Export failed. Ensure the job has scraped posts successfully first.", "error");
      });
  };

  const getStatusBadge = (status: string) => {
    const base = "px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 w-fit";
    switch (status) {
      case "pending":
        return <span className={`${base} bg-warning/10 text-warning border border-warning/30`}><Clock className="w-3.5 h-3.5" /> Pending</span>;
      case "running":
        return <span className={`${base} bg-info/10 text-info border border-info/30`}><Activity className="w-3.5 h-3.5 animate-spin" /> Running</span>;
      case "completed":
        return <span className={`${base} bg-success/10 text-success border border-success/30`}><CheckCircle2 className="w-3.5 h-3.5" /> Completed</span>;
      case "failed":
        return <span className={`${base} bg-destructive/10 text-destructive border border-destructive/30`}><XCircle className="w-3.5 h-3.5" /> Failed</span>;
      case "stopped":
        return <span className={`${base} bg-muted/50 text-muted-foreground border border-border`}><AlertCircle className="w-3.5 h-3.5" /> Stopped</span>;
      default:
        return <span className={`${base} bg-slate-100 dark:bg-slate-800 text-slate-500`}>Unknown</span>;
    }
  };

  // Filter jobs based on search term
  const filteredJobs = jobs.filter(job =>
    job.group_url.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Scrape Jobs Directory</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Review, download, stop, or audit all group crawling sessions.
          </p>
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="relative max-w-md">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
          <Search className="w-5 h-5" />
        </span>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter by group URL or Job ID..."
          className="w-full pl-11 pr-4 py-3 rounded-lg border border-border bg-card focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm shadow-sm"
        />
      </div>

      {/* Directory Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm font-medium">Loading scrape jobs...</span>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="py-20 text-center text-slate-400 dark:text-slate-500 text-sm">
            {searchTerm ? "No matching jobs found." : "No scraping jobs created yet. Launch one from the Dashboard!"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-border">
                  <th className="px-6 py-4">Target (Group/Page/User)</th>
                  <th className="px-6 py-4">Started At</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Progress</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                  <th className="px-6 py-4 text-right">Downloads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm font-medium">
                {filteredJobs.map((job) => {
                  const getTargetName = (url: string, name?: string) => {
                    if (name) return name;
                    try {
                      const urlObj = new URL(url);
                      const pathParts = urlObj.pathname.split('/').filter(p => p);
                      if (pathParts.length === 0) return "Facebook";
                      if (pathParts[0] === 'groups') return `Group: ${pathParts[1] || 'Unknown'}`;
                      if (pathParts[0] === 'profile.php') return 'Facebook Profile';
                      return `Page/User: ${pathParts[0]}`;
                    } catch (e) {
                      return "Invalid URL";
                    }
                  };
                  return (
                  <tr key={job.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4 max-w-[280px]">
                      <div className="truncate text-slate-800 dark:text-slate-100 font-bold" title={getTargetName(job.group_url, job.group_name)}>
                        {getTargetName(job.group_url, job.group_name)}
                      </div>
                      <div className="text-xs text-slate-500 font-medium mt-1 truncate">
                        <a href={job.group_url} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline inline-flex items-center gap-1" title={job.group_url}>
                          {job.group_url.length > 35 ? job.group_url.substring(0, 35) + "..." : job.group_url}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-1 truncate">ID: {job.id}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(job.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-muted h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${job.status === "failed" ? "bg-destructive" :
                                job.status === "stopped" ? "bg-muted-foreground" : "bg-primary"
                              }`}
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-500">{job.progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          to={`/jobs/${job.id}`}
                          className="p-2 rounded-lg border border-border hover:bg-muted text-slate-600 dark:text-slate-300 transition"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>

                        {(job.status === "pending" || job.status === "running") && (
                          <>
                            <button
                              onClick={() => handlePauseJob(job.id)}
                              disabled={actionLoadingId === job.id}
                              className="p-2 rounded-lg border border-warning/30 hover:bg-warning/10 text-warning transition disabled:opacity-50"
                              title="Pause Job"
                            >
                              {actionLoadingId === job.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Pause className="w-4 h-4 fill-current" />
                              )}
                            </button>
                            <button
                              onClick={() => handleStopJob(job.id)}
                              disabled={actionLoadingId === job.id}
                              className="p-2 rounded-lg border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 transition disabled:opacity-50"
                              title="Stop Job"
                            >
                              {actionLoadingId === job.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Square className="w-4 h-4 fill-current" />
                              )}
                            </button>
                          </>
                        )}

                        {job.status === "paused" && (
                          <>
                            <button
                              onClick={() => handleResumeJob(job.id)}
                              disabled={actionLoadingId === job.id}
                              className="p-2 rounded-lg border border-success/30 hover:bg-success/10 text-success transition disabled:opacity-50"
                              title="Resume Job"
                            >
                              {actionLoadingId === job.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Play className="w-4 h-4 fill-current" />
                              )}
                            </button>
                            <button
                              onClick={() => handleStopJob(job.id)}
                              disabled={actionLoadingId === job.id}
                              className="p-2 rounded-lg border border-destructive/30 hover:bg-destructive/10 text-destructive transition disabled:opacity-50"
                              title="Stop Job"
                            >
                              {actionLoadingId === job.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Square className="w-4 h-4 fill-current" />
                              )}
                            </button>
                          </>
                        )}

                        {["completed", "stopped", "failed"].includes(job.status) && (
                          <button
                            onClick={() => handleRestartJob(job.id)}
                            disabled={actionLoadingId === job.id}
                            className="p-2 rounded-lg border border-info/30 hover:bg-info/10 text-info transition disabled:opacity-50"
                            title="Restart Job"
                          >
                            {actionLoadingId === job.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4 fill-current" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            showModal("Xóa Job", "Bạn có chắc chắn muốn xóa job này không? Dữ liệu cào được sẽ bị mất hoàn toàn.", "confirm", async () => {
                              try {
                                await api.delete(`/api/jobs/${job.id}`);
                                fetchJobs();
                              } catch (err) {
                                showModal("Lỗi", "Failed to delete job.", "error");
                              }
                            });
                          }}
                          className="p-2 rounded-lg border border-destructive/30 hover:bg-destructive/10 text-destructive transition"
                          title="Delete Job"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {job.status === "completed" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleDownload(job.id, "xlsx")}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-success/10 text-success hover:bg-success/20 border border-success/30 transition"
                          >
                            Excel
                          </button>
                          <button
                            onClick={() => handleDownload(job.id, "csv")}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-info/10 text-info hover:bg-info/20 border border-info/30 transition"
                          >
                            CSV
                          </button>
                          <button
                            onClick={() => handleDownload(job.id, "json")}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 transition"
                          >
                            JSON
                          </button>
                          {job.spreadsheet_url ? (
                            <a
                              href={job.spreadsheet_url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-success text-success-foreground hover:bg-success/90 transition shadow-sm"
                            >
                              Open GSheet
                            </a>
                          ) : (
                            <button
                              onClick={() => {
                                setSyncingJobId(job.id);
                                syncingJobIdRef.current = job.id;
                                // Start Google OAuth popup
                                setTimeout(() => googleLogin(), 0);
                              }}
                              disabled={syncingJobId === job.id}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-success/10 text-success hover:bg-success/20 border border-success/30 transition disabled:opacity-50"
                            >
                              {syncingJobId === job.id ? "Syncing..." : "Sync GSheet"}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Not available</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Custom Modal */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              {modal.type === "error" && <XCircle className="w-6 h-6 text-destructive" />}
              {modal.type === "success" && <CheckCircle2 className="w-6 h-6 text-success" />}
              {modal.type === "confirm" && <AlertCircle className="w-6 h-6 text-warning" />}
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{modal.title}</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-6 text-sm">{modal.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                {modal.type === "confirm" ? "Hủy" : "Đóng"}
              </button>
              {modal.type === "confirm" && (
                <button
                  onClick={() => {
                    if (modal.onConfirm) modal.onConfirm();
                    closeModal();
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition"
                >
                  Đồng ý
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
