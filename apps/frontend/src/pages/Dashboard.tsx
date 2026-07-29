import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../utils/api";
import { 
  Activity, 
  Layers, 
  Users, 
  ArrowRight,
  PieChart,
  TrendingUp,
  BarChart2
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Legend
} from 'recharts';

interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  totalAccounts: number;
  validAccounts: number;
  postsTimeline: { date: string; posts: number }[];
  jobStatusDistribution: { name: string; value: number }[];
}

const COLORS = ['#2563eb', '#16a34a', '#eab308', '#dc2626', '#0ea5e9', '#64748b'];

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = async () => {
    try {
      const res = await api.get("/api/stats/dashboard");
      setStats(res.data);
    } catch (err) {
      console.error("Error fetching dashboard stats", err);
      setError("Failed to load dashboard data. Please make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-primary">
          <Activity className="w-8 h-8 animate-bounce" />
          <p className="text-slate-500 font-semibold animate-pulse">Loading Analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl">
        <h3 className="font-bold text-lg mb-2">Error Loading Dashboard</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Analytics Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            System performance and scraping metrics at a glance.
          </p>
        </div>
        <Link 
          to="/overview"
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-[10px] font-bold shadow-sm hover:opacity-90 transition flex items-center gap-2"
        >
          <TrendingUp className="w-4 h-4" />
          New Job
        </Link>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-card border border-border p-6 rounded-xl shadow-sm flex items-center gap-5">
          <div className="p-4 bg-primary/10 rounded-xl text-primary">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total Scrapes</p>
            <h3 className="text-2xl font-bold mt-1">{stats.totalJobs}</h3>
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-xl shadow-sm flex items-center gap-5">
          <div className="p-4 bg-info/10 rounded-xl text-info">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Active Jobs</p>
            <h3 className="text-2xl font-bold mt-1">{stats.activeJobs}</h3>
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-xl shadow-sm flex items-center gap-5">
          <div className="p-4 bg-success/10 rounded-xl text-success">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">FB Accounts</p>
            <h3 className="text-2xl font-bold mt-1">{stats.validAccounts} / {stats.totalAccounts} Valid</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Posts Timeline Chart */}
        <div className="bg-card border border-border shadow-sm rounded-xl p-6 md:p-8">
          <div className="flex items-center gap-2 mb-6">
            <BarChart2 className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold">Posts Scraped (Last 7 Days)</h2>
          </div>
          
          <div className="h-72 w-full">
            {stats.postsTimeline && stats.postsTimeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.postsTimeline} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8" 
                    fontSize={12}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return `${d.getDate()}/${d.getMonth()+1}`;
                    }} 
                  />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="posts" 
                    stroke="var(--color-primary)" 
                    strokeWidth={3}
                    dot={{ fill: 'var(--color-primary)', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, strokeWidth: 0 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                No data available for the last 7 days.
              </div>
            )}
          </div>
        </div>

        {/* Job Status Distribution */}
        <div className="bg-card border border-border shadow-sm rounded-xl p-6 md:p-8">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className="w-6 h-6 text-success" />
            <h2 className="text-xl font-bold">Jobs by Status</h2>
          </div>
          
          <div className="h-72 w-full flex justify-center">
            {stats.jobStatusDistribution && stats.jobStatusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={stats.jobStatusDistribution.map((entry, index) => ({
                      ...entry,
                      fill: COLORS[index % COLORS.length]
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    formatter={(value) => <span className="text-slate-600 dark:text-slate-300 font-semibold uppercase text-xs ml-1">{value}</span>}
                  />
                </RePieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                No job data available.
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex justify-center mt-4">
        <Link 
          to="/jobs" 
          className="flex items-center gap-2 text-primary font-semibold hover:underline"
        >
          View detailed job history <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};
