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
    { step_order: 1, group_url: "", max_posts: 50 }
  ]);

  const [saving, setSaving] = useState(false);
  const [executingIds, setExecutingIds] = useState<string[]>([]);
  
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [scriptsRes, execsRes] = await Promise.all([
        api.get("/api/scripts"),
        api.get("/api/scripts/executions")
      ]);
      setScripts(scriptsRes.data);
      setExecutions(execsRes.data);
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
    setNewSteps([...newSteps, { step_order: newSteps.length + 1, group_url: "", max_posts: 50 }]);
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
    setNewSteps([{ step_order: 1, group_url: "", max_posts: 50 }]);
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

  const handleRunScript = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExecutingIds(prev => [...prev, id]);
    try {
      const res = await api.post(`/api/scripts/${id}/execute`);
      // Trigger extension via frontend-connector
      window.postMessage({
        type: "FB_SCRAPER_START_CAMPAIGN",
        payload: {
          executionId: res.data.execution._id,
          scriptDetails: res.data.script,
          fbAccount: res.data.fbAccount,
          token: localStorage.getItem("token")
        }
      }, "*");
      
      fetchData();
    } catch (err) {
      alert("Failed to execute script");
    } finally {
      setExecutingIds(prev => prev.filter(x => x !== id));
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
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/25 flex items-center gap-2 transition"
        >
          {isCreating ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isCreating ? "Cancel" : "Create New Script"}
        </button>
      </div>

      {/* Dashboard Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/40 p-5 rounded-2xl shadow-sm">
          <p className="text-sm font-semibold text-slate-500 mb-1">Total Scripts</p>
          <p className="text-3xl font-black">{scripts.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/40 p-5 rounded-2xl shadow-sm">
          <p className="text-sm font-semibold text-slate-500 mb-1">Total Executions</p>
          <p className="text-3xl font-black">{executions.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/40 p-5 rounded-2xl shadow-sm">
          <p className="text-sm font-semibold text-slate-500 mb-1">Active Runs</p>
          <p className="text-3xl font-black text-blue-600 dark:text-blue-400">{activeExecutions.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/40 p-5 rounded-2xl shadow-sm">
          <p className="text-sm font-semibold text-slate-500 mb-1">Success Rate</p>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{successRate}%</p>
        </div>
      </div>

      {isCreating && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/40 p-6 rounded-2xl shadow-xl shadow-slate-100/50 dark:shadow-none space-y-6">
          <h2 className="text-xl font-bold">{editScriptId ? "Edit Script" : "New Script Builder"}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold mb-1">Campaign Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="E.g., Daily Competitor Check"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Description (Optional)</label>
              <input
                type="text"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Scrape multiple target groups"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-md font-bold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2">Execution Steps</h3>
            {newSteps.map((step, index) => (
              <div key={index} className="flex flex-col md:flex-row gap-3 items-start md:items-end bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold mb-1 text-slate-500">Step {step.step_order}: Target URL</label>
                  <input
                    type="text"
                    value={step.group_url}
                    onChange={e => handleStepChange(index, "group_url", e.target.value)}
                    placeholder="https://facebook.com/groups/..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
                  />
                </div>
                <div className="w-full md:w-24">
                  <label className="block text-xs font-bold mb-1 text-slate-500">Max Posts</label>
                  <input
                    type="number"
                    value={step.max_posts}
                    onChange={e => handleStepChange(index, "max_posts", parseInt(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
                  />
                </div>
                <div className="w-full md:w-32">
                  <label className="block text-xs font-bold mb-1 text-slate-500">Keyword Filter</label>
                  <input
                    type="text"
                    value={step.keyword_filter || ""}
                    onChange={e => handleStepChange(index, "keyword_filter", e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
                  />
                </div>
                <button
                  onClick={() => handleRemoveStep(index)}
                  disabled={newSteps.length === 1}
                  className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-900/50 transition disabled:opacity-50"
                  title="Remove Step"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
            
            <button
              onClick={handleAddStep}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg dark:bg-violet-900/20 dark:hover:bg-violet-900/40 dark:text-violet-400 transition"
            >
              <Plus className="w-4 h-4" /> Add Step
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              onClick={handleSaveScript}
              disabled={saving}
              className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-lg transition flex items-center gap-2"
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
                  className={`bg-white dark:bg-slate-900 border rounded-xl p-5 shadow-sm cursor-pointer transition-all ${
                    selectedScriptId === script.id 
                      ? "border-violet-500 ring-1 ring-violet-500 dark:border-violet-500 shadow-md" 
                      : "border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-800"
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
                        className="p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 transition"
                        title="Edit Script"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleRunScript(script.id, e)}
                        disabled={executingIds.includes(script.id)}
                        className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 transition"
                        title="Run Script"
                      >
                        {executingIds.includes(script.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                      </button>
                      <button
                        onClick={(e) => handleDeleteScript(script.id, e)}
                        className="p-2 rounded-lg bg-slate-50 text-slate-500 hover:text-rose-600 dark:bg-slate-800 dark:hover:text-rose-400 transition"
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
                          <span key={i} className="px-2 py-1 text-[10px] font-bold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 truncate max-w-[150px]" title={s.group_url}>
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
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center text-center">
              <Database className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">Select a script to view its execution history</p>
            </div>
          ) : filteredExecutions.length === 0 ? (
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center text-center">
              <p className="text-slate-500">No executions yet for this script.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredExecutions.map(exec => (
                <div key={exec.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm text-sm">
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
                      exec.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                      exec.status === "failed" ? "bg-rose-100 text-rose-700" :
                      exec.status === "running" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
                    }`}>
                      {exec.status.toUpperCase()}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      Step {exec.current_step} / {exec.total_steps}
                    </span>
                    {exec.status !== 'pending' && (
                       <Link 
                         to={`/scripts/executions/${exec.id}`} 
                         className="ml-auto text-xs font-bold text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1 rounded-md transition"
                       >
                         View Data & Sync
                       </Link>
                    )}
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mb-3">
                    <div className="bg-blue-500 h-full transition-all" style={{ width: `${exec.progress}%` }}></div>
                  </div>
                  <div className="bg-slate-900 dark:bg-black rounded-lg p-3 max-h-32 overflow-y-auto font-mono text-[10px] text-emerald-400 whitespace-pre-wrap">
                    {exec.logs || "Waiting for logs..."}
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
