"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  TrendingUp,
  Users,
  Activity,
  Cpu,
  Coins,
  Search,
  FileText,
  Clock,
  CheckCircle,
  AlertOctagon
} from "lucide-react";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import StatsCard from "@/components/analytics/StatsCard";
import {
  DailyQueriesChart,
  TokenUsageChart,
  LatencyHistogram
} from "@/components/analytics/Charts";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [queriesData, setQueriesData] = useState<any[]>([]);
  const [tokensData, setTokensData] = useState<any[]>([]);
  const [latencyData, setLatencyData] = useState<any[]>([]);
  const [topDocs, setTopDocs] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState(30);

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      try {
        const ov = await api.analytics.getOverview();
        setOverview(ov);

        const qr = await api.analytics.getQueries(timeRange);
        setQueriesData(qr);

        const tk = await api.analytics.getTokens(timeRange);
        setTokensData(tk);

        const lt = await api.analytics.getLatency(7); // default 7 days for latency
        setLatencyData(lt);

        const docList = await api.analytics.getDocuments(5); // top 5 docs
        setTopDocs(docList);
      } catch (err) {
        console.error("Failed to load analytics data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-64px)] bg-[#0F0F1A]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-[#0F0F1A] min-h-[calc(100vh-64px)] text-slate-100">
      {/* 1. Header with Range Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            Enterprise Analytics
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Audit API load indicators, system latency distributions, and total token usage costs.
          </p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(Number(e.target.value))}
          className="text-xs bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
        >
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
          <option value={90}>Last 90 Days</option>
        </select>
      </div>

      {/* 2. Stats cards row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Queries"
          value={overview?.total_queries || 0}
          icon={<Search className="w-4 h-4" />}
          description="Total natural language user prompts"
          trend={{ value: 12.3, isPositive: true }}
        />
        <StatsCard
          title="Active Users"
          value={overview?.active_users || 0}
          icon={<Users className="w-4 h-4" />}
          description="Seats configured in organization"
          trend={{ value: 4.8, isPositive: true }}
        />
        <StatsCard
          title="Avg Latency"
          value={`${((overview?.avg_response_time_ms || 0) / 1000).toFixed(2)}s`}
          icon={<Clock className="w-4 h-4" />}
          description="Average end-to-end token response"
          trend={{ value: 8.5, isPositive: false }}
        />
        <StatsCard
          title="Telemetry Budget"
          value={`$${overview?.estimated_cost_usd?.toFixed(2) || "0.00"}`}
          icon={<Coins className="w-4 h-4" />}
          description={`Based on ${overview?.total_tokens?.toLocaleString() || 0} tokens`}
          trend={{ value: 14.2, isPositive: true }}
        />
      </div>

      {/* 3. Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Queries Chart */}
        <Card className="glass-card bg-slate-900/30 border-slate-800/80 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Query Traffic</h3>
            <span className="text-[10px] text-slate-500">Queries / Day</span>
          </div>
          <DailyQueriesChart data={queriesData} />
        </Card>

        {/* Token Usage Chart */}
        <Card className="glass-card bg-slate-900/30 border-slate-800/80 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Token Expenditures</h3>
            <span className="text-[10px] text-slate-500">Input/Output tokens</span>
          </div>
          <TokenUsageChart data={tokensData} />
        </Card>
      </div>

      {/* 4. Secondary Telemetry row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latency Histogram */}
        <Card className="glass-card bg-slate-900/30 border-slate-800/80 p-5 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Latency Distribution</h3>
            <span className="text-[10px] text-slate-500">Response counts per bucket</span>
          </div>
          <LatencyHistogram data={latencyData} />
        </Card>

        {/* Top Referenced Documents */}
        <Card className="glass-card bg-slate-900/30 border-slate-800/80 p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Top Indexed References</h3>
          <div className="space-y-3">
            {topDocs.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-10">No citations references recorded.</p>
            ) : (
              topDocs.map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs p-2.5 bg-slate-900/60 border border-slate-850 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                    <span className="truncate max-w-[150px] text-slate-300 font-medium">{doc.name}</span>
                  </div>
                  <span className="text-[10px] bg-slate-850 text-slate-400 font-semibold px-2 py-0.5 rounded-full border border-slate-800">
                    {doc.citations} citations
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
