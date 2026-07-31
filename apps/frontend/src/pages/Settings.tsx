import React, { useState, useEffect } from "react";
import api from "../utils/api";
import {
  CheckCircle,
  Loader2,
  RefreshCw,
  Trash2,
  Database,
  Shield,
  ShieldAlert,
  Server
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

export const Settings: React.FC = () => {
  const { user } = useAuth();
  
  const [restartBehavior, setRestartBehavior] = useState("clear");
  const [webrtcDefense, setWebrtcDefense] = useState(true);
  const [realIpDefense, setRealIpDefense] = useState(true);
  const [proxies, setProxies] = useState<any[]>([]);
  const [newProxy, setNewProxy] = useState({ server: "", username: "", password: "", type: "HTTP" });
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await api.get("/api/config");
        if (response.data) {
          if (response.data.restart_behavior) setRestartBehavior(response.data.restart_behavior);
          if (response.data.webrtc_defense !== undefined) setWebrtcDefense(response.data.webrtc_defense);
          if (response.data.real_ip_defense !== undefined) setRealIpDefense(response.data.real_ip_defense);
          if (response.data.proxies) setProxies(response.data.proxies);
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

  const saveConfig = async (partialConfig: any) => {
    try {
      await api.post("/api/config", partialConfig);
    } catch (err) {
      console.error("Error saving config", err);
    }
  };

  const saveRestartBehavior = async (behavior: string) => {
    setRestartBehavior(behavior);
    await saveConfig({ restart_behavior: behavior });
  };

  const toggleWebrtc = () => {
    const val = !webrtcDefense;
    setWebrtcDefense(val);
    saveConfig({ webrtc_defense: val });
  };

  const toggleRealIp = () => {
    const val = !realIpDefense;
    setRealIpDefense(val);
    saveConfig({ real_ip_defense: val });
  };

  const addProxy = () => {
    if (!newProxy.server) return;
    const updated = [...proxies, { ...newProxy, status: 'active' }];
    setProxies(updated);
    setNewProxy({ server: "", username: "", password: "", type: "HTTP" });
    saveConfig({ proxies: updated });
  };

  const removeProxy = (index: number) => {
    const updated = proxies.filter((_, i) => i !== index);
    setProxies(updated);
    saveConfig({ proxies: updated });
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

          <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
              <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">How to get your Webhook URL:</h3>
              <ol className="list-decimal list-inside text-sm text-slate-600 dark:text-slate-400 space-y-2">
                <li>Create a new <a href="https://docs.google.com/spreadsheets" target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">Google Sheet</a>.</li>
                <li>Go to <strong>Extensions &gt; Apps Script</strong>.</li>
                <li>Paste the following code, then click <strong>Deploy &gt; New deployment</strong>.</li>
                <li>Select type <strong>Web app</strong>, set access to <strong>Anyone</strong>, and copy the Web App URL here.</li>
              </ol>
              
              <div className="relative group mt-3">
                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      const text = `function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    if (!data || !data.posts) return ContentService.createTextOutput("No data");
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Post ID", "Author Name", "Text", "URL", "Reactions", "Comments"]);
    }
    
    data.posts.forEach(p => {
      sheet.appendRow([
        p.post_id, p.author_name, p.text, p.post_url,
        p.reactions_json ? p.reactions_json.total : 0, p.comments_count
      ]);
    });
    
    return ContentService.createTextOutput("Success");
  } catch (error) {
    return ContentService.createTextOutput("Error: " + error.message);
  }
}`;
                      navigator.clipboard.writeText(text);
                      const btn = e.currentTarget;
                      const old = btn.innerText;
                      btn.innerText = "Copied!";
                      setTimeout(() => btn.innerText = old, 2000);
                    }}
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-md transition-colors shadow-sm"
                  >
                    Copy Code
                  </button>
                </div>
                <pre className="text-xs bg-slate-950 text-slate-300 p-4 rounded-lg overflow-x-auto font-mono leading-relaxed border border-slate-800">
                  <code>{`function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    if (!data || !data.posts) return ContentService.createTextOutput("No data");
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Post ID", "Author Name", "Text", "URL", "Reactions", "Comments"]);
    }
    
    data.posts.forEach(p => {
      sheet.appendRow([
        p.post_id, p.author_name, p.text, p.post_url,
        p.reactions_json ? p.reactions_json.total : 0, p.comments_count
      ]);
    });
    
    return ContentService.createTextOutput("Success");
  } catch (error) {
    return ContentService.createTextOutput("Error: " + error.message);
  }
}`}</code>
                </pre>
              </div>
            </div>

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

      {/* Security & Proxies Section */}
      <div className="bg-card border border-border rounded-xl p-6 md:p-8 space-y-8 shadow-sm">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-500" />
            Security & Proxies
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <label className="flex items-center p-4 border border-border rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
            <input 
              type="checkbox" 
              checked={webrtcDefense}
              onChange={toggleWebrtc}
              className="w-5 h-5 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500"
            />
            <div className="ms-4">
              <div className="font-bold text-sm">WebRTC Leak Prevention</div>
              <div className="text-xs text-slate-500 mt-1">Disables WebRTC UDP and hardware encoding to prevent real IP leaks during scraping.</div>
            </div>
          </label>
          <label className="flex items-center p-4 border border-border rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
            <input 
              type="checkbox" 
              checked={realIpDefense}
              onChange={toggleRealIp}
              className="w-5 h-5 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500"
            />
            <div className="ms-4">
              <div className="font-bold text-sm">Real IP Defense</div>
              <div className="text-xs text-slate-500 mt-1">Injects extra stealth flags to isolate origins and bypass bot-detection algorithms.</div>
            </div>
          </label>
        </div>

        <div>
          <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
            <Server className="w-5 h-5 text-indigo-500" />
            Proxy Manager
          </h3>
          <p className="text-sm text-slate-500 mb-4">Add your rotating or sticky proxies here. The scraper will randomly pick an active proxy from this list.</p>
          
          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <select
              value={newProxy.type}
              onChange={(e) => setNewProxy({...newProxy, type: e.target.value})}
              className="px-4 py-2 rounded-lg border border-border bg-transparent outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            >
              <option value="HTTP">HTTP/HTTPS</option>
              <option value="SOCKS4">SOCKS4</option>
              <option value="SOCKS5">SOCKS5</option>
            </select>
            <input
              type="text"
              placeholder="IP:PORT (e.g. 192.168.1.1:8080)"
              value={newProxy.server}
              onChange={(e) => setNewProxy({...newProxy, server: e.target.value})}
              className="flex-1 px-4 py-2 rounded-lg border border-border bg-transparent outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <input
              type="text"
              placeholder="Username (optional)"
              value={newProxy.username}
              onChange={(e) => setNewProxy({...newProxy, username: e.target.value})}
              className="flex-1 px-4 py-2 rounded-lg border border-border bg-transparent outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <input
              type="password"
              placeholder="Password (optional)"
              value={newProxy.password}
              onChange={(e) => setNewProxy({...newProxy, password: e.target.value})}
              className="flex-1 px-4 py-2 rounded-lg border border-border bg-transparent outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <button
              onClick={addProxy}
              className="px-6 py-2 bg-indigo-500 text-white font-bold rounded-lg hover:bg-indigo-600 transition shadow-sm"
            >
              Add Proxy
            </button>
          </div>

          {proxies.length > 0 ? (
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-500">Type</th>
                    <th className="px-4 py-3 font-semibold text-slate-500">Server (IP:PORT)</th>
                    <th className="px-4 py-3 font-semibold text-slate-500">Auth</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {proxies.map((p, idx) => (
                    <tr key={idx} className="border-b border-border last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td className="px-4 py-3 font-medium text-indigo-500">{p.type}</td>
                      <td className="px-4 py-3 font-mono">{p.server}</td>
                      <td className="px-4 py-3">{p.username ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => removeProxy(idx)} className="text-destructive hover:opacity-80 p-2">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 border border-dashed border-border rounded-xl">
              No proxies configured. Using direct connection.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
