import React, { useState, useEffect } from "react";
import api from "../utils/api";
import {
  Key,
  Trash2,
  Plus,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Loader2,
  Edit2,
  Activity,
  X
} from "lucide-react";

interface FBAccount {
  id: string;
  email: string;
  status: string;
  last_used?: string;
  created_at: string;
}

export const Accounts: React.FC = () => {
  const [accounts, setAccounts] = useState<FBAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cookiesText, setCookiesText] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleOpenModal = (account?: FBAccount) => {
    setFormError("");
    if (account) {
      setEditingAccountId(account.id);
      setEmail(account.email || "");
      setPassword("");
      setCookiesText("");
    } else {
      setEditingAccountId(null);
      setEmail("");
      setPassword("");
      setCookiesText("");
    }
    setIsModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
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
      if (editingAccountId) {
        await api.put(`/api/config/fb-accounts/${editingAccountId}`, {
          email,
          password: password || undefined,
          cookies_json: parsedCookies
        });
      } else {
        await api.post("/api/config/fb-accounts", {
          email,
          password: password || undefined,
          cookies_json: parsedCookies
        });
      }

      setIsModalOpen(false);
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

  const handleDeleteAccount = async (id: string) => {
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
          <span className="flex items-center gap-1.5 px-3 py-1 bg-success/10 text-success rounded-full text-xs font-semibold border border-success/20">
            <CheckCircle className="w-3.5 h-3.5" /> Valid
          </span>
        );
      case "invalid":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-destructive/10 text-destructive rounded-full text-xs font-semibold border border-destructive/20">
            <AlertCircle className="w-3.5 h-3.5" /> Invalid
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-warning/10 text-warning rounded-full text-xs font-semibold border border-warning/20">
            <AlertCircle className="w-3.5 h-3.5" /> Unknown
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Facebook Accounts</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage your rotating pool of Facebook accounts for scraping operations.
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-[10px] font-bold shadow-sm hover:opacity-90 active:scale-95 transition flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Account
        </button>
      </div>

      {/* Grid of Accounts */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-card border border-border rounded-xl p-6 animate-pulse" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center shadow-sm">
          <Key className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">No accounts configured</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto">
            You need to add at least one Facebook account with cookies to allow the scraper to access group content.
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="mt-6 px-6 py-2.5 bg-primary text-primary-foreground rounded-[10px] font-bold hover:opacity-90 transition"
          >
            Add First Account
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 text-slate-500 dark:text-slate-400 text-sm font-semibold border-b border-border">
                  <th className="p-4 whitespace-nowrap">Account / Email</th>
                  <th className="p-4 whitespace-nowrap">Status</th>
                  <th className="p-4 whitespace-nowrap">Added Date</th>
                  <th className="p-4 whitespace-nowrap">Last Used</th>
                  <th className="p-4 whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {accounts.map(acc => (
                  <tr key={acc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25 transition">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                          <Key className="w-4 h-4 text-primary" />
                        </div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[200px]" title={acc.email}>
                          {acc.email}
                        </h4>
                      </div>
                    </td>
                    <td className="p-4">
                      {getStatusIndicator(acc.status)}
                    </td>
                    <td className="p-4 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(acc.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap flex items-center gap-1.5 mt-2">
                      <Activity className="w-3.5 h-3.5" /> 
                      {acc.last_used ? new Date(acc.last_used).toLocaleDateString() : "Never used"}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(acc)}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold transition flex items-center gap-1.5"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(acc.id)}
                          className="px-3 py-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg text-sm transition"
                          title="Delete Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-card rounded-2xl p-6 md:p-8 w-full max-w-xl shadow-lg relative border border-border">
            
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition"
            >
              <X className="w-5 h-5" /> 
            </button>
            
            <div className="mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                {editingAccountId ? "Edit Facebook Account" : "Add Facebook Account"}
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Provide credentials or session cookies to allow the scraper to access content.
              </p>
            </div>

            {formError && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-medium flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{formError}</p>
              </div>
            )}

            <form onSubmit={handleSaveAccount} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold mb-2">Email or Phone</label>
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Nhập email/số điện thoại..."
                    className="w-full px-4 py-3 rounded-lg border border-border bg-transparent focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editingAccountId ? "Để trống nếu không đổi" : "Nhập mật khẩu..."}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-transparent focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm"
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
                  placeholder={editingAccountId ? 'Để trống nếu không muốn đổi cookies' : '[{"name": "c_user", "value": "1000...", "domain": ".facebook.com"}, ...]'}
                  rows={6}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-transparent focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-xs font-mono"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-[10px] font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3.5 bg-primary text-primary-foreground rounded-[10px] font-bold shadow-sm hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      {editingAccountId ? "Update Account" : "Save Account"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
