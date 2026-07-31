import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../utils/api";
import { Play, Plus, Trash2, Loader2, Save, X, Server, RefreshCw, Edit3, Database } from "lucide-react";

interface ScriptStep {
  step_order: number;
  group_url: string;
  max_posts: number;
  keyword_filter?: string;
  min_reactions?: number;
  sort_order?: string;
  require_media?: boolean;
}

interface FBAccount {
  id: number;
  email: string;
  status: string;
}

interface CrawlerScript {
  id: string;
  name: string;
  description: string;
  steps: ScriptStep[];
  since_date?: string;
  until_date?: string;
  created_at: string;
}

interface ScriptExecution {
  id: string;
  script_id: { id: string; name: string };
  status: string;
  current_step: number;
  total_steps: number;
  progress: number;
  logs: string;
  created_at: string;
  completed_at?: string;
}

export const Scripts: React.FC = () => {
  const [scripts, setScripts] = useState<CrawlerScript[]>([]);
  const [executions, setExecutions] = useState<ScriptExecution[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isCreating, setIsCreating] = useState(false);
  const [editScriptId, setEditScriptId] = useState<string | null>(null);
  
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newSteps, setNewSteps] = useState<ScriptStep[]>([
    { step_order: 1, group_url: "", max_posts: 50, sort_order: "RECENT_ACTIVITY", require_media: false }
  ]);

  const [saving, setSaving] = useState(false);
  const [executingIds, setExecutingIds] = useState<string[]>([]);
  
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);

  // --- Run Modal State ---
  const [runModalScriptId, setRunModalScriptId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<FBAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [isAutoSelect, setIsAutoSelect] = useState(true);
  const [autoSelectCount, setAutoSelectCount] = useState(1);

  // --- Add Account Modal State ---
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccEmail, setNewAccEmail] = useState("");
  const [newAccPassword, setNewAccPassword] = useState("");
  const [newAccCookies, setNewAccCookies] = useState("");
  const [addingAccount, setAddingAccount] = useState(false);

  const fetchData = async () => {
    try {
      const [scriptsRes, execsRes, accountsRes] = await Promise.all([
        api.get("/api/scripts"),
        api.get("/api/scripts/executions"),
        api.get("/api/config/fb-accounts")
      ]);
      setScripts(scriptsRes.data);
      setExecutions(execsRes.data);
      setAccounts(accountsRes.data);
      if (accountsRes.data.length > 0 && selectedAccounts.length === 0) {
        setSelectedAccounts([accountsRes.data[0].id.toString()]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAddStep = () => {
    setNewSteps([...newSteps, { step_order: newSteps.length + 1, group_url: "", max_posts: 50, sort_order: "RECENT_ACTIVITY", require_media: false }]);
  };

  const handleRemoveStep = (index: number) => {
    const updated = [...newSteps];
    updated.splice(index, 1);
    updated.forEach((s, i) => s.step_order = i + 1);
    setNewSteps(updated);
  };

  const handleStepChange = (index: number, field: keyof ScriptStep, value: any) => {
    const updated = [...newSteps];
    updated[index] = { ...updated[index], [field]: value };
    setNewSteps(updated);
  };

  const handleOpenCreate = () => {
    setEditScriptId(null);
    setNewName("");
    setNewDesc("");
    setNewSteps([{ step_order: 1, group_url: "", max_posts: 50, sort_order: "RECENT_ACTIVITY", require_media: false }]);
    setIsCreating(true);
  };

  const handleOpenEdit = (script: CrawlerScript) => {
    setEditScriptId(script.id);
    setNewName(script.name);
    setNewDesc(script.description || "");
    setNewSteps(script.steps || []);
    setIsCreating(true);
  };

  const handleSaveScript = async () => {
    if (!newName || newSteps.length === 0) return alert("Name and at least 1 step required");
    if (newSteps.some(s => !s.group_url)) return alert("All steps must have a Group/Page URL");
    
    setSaving(true);
    try {
      if (editScriptId) {
        await api.put(`/api/scripts/${editScriptId}`, {
          name: newName,
          description: newDesc,
          steps: newSteps
        });
      } else {
        await api.post("/api/scripts", {
          name: newName,
          description: newDesc,
          steps: newSteps
        });
      }
      setIsCreating(false);
      setEditScriptId(null);
      fetchData();
    } catch (err) {
      alert("Failed to save script");
    } finally {
      setSaving(false);
    }
  };

  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccEmail) return;
    setAddingAccount(true);
    try {
      if (editingAccountId) {
        await api.put(`/api/config/fb-accounts/${editingAccountId}`, {
          email: newAccEmail,
          password: newAccPassword,
          cookies_json: newAccCookies || "[]"
        });
      } else {
        await api.post("/api/config/fb-accounts", {
          email: newAccEmail,
          password: newAccPassword,
          cookies_json: newAccCookies || "[]"
        });
      }
      setShowAddAccountModal(false);
      setEditingAccountId(null);
      setNewAccEmail("");
      setNewAccPassword("");
      setNewAccCookies("");
      fetchData();
    } catch(err) {
      console.error(err);
      alert(editingAccountId ? "Failed to update account" : "Failed to add account");
    } finally {
      setAddingAccount(false);
    }
  };

  const openAddModal = () => {
    setEditingAccountId(null);
    setNewAccEmail("");
    setNewAccPassword("");
    setNewAccCookies("");
    setShowAddAccountModal(true);
  };

  const openEditModal = (acc: FBAccount) => {
    setEditingAccountId(acc.id);
    setNewAccEmail(acc.email);
    setNewAccPassword(""); 
    setNewAccCookies(""); 
    setShowAddAccountModal(true);
  };

  const handleRunScriptClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRunModalScriptId(id);
  };

  const confirmRunScript = async () => {
    if (!runModalScriptId) return;
    setExecutingIds(prev => [...prev, runModalScriptId]);
    const idToRun = runModalScriptId;
    setRunModalScriptId(null);

    try {
      const payload = {
        fb_account_ids: selectedAccounts.map(id => parseInt(id))
      };
      const res = await api.post(`/api/scripts/${idToRun}/execute`, payload);
      
      // Trigger extension via frontend-connector
      window.postMessage({
        type: "FB_SCRAPER_START_CAMPAIGN",
        payload: {
          executionId: res.data.execution._id,
          scriptDetails: res.data.script,
          token: localStorage.getItem("token")
        }
      }, "*");
      
      fetchData();
    } catch (err) {
      alert("Failed to execute script");
    } finally {
      setExecutingIds(prev => prev.filter(x => x !== idToRun));
    }
  };

  const handleDeleteScript = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this script?")) return;
    try {
      await api.delete(`/api/scripts/${id}`);
      if (selectedScriptId === id) setSelectedScriptId(null);
      fetchData();
    } catch (err) {
      alert("Failed to delete");
    }
  };

  const handleDeleteExecution = async (id: string) => {
    if (!confirm("Delete this execution history?")) return;
    try {
      await api.delete(`/api/scripts/executions/${id}`);
      fetchData();
    } catch (err) {
      alert("Failed to delete execution");
    }
  };

  if (loading && scripts.length === 0) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const activeExecutions = executions.filter(e => e.status === "running" || e.status === "pending");
  const successRate = executions.length > 0 
    ? Math.round((executions.filter(e => e.status === "completed").length / executions.length) * 100) 
    : 0;

  const filteredExecutions = selectedScriptId 
    ? executions.filter(e => e.script_id?.id === selectedScriptId) 
    : [];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Crawler Campaigns</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Build and execute step-by-step automated scraping scripts.
          </p>
        </div>
        <button
          onClick={isCreating ? () => setIsCreating(false) : handleOpenCreate}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-sm flex items-center gap-2 transition"
        >
          {isCreating ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isCreating ? "Cancel" : "Create New Script"}
        </button>
      </div>

      {/* Dashboard Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <p className="text-sm font-semibold text-muted-foreground mb-1">Total Scripts</p>
          <p className="text-3xl font-black">{scripts.length}</p>
        </div>
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <p className="text-sm font-semibold text-muted-foreground mb-1">Total Executions</p>
          <p className="text-3xl font-black">{executions.length}</p>
        </div>
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <p className="text-sm font-semibold text-muted-foreground mb-1">Active Runs</p>
          <p className="text-3xl font-black text-info">{activeExecutions.length}</p>
        </div>
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
          <p className="text-sm font-semibold text-muted-foreground mb-1">Success Rate</p>
          <p className="text-3xl font-black text-success">{successRate}%</p>
        </div>
      </div>

      {isCreating && (
        <div className="bg-card border border-border p-6 rounded-xl shadow-sm space-y-6">
          <h2 className="text-xl font-bold">{editScriptId ? "Edit Script" : "New Script Builder"}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1">Campaign Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="E.g., Daily Competitor Check"
                className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Description (Optional)</label>
              <input
                type="text"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Scrape multiple target groups"
                className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-md font-bold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">Execution Steps</h3>
            {newSteps.map((step, index) => (
              <div key={index} className="flex flex-col md:flex-row gap-3 items-start md:items-end bg-muted/50 p-4 rounded-xl border border-border">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold mb-1 text-slate-500">Step {step.step_order}: Target URL</label>
                  <input
                    type="text"
                    value={step.group_url}
                    onChange={e => handleStepChange(index, "group_url", e.target.value)}
                    placeholder="https://facebook.com/groups/..."
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
                <div className="w-full md:w-24">
                  <label className="block text-xs font-bold mb-1 text-slate-500">Max Posts</label>
                  <input
                    type="number"
                    value={step.max_posts}
                    onChange={e => handleStepChange(index, "max_posts", parseInt(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
                <div className="w-full md:w-32">
                  <label className="block text-xs font-bold mb-1 text-slate-500">Keyword Filter</label>
                  <input
                    type="text"
                    value={step.keyword_filter || ""}
                    onChange={e => handleStepChange(index, "keyword_filter", e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  />
                </div>
                <div className="w-full md:w-40 flex flex-col gap-2">
                  <div>
                    <label className="block text-xs font-bold mb-1 text-slate-500">Sort Order</label>
                    <select
                      value={step.sort_order || "RECENT_ACTIVITY"}
                      onChange={e => handleStepChange(index, "sort_order", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                    >
                      <option value="RECENT_ACTIVITY">Recent</option>
                      <option value="CHRONOLOGICAL">Newest</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      checked={!!step.require_media}
                      onChange={e => handleStepChange(index, "require_media", e.target.checked)}
                      className="rounded text-primary focus:ring-primary w-3.5 h-3.5"
                    />
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Media Only</label>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveStep(index)}
                  disabled={newSteps.length === 1}
                  className="p-2 mb-1 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition disabled:opacity-50"
                  title="Remove Step"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
            
            <button
              onClick={handleAddStep}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition"
            >
              <Plus className="w-4 h-4" /> Add Step
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              onClick={handleSaveScript}
              disabled={saving}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-sm transition flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editScriptId ? "Save Changes" : "Save Campaign"}
            </button>
          </div>
        </div>
      )}

      {/* List Scripts & Executions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Server className="w-5 h-5 text-indigo-500" />
            Saved Scripts
          </h2>
          {scripts.length === 0 ? (
            <p className="text-sm text-slate-500">No scripts created yet.</p>
          ) : (
            <div className="grid gap-4">
              {scripts.map(script => (
                <div 
                  key={script.id} 
                  onClick={() => setSelectedScriptId(script.id)}
                  className={`bg-card border rounded-xl p-5 shadow-sm cursor-pointer transition-all ${
                    selectedScriptId === script.id 
                      ? "border-primary ring-1 ring-primary shadow-md" 
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg">{script.name}</h3>
                      {script.description && <p className="text-sm text-slate-500 mt-1">{script.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenEdit(script); }}
                        className="p-2 rounded-lg bg-warning/10 text-warning hover:bg-warning/20 transition"
                        title="Edit Script"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleRunScriptClick(script.id, e)}
                        disabled={executingIds.includes(script.id)}
                        className="p-2 rounded-lg bg-success/10 text-success hover:bg-success/20 transition"
                        title="Run Script"
                      >
                        {executingIds.includes(script.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                      </button>
                      <button
                        onClick={(e) => handleDeleteScript(script.id, e)}
                        className="p-2 rounded-lg bg-muted/50 text-muted-foreground hover:text-destructive transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-semibold text-slate-400 mb-2">{script.steps.length} Steps Sequence:</p>
                    <div className="flex flex-wrap gap-2">
                      {script.steps.map((s, i) => {
                        let shortUrl = s.group_url;
                        try { shortUrl = new URL(s.group_url).pathname; } catch(e){}
                        return (
                          <span key={i} className="px-2 py-1 text-[10px] font-bold rounded-md bg-muted text-muted-foreground truncate max-w-[150px]" title={s.group_url}>
                            {i+1}. {shortUrl.substring(0, 15)}...
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-500" />
            Execution History
          </h2>
          {!selectedScriptId ? (
            <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center justify-center text-center">
              <Database className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">Select a script to view its execution history</p>
            </div>
          ) : filteredExecutions.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center justify-center text-center">
              <p className="text-slate-500">No executions yet for this script.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredExecutions.map(exec => (
                <div key={exec.id} className="bg-card border border-border rounded-xl p-4 shadow-sm text-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-bold">{exec.script_id?.name || "Unknown Script"}</span>
                      <span className="text-xs text-slate-400 ml-2">{new Date(exec.created_at).toLocaleString()}</span>
                    </div>
                    <button onClick={() => handleDeleteExecution(exec.id)} className="text-slate-400 hover:text-rose-500 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                      exec.status === "completed" ? "bg-success/10 text-success" :
                      exec.status === "failed" ? "bg-destructive/10 text-destructive" :
                      exec.status === "running" ? "bg-info/10 text-info" : "bg-muted/50 text-muted-foreground"
                    }`}>
                      {exec.status.toUpperCase()}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      Step {exec.current_step} / {exec.total_steps}
                    </span>
                    {exec.status !== 'pending' && (
                       <Link 
                         to={`/scripts/executions/${exec.id}`} 
                         className="ml-auto text-xs font-bold text-primary hover:text-primary/90 bg-primary/10 hover:bg-primary/20 px-3 py-1 rounded-md transition"
                       >
                         View Data & Sync
                       </Link>
                    )}
                  </div>
                  <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden mb-3">
                    <div className="bg-info h-full transition-all" style={{ width: `${exec.progress}%` }}></div>
                  </div>
                  <div className="bg-black/90 rounded-lg p-3 max-h-32 overflow-y-auto font-mono text-[10px] text-success whitespace-pre-wrap">
                    {exec.logs || "Waiting for logs..."}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Run Script Account Selection Modal */}
      {runModalScriptId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card rounded-[16px] p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 border border-border">
            <button 
              onClick={() => setRunModalScriptId(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Play className="w-5 h-5 text-emerald-600 fill-current" /> Execute Campaign
            </h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold">Select Facebook Accounts</label>
                  <button 
                    type="button" 
                    onClick={() => openAddModal()}
                    className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/90 bg-primary/10 px-2 py-1 rounded"
                  >
                    <Plus className="w-3 h-3" /> Add Account
                  </button>
                </div>
                
                {accounts.length === 0 ? (
                  <div className="py-3 px-4 bg-muted/50 border border-dashed border-border rounded-xl text-xs text-slate-400 flex items-center justify-center">
                    No accounts found. Please add one.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4 mb-3">
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
                            min={1} max={accounts.length} value={autoSelectCount}
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
                    
                    <div className="h-40 overflow-y-auto border border-border rounded-xl">
                      {accounts.map(acc => (
                        <label 
                          key={acc.id} 
                          className={`flex items-center gap-3 p-3 border-b border-border last:border-0 cursor-pointer transition ${
                            selectedAccounts.includes(acc.id.toString()) ? 'bg-primary/10' : 'hover:bg-muted/50'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={selectedAccounts.includes(acc.id.toString())}
                            onChange={(e) => {
                              if (isAutoSelect) setIsAutoSelect(false);
                              const checked = e.target.checked;
                              if (checked) {
                                setSelectedAccounts(prev => [...prev, acc.id.toString()]);
                              } else {
                                setSelectedAccounts(prev => prev.filter(id => id !== acc.id.toString()));
                              }
                            }}
                            className="w-4 h-4 rounded text-primary focus:ring-primary"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-semibold truncate">{acc.email}</p>
                            <p className="text-xs text-slate-500 capitalize">{acc.status}</p>
                          </div>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              openEditModal(acc);
                            }}
                            className="text-xs font-semibold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-md transition"
                          >
                            Edit
                          </button>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      <span className="font-bold text-primary">{selectedAccounts.length}</span> account(s) selected.
                      If one gets blocked, the system will fallback to the next.
                    </p>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={confirmRunScript}
              disabled={selectedAccounts.length === 0}
              className="w-full py-3 bg-success text-success-foreground font-bold rounded-[10px] shadow-sm hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none transition"
            >
              Start Campaign Now
            </button>
          </div>
        </div>
      )}

      {/* Add Account Modal (Shared with Dashboard essentially) */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card rounded-[16px] border border-border p-6 w-full max-w-md shadow-2xl relative animate-in zoom-in-95">
            <button 
              onClick={() => setShowAddAccountModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">{editingAccountId ? "Edit Facebook Account" : "Add Facebook Account"}</h3>
            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Email</label>
                <input 
                  type="email" required
                  value={newAccEmail} onChange={(e) => setNewAccEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-border bg-transparent rounded-lg text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" 
                  placeholder="name@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Password</label>
                <input 
                  type="password"
                  value={newAccPassword} onChange={(e) => setNewAccPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-border bg-transparent rounded-lg text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" 
                  placeholder="Optional (for auto-login)"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Cookies JSON</label>
                <textarea 
                  value={newAccCookies} onChange={(e) => setNewAccCookies(e.target.value)}
                  className="w-full px-3 py-2 border border-border bg-transparent rounded-lg text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono text-xs" 
                  rows={4} placeholder="[ { ... } ]"
                />
              </div>
              <button 
                type="submit" disabled={addingAccount}
                className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-[10px] text-sm"
              >
                {addingAccount ? "Saving..." : "Save Account"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
