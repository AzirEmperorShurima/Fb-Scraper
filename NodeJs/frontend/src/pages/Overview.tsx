import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../utils/api";
import { Play, TrendingUp, Plus, BookOpen, AlertCircle } from "lucide-react";

interface FBAccount {
  id: number;
  email: string;
  status: string;
}

export const Overview: React.FC = () => {
  const navigate = useNavigate();
  const [groupUrl, setGroupUrl] = useState("");
  const [maxPosts, setMaxPosts] = useState(50);
  const [includeComments, setIncludeComments] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [isAutoSelect, setIsAutoSelect] = useState(true);
  const [autoSelectCount, setAutoSelectCount] = useState(1);
  const [sinceDate, setSinceDate] = useState("");
  const [untilDate, setUntilDate] = useState("");
  const [keywordFilter, setKeywordFilter] = useState("");
  const [minReactions, setMinReactions] = useState(0);
  const [customCookies, setCustomCookies] = useState("");
  
  const [accounts, setAccounts] = useState<FBAccount[]>([]);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      const accountsRes = await api.get("/api/config/fb-accounts");
      setAccounts(accountsRes.data);
      if (accountsRes.data.length > 0) {
        setSelectedAccounts([accountsRes.data[0].id.toString()]);
      }
    } catch (err) {
      console.error("Error fetching accounts", err);
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
        fb_account_ids: selectedAccounts.includes("custom") ? undefined : selectedAccounts.map(id => parseInt(id)),
        since_date: sinceDate || undefined,
        until_date: untilDate || undefined,
        keyword_filter: keywordFilter || undefined,
        min_reactions: minReactions || 0,
        custom_cookies: selectedAccounts.includes("custom") && customCookies ? customCookies : undefined
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

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Overview & Quick Start</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Launch new scraping operations and learn how to use the system.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Launch New Job Card (3 cols) */}
        <div className="lg:col-span-3 bg-card border border-border shadow-sm rounded-xl p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold">Quick Start Scraper</h2>
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-medium">
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
                className="w-full px-4 py-3 rounded-lg border border-border bg-transparent focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm"
              />
              <span className="text-xs text-slate-400 mt-1.5 block">
                Supports public groups. For private groups, make sure valid cookies are saved in Accounts.
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
                  className="w-full px-4 py-3 rounded-lg border border-border bg-transparent focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold">Facebook Account Session</label>
                  <Link 
                    to="/accounts"
                    className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 bg-primary/10 px-2 py-1 rounded"
                  >
                    <Plus className="w-3 h-3" /> Manage
                  </Link>
                </div>
                {accounts.length === 0 ? (
                  <div className="space-y-3">
                    <div className="py-3 px-4 bg-muted/50 border border-dashed border-border rounded-lg text-xs text-slate-400 flex items-center justify-between">
                      <span>No accounts found in Accounts</span>
                      <Link to="/accounts" className="text-primary hover:underline font-semibold">Add one</Link>
                    </div>
                    <textarea
                      placeholder="Or paste your JSON cookies here to run immediately..."
                      value={customCookies}
                      onChange={(e) => {
                        setCustomCookies(e.target.value);
                        setSelectedAccounts(["custom"]);
                      }}
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm font-mono text-xs"
                    ></textarea>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 mb-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isAutoSelect}
                          onChange={(e) => {
                            setIsAutoSelect(e.target.checked);
                            if (e.target.checked) {
                              const validAccs = accounts.filter(a => a.status === 'valid').slice(0, autoSelectCount);
                              setSelectedAccounts(validAccs.length > 0 ? validAccs.map(a => a.id.toString()) : [accounts[0].id.toString()]);
                            }
                          }}
                          className="rounded text-primary focus:ring-primary"
                        />
                        <span>Auto-select</span>
                      </label>
                      {isAutoSelect && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm">Count:</span>
                          <input
                            type="number"
                            min={1}
                            max={accounts.length}
                            value={autoSelectCount}
                            onChange={(e) => {
                              const cnt = parseInt(e.target.value) || 1;
                              setAutoSelectCount(cnt);
                              const validAccs = accounts.filter(a => a.status === 'valid').slice(0, cnt);
                              setSelectedAccounts(validAccs.length > 0 ? validAccs.map(a => a.id.toString()) : [accounts[0].id.toString()]);
                            }}
                            className="w-16 px-2 py-1 rounded-lg border border-border bg-transparent text-sm"
                          />
                        </div>
                      )}
                    </div>
                    
                    <select
                      multiple
                      value={selectedAccounts}
                      onChange={(e) => {
                        const vals = Array.from(e.target.selectedOptions, option => option.value);
                        if (vals.includes("custom")) {
                          setSelectedAccounts(["custom"]);
                        } else {
                          setSelectedAccounts(vals);
                        }
                        setIsAutoSelect(false);
                      }}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm h-32"
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.email} ({acc.status})</option>
                      ))}
                      <option value="custom">-- Use Custom Cookies --</option>
                    </select>
                    <p className="text-xs text-slate-500">Giữ Ctrl/Cmd để chọn nhiều tài khoản chạy dự phòng.</p>

                    {selectedAccounts.includes("custom") && (
                      <textarea
                        placeholder="Paste your JSON cookies here..."
                        value={customCookies}
                        onChange={(e) => setCustomCookies(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm font-mono text-xs"
                      ></textarea>
                    )}
                  </div>
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
                    className="w-full px-4 py-3 rounded-lg border border-border bg-transparent focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm text-slate-600 dark:text-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Until Date (Đến ngày)</label>
                  <input
                    type="date"
                    value={untilDate}
                    onChange={(e) => setUntilDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-transparent focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm text-slate-600 dark:text-slate-300"
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
                    className="w-full px-4 py-3 rounded-lg border border-border bg-transparent focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Min Reactions (Tương tác tối thiểu)</label>
                  <input
                    type="number"
                    min={0}
                    value={minReactions}
                    onChange={(e) => setMinReactions(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-transparent focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm"
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
                className="w-4.5 h-4.5 rounded border-border text-primary focus:ring-primary focus:ring-offset-0"
              />
              <label htmlFor="comments" className="text-sm font-semibold select-none cursor-pointer">
                Scrape comments (may increase scraping execution time)
              </label>
            </div>

            <button
              type="submit"
              disabled={launching}
              className="w-full py-4 bg-primary text-primary-foreground rounded-[10px] font-bold shadow-sm hover:opacity-90 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Play className="w-5 h-5 fill-current" />
              Launch Scraper Task
            </button>
          </form>
        </div>

        {/* Documentation / Guides Card (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border shadow-sm rounded-xl p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold">Getting Started</h2>
            </div>
            
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                <strong>1. Prepare Facebook Accounts:</strong> First, ensure you have added valid Facebook Accounts in the 
                <Link to="/accounts" className="text-primary font-medium hover:underline mx-1">Accounts</Link> tab. We use Playwright to simulate user behavior.
              </p>
              
              <p>
                <strong>2. Auto-Select Accounts:</strong> Check the "Auto-select" box to let the system automatically pick healthy (Valid) accounts to scrape. If one fails, the system will try the next one in queue.
              </p>
              
              <p>
                <strong>3. Advanced Filtering:</strong> Use filters to only extract what you need. "Since Date" stops the scraper entirely once it reaches older posts, speeding up the process immensely.
              </p>

              <div className="p-4 bg-info/10 border border-info/20 rounded-xl mt-4">
                <h4 className="font-bold flex items-center gap-2 text-info mb-2">
                  <AlertCircle className="w-4 h-4" /> Best Practices
                </h4>
                <ul className="list-disc pl-5 space-y-1 text-xs text-info">
                  <li>Avoid scraping over 500 posts at once to prevent IP bans.</li>
                  <li>Use rotating proxy (can be configured in .env).</li>
                  <li>Enable "Scrape comments" only when strictly necessary.</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="bg-primary rounded-xl p-6 md:p-8 text-primary-foreground shadow-sm">
            <h3 className="text-lg font-bold mb-2">Need API Access?</h3>
            <p className="text-sm text-primary-foreground/80 mb-4">
              Integrate Facebook data directly into your own applications via webhook or our REST API.
            </p>
            <Link to="/settings" className="inline-block px-4 py-2 bg-background text-primary font-bold rounded-lg text-sm hover:bg-slate-50 transition">
              Configure Webhooks
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
