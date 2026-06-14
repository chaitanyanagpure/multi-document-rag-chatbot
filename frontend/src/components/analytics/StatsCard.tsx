"use client";

import React, { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import Card from "@/components/ui/Card";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  loading?: boolean;
}

export default function StatsCard({ title, value, icon, description, trend, loading }: StatsCardProps) {
  return (
    <Card className="glass-card bg-slate-900/40 border-slate-800/80 p-5 flex flex-col justify-between h-[130px]">
      {loading ? (
        <div className="w-full h-full flex flex-col justify-between animate-pulse">
          <div className="flex justify-between items-start">
            <div className="h-4 bg-slate-800 rounded w-2/3" />
            <div className="w-8 h-8 bg-slate-800 rounded-lg" />
          </div>
          <div className="h-8 bg-slate-800 rounded w-1/2" />
        </div>
      ) : (
        <>
          <div className="flex justify-between items-start gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/10 flex-shrink-0">
              {icon}
            </div>
          </div>
          
          <div className="space-y-1 mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-100 tracking-tight">{value}</span>
              {trend && (
                <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  trend.isPositive
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10"
                    : "bg-red-500/10 text-red-400 border border-red-500/10"
                }`}>
                  {trend.isPositive ? <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" /> : <ArrowDownRight className="w-2.5 h-2.5 mr-0.5" />}
                  {trend.value}%
                </span>
              )}
            </div>
            {description && (
              <p className="text-[10px] text-slate-500 truncate">{description}</p>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
