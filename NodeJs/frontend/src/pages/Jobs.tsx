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

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const jobId = syncingJobIdRef.current;
      if (!jobId) return;
      try {
        const res = await api.post(`/api/sheets/sync-job/${jobId}`, {
          access_token: tokenResponse.access_token
        });
        if (res.data && res.data.detail) {
          alert(res.data.detail);
        }
        fetchJobs();
      } catch (err: any) {
        alert(err.response?.data?.detail || "Failed to sync to Google Sheets.");
      } finally {
        setSyncingJobId(null);
        syncingJobIdRef.current = null;
      }
    },
    onError: () => {
      alert("Cấp quyền Google Drive thất bại.");
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
      alert("Failed to stop job.");
    } finally {
      setActionLoadingId(null);
    }
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
        alert("Export failed. Ensure the job has scraped posts successfully first.");
      });
  };

  const getStatusBadge = (status: string) => {
    const base = "px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 w-fit";
    switch (status) {
      case "pending":
        return <span className={`${base} bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30`}><Clock className="w-3.5 h-3.5" /> Pending</span>;
      case "running":
        return <span className={`${base} bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30`}><Activity className="w-3.5 h-3.5 animate-spin" /> Running</span>;
      case "completed":
        return <span className={`${base} bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30`}><CheckCircle2 className="w-3.5 h-3.5" /> Completed</span>;
      case "failed":
        return <span className={`${base} bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30`}><XCircle className="w-3.5 h-3.5" /> Failed</span>;
      case "stopped":
        return <span className={`${base} bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700`}><AlertCircle className="w-3.5 h-3.5" /> Stopped</span>;
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
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-violet-600 dark:focus:ring-violet-500 focus:border-transparent outline-none transition text-sm shadow-sm"
        />
      </div>

      {/* Directory Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/40 rounded-2xl overflow-hidden shadow-xl shadow-slate-100/50 dark:shadow-none">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
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
                <tr className="bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-4">Target (Group/Page/User)</th>
                  <th className="px-6 py-4">Started At</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Progress</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                  <th className="px-6 py-4 text-right">Downloads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-sm font-medium">
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
                        <a href={job.group_url} target="_blank" rel="noopener noreferrer" className="hover:text-violet-600 hover:underline inline-flex items-center gap-1" title={job.group_url}>
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
                        <div className="w-24 bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${job.status === "failed" ? "bg-rose-500" :
                                job.status === "stopped" ? "bg-slate-400" : "bg-violet-600"
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
                          className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>

                        <button
                          onClick={() => handleStopJob(job.id)}
                          disabled={actionLoadingId === job.id}
                          className="p-2 rounded-lg border border-amber-200 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-amber-600 dark:text-amber-400 transition disabled:opacity-50"
                          title="Stop Job"
                        >
                          {actionLoadingId === job.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Square className="w-4 h-4 fill-current" />
                          )}
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm("Are you sure you want to delete this job? This will delete all scraped posts.")) return;
                            try {
                              await api.delete(`/api/jobs/${job.id}`);
                              fetchJobs();
                            } catch (err) {
                              alert("Failed to delete job.");
                            }
                          }}
                          className="p-2 rounded-lg border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 transition"
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
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100/70 border border-emerald-200/50 transition"
                          >
                            Excel
                          </button>
                          <button
                            onClick={() => handleDownload(job.id, "csv")}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100/70 border border-blue-200/50 transition"
                          >
                            CSV
                          </button>
                          <button
                            onClick={() => handleDownload(job.id, "json")}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/70 border border-indigo-200/50 transition"
                          >
                            JSON
                          </button>
                          {job.spreadsheet_url ? (
                            <a
                              href={job.spreadsheet_url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm"
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
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400 hover:bg-teal-100/70 border border-teal-200/50 transition disabled:opacity-50"
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
    </div>
  );
};
