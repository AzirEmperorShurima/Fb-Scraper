import React, { useState, useEffect } from "react";
import api from "../utils/api";
import {
  CheckCircle,
  Loader2,
  RefreshCw,
  Trash2,
  Database
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export const Settings: React.FC = () => {
  const { user } = useAuth();
  
  const [restartBehavior, setRestartBehavior] = useState("clear");
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await api.get("/api/config");
        if (response.data.restart_behavior) {
          setRestartBehavior(response.data.restart_behavior);
        }
      } catch (err) {
        console.error("Error fetching config", err);
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchConfig();

    if (user?.gsheet_webhook) {
      setTimeout(() => {
        const input = document.getElementById('gsheetWebhookInput') as HTMLInputElement;
        if (input) input.value = user.gsheet_webhook || "";
      }, 100);
    }
  }, [user]);

  const saveRestartBehavior = async (behavior: string) => {
    setRestartBehavior(behavior);
    try {
      await api.post("/api/config", { restart_behavior: behavior });
    } catch (err) {
      console.error("Error saving config", err);
      alert("Failed to save config");
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">System Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Manage application-wide behavior and third-party integrations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Restart Behavior Settings */}
        <div className="bg-card border border-border rounded-xl p-6 md:p-8 space-y-6 shadow-sm">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              Job Restart Behavior
            </h2>
            {loadingConfig && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          </div>
          
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Configure what happens to previously scraped posts when you click "Restart" on an existing job.
          </p>

          <div className="space-y-4">
            <label 
              className={`flex items-start p-4 border rounded-xl cursor-pointer transition-all ${
                restartBehavior === 'clear' 
                ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                : 'border-border hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center h-5">
                <input 
                  type="radio" 
                  name="restartBehavior" 
                  value="clear" 
                  checked={restartBehavior === 'clear'}
                  onChange={() => saveRestartBehavior('clear')}
                  className="w-4 h-4 text-primary bg-slate-100 border-slate-300 focus:ring-primary focus:ring-2 dark:bg-slate-700 dark:border-slate-600" 
                />
              </div>
              <div className="ms-3 text-sm">
                <label className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-destructive" />
                  Clear Old Data
                </label>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  Deletes all previously scraped posts for the job. Ideal for keeping a fresh dataset.
                </p>
              </div>
            </label>

            <label 
              className={`flex items-start p-4 border rounded-xl cursor-pointer transition-all ${
                restartBehavior === 'version' 
                ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                : 'border-border hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center h-5">
                <input 
                  type="radio" 
                  name="restartBehavior" 
                  value="version" 
                  checked={restartBehavior === 'version'}
                  onChange={() => saveRestartBehavior('version')}
                  className="w-4 h-4 text-primary bg-slate-100 border-slate-300 focus:ring-primary focus:ring-2 dark:bg-slate-700 dark:border-slate-600" 
                />
              </div>
              <div className="ms-3 text-sm">
                <label className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Database className="w-4 h-4 text-success" />
                  Keep Data & Create Version
                </label>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  Keeps old data intact and increments the Job Version. UI will allow filtering posts by version.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Google Sheets Integration */}
        <div className="bg-card border border-border rounded-xl p-6 md:p-8 space-y-6 shadow-sm">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <svg className="w-5 h-5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
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
                className="w-full px-4 py-3 rounded-lg border border-border bg-transparent focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm font-mono"
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
              className="w-full py-4 bg-success text-success-foreground rounded-[10px] font-bold shadow-sm hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              Save Webhook Configuration
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
