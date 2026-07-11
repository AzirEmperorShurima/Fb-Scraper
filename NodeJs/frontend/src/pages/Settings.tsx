import React, { useState, useEffect } from "react";
import api from "../utils/api";
import {
  Key,
  Trash2,
  Plus,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Sparkles,
  Loader2,
  Settings as SettingsIcon
} from "lucide-react";

interface FBAccount {
  id: number;
  email: string;
  status: string;
  last_used?: string;
  created_at: string;
}

import { useAuth } from "../context/AuthContext";

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<FBAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cookiesText, setCookiesText] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // System Config states
  const [clientId, setClientId] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMessage, setConfigMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchAccounts = async () => {
    try {
      const response = await api.get("/api/config/fb-accounts");
      setAccounts(response.data);
    } catch (err) {
      console.error("Error fetching accounts", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemConfig = async () => {
    try {
      const res = await api.get("/api/config");
      setClientId(res.data.google_client_id || "");
    } catch (err) {
      console.error("Error fetching system config", err);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchSystemConfig();
    if (user?.gsheet_webhook) {
      setTimeout(() => {
        const input = document.getElementById('gsheetWebhookInput') as HTMLInputElement;
        if (input) input.value = user.gsheet_webhook || "";
      }, 100);
    }
  }, [user]);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    let parsedCookies = null;
    if (cookiesText.trim()) {
      try {
        parsedCookies = JSON.parse(cookiesText.trim());
        if (!Array.isArray(parsedCookies)) {
          throw new Error("Cookies must be a JSON array of objects.");
        }
      } catch (err: any) {
        setFormError(`Invalid Cookies JSON format: ${err.message}`);
        setSubmitting(false);
        return;
      }
    }

    try {
      await api.post("/api/config/fb-accounts", {
        email,
        password: password || undefined,
        cookies_json: parsedCookies
      });

      // Reset form
      setEmail("");
      setPassword("");
      setCookiesText("");

      // Refresh list
      fetchAccounts();
    } catch (err: any) {
      console.error(err);
      setFormError(
        err.response?.data?.detail ||
        "Failed to save account config. Please check inputs."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddDemoAccount = async () => {
    setFormError("");
    setSubmitting(true);
    try {
      await api.post("/api/config/fb-accounts", {
        email: "demo@example.com",
        password: "demopassword",
        cookies_json: []
      });
      fetchAccounts();
    } catch (err: any) {
      console.error(err);
      setFormError(err.response?.data?.detail || "Failed to add demo account.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAccount = async (id: number) => {
    if (!confirm("Are you sure you want to delete this account configuration?")) return;

    try {
      await api.delete(`/api/config/fb-accounts/${id}`);
      fetchAccounts();
    } catch (err) {
      console.error("Delete account error", err);
      alert("Failed to delete account.");
    }
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case "valid":
        return (
          <span className="flex items-center gap-1 text-emerald-500 text-xs font-semibold">
            <CheckCircle className="w-3.5 h-3.5" /> Valid
          </span>
        );
      case "invalid":
        return (
          <span className="flex items-center gap-1 text-rose-500 text-xs font-semibold">
            <AlertCircle className="w-3.5 h-3.5" /> Invalid
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-amber-500 text-xs font-semibold">
            <AlertCircle className="w-3.5 h-3.5" /> Checkpoint Needed
          </span>
        );
    }
  };

  const handleSaveSystemConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigMessage(null);
    try {
      await api.post("/api/config", { google_client_id: clientId });
      setConfigMessage({ text: "Cấu hình đã lưu! Hãy tải lại trang để áp dụng.", type: "success" });
    } catch (err) {
      setConfigMessage({ text: "Lỗi khi lưu cấu hình.", type: "error" });
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">System Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Manage target browser sessions, account credentials, cookies, and demo environments.
        </p>
      </div>

      {/* System Settings Section (Google Client ID) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/40 rounded-2xl p-6 md:p-8 space-y-6 shadow-xl shadow-slate-100/50 dark:shadow-none relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none transition-opacity duration-700 opacity-50 group-hover:opacity-100" />

        <div className="flex justify-between items-center relative z-10">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-violet-600" />
            Global System Config
          </h2>
        </div>

        <form onSubmit={handleSaveSystemConfig} className="space-y-5 relative z-10">
          <div>
            <label className="block text-sm font-bold mb-2 flex items-center gap-1.5">
              Google Client ID (OAuth 2.0)
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="e.g. 1234567890-xxx.apps.googleusercontent.com"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-transparent focus:ring-2 focus:ring-violet-600 dark:focus:ring-violet-500 focus:border-transparent outline-none transition text-sm font-mono"
            />
            <span className="text-xs text-slate-400 mt-1 block">
              Required for Google Sheets Sync. Get it from Google Cloud Console.
            </span>
          </div>

          {configMessage && (
            <div className={`p-4 rounded-xl flex items-start gap-3 text-sm ${configMessage.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                : "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20"
              }`}>
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium mt-0.5">{configMessage.text}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingConfig}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold shadow-lg shadow-violet-500/20 disabled:opacity-50 transition flex items-center gap-2"
            >
              {savingConfig ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Save System Config
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left Column: Form (3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/40 rounded-2xl p-6 md:p-8 space-y-6 shadow-xl shadow-slate-100/50 dark:shadow-none">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Key className="w-5 h-5 text-violet-600" />
              Configure Facebook Profile
            </h2>

            {/* Quick add demo shortcut */}
            <button
              onClick={handleAddDemoAccount}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/30 text-xs font-bold transition border border-violet-200/40"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Quick Add Demo Account
            </button>
          </div>

          {formError && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-600 dark:text-rose-400 text-sm font-medium">
              {formError}
            </div>
          )}

          <form onSubmit={handleAddAccount} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-bold mb-2">Email hoặc Số điện thoại (FB Account)</label>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Nhập email hoặc số điện thoại..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-transparent focus:ring-2 focus:ring-violet-600 dark:focus:ring-violet-500 focus:border-transparent outline-none transition text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Account Password (Optional)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Only if cookies aren't set"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-transparent focus:ring-2 focus:ring-violet-600 dark:focus:ring-violet-500 focus:border-transparent outline-none transition text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold mb-2 flex items-center gap-1.5">
                Session Cookies JSON
                <span title="Export cookies as JSON using Chrome extensions like EditThisCookie" className="cursor-help">
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                </span>
              </label>
              <textarea
                value={cookiesText}
                onChange={(e) => setCookiesText(e.target.value)}
                placeholder='[{"name": "c_user", "value": "1000...", "domain": ".facebook.com"}, ...]'
                rows={6}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-transparent focus:ring-2 focus:ring-violet-600 dark:focus:ring-violet-500 focus:border-transparent outline-none transition text-xs font-mono"
              />
              <span className="text-xs text-slate-400 mt-1 block">
                Highly recommended! Paste cookies JSON to bypass Facebook credentials, multi-factor, and automated logins.
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/25 dark:shadow-indigo-500/10 hover:shadow-indigo-500/35 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Save FB Account Configuration
                </>
              )}
            </button>
          </form>
        </div>

        {/* Left Column 2: Google Sheets Webhook */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/40 rounded-2xl p-6 md:p-8 space-y-6 shadow-xl shadow-slate-100/50 dark:shadow-none">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              Google Sheets Integration
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2">Google Apps Script Webhook URL</label>
              <input
                type="text"
                id="gsheetWebhookInput"
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-850 bg-transparent focus:ring-2 focus:ring-emerald-600 dark:focus:ring-emerald-500 focus:border-transparent outline-none transition text-sm font-mono"
              />
              <span className="text-xs text-slate-400 mt-2 block">
                This Webhook will be automatically synced to your Chrome Extension when you login!
              </span>
            </div>

            <button
              onClick={async () => {
                const btn = document.getElementById('btnSaveWebhook') as HTMLButtonElement;
                const input = document.getElementById('gsheetWebhookInput') as HTMLInputElement;
                btn.disabled = true;
                const oldText = btn.innerText;
                btn.innerText = "Saving...";
                try {
                  await api.put('/api/auth/me/settings', { gsheet_webhook: input.value.trim() });
                  btn.innerText = "Saved!";
                  setTimeout(() => { btn.innerText = oldText; btn.disabled = false; }, 2000);
                } catch (e) {
                  alert("Failed to save webhook");
                  btn.innerText = oldText;
                  btn.disabled = false;
                }
              }}
              id="btnSaveWebhook"
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/25 dark:shadow-emerald-500/10 hover:shadow-emerald-500/35 active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              Save Webhook Configuration
            </button>
          </div>
        </div>

        {/* Right Column: Account list (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold">Stored Account Profiles</h2>

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/40 rounded-2xl p-12 text-center text-slate-400 dark:text-slate-500 text-sm">
              No account configurations stored. Add one or select "Quick Add Demo Account" above!
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map(acc => (
                <div key={acc.id} className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-850 rounded-2xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="truncate max-w-[180px]">
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate" title={acc.email}>
                        {acc.email}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Created {new Date(acc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {getStatusIndicator(acc.status)}
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-400">
                      {acc.last_used ? `Last used ${new Date(acc.last_used).toLocaleDateString()}` : "Never used"}
                    </span>
                    <button
                      onClick={() => handleDeleteAccount(acc.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition"
                      title="Delete Config"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
