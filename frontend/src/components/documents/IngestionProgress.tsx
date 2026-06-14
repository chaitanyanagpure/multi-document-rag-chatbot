"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, Loader2, AlertCircle, Clock, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { formatBytes } from "@/lib/utils";

interface IngestionProgressProps {
  fileName: string;
  fileSize: number;
  progress: number; // network progress 0-100
  step: number; // 1-10
  status: string;
  stage?: string;
  error?: string | null;
}

const STEP_INFOS = [
  { step: 1, label: "Document Upload", desc: "Uploading file to server", duration: 5 },
  { step: 2, label: "Virus Scan", desc: "Scanning document for malware", duration: 2 },
  { step: 3, label: "Text Extraction", desc: "Parsing text from document", duration: 5 },
  { step: 4, label: "Text Cleaning", desc: "Sanitizing whitespace & layout", duration: 1 },
  { step: 5, label: "Metadata Extraction", desc: "Extracting document properties", duration: 1 },
  { step: 6, label: "Chunking", desc: "Splitting text into segments", duration: 3 },
  { step: 7, label: "Embedding Generation", desc: "Creating dense search vectors", duration: 10 },
  { step: 8, label: "Vector DB Storage", desc: "Saving vectors in index partition", duration: 3 },
  { step: 9, label: "Index Validation", desc: "Testing query recall checks", duration: 1 },
  { step: 10, label: "Finalizing KB", desc: "Updating stats & BM25 sparse index", duration: 2 }
];

export default function IngestionProgress({
  fileName,
  fileSize,
  progress,
  step,
  status,
  stage,
  error
}: IngestionProgressProps) {
  const [showTimeline, setShowTimeline] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);

  const isFailed = status === "failed";
  const isReady = status === "ready";

  // Calculate base overall percentage
  const getOverallPct = () => {
    if (isFailed) return 0;
    if (isReady) return 100;

    const STAGES_PCT: Record<number, number> = {
      1: 10,  // Uploading
      2: 15,  // Virus Scan
      3: 30,  // Text Extraction
      4: 40,  // Cleaning
      5: 45,  // Metadata
      6: 55,  // Chunking
      7: 75,  // Embedding
      8: 85,  // Storing
      9: 90,  // Validating
      10: 95, // Finalizing
    };

    if (step === 1) {
      return Math.round((progress / 100) * 10);
    }
    return STAGES_PCT[step] || 5;
  };

  const pct = getOverallPct();

  // Get current stage label
  const getStageLabel = () => {
    if (isFailed) return "Failed";
    if (isReady) return "Completed";
    if (stage) {
      if (stage === "ready") return "Completed";
      if (stage === "failed") return "Failed";
      return stage;
    }
    if (step === 1) return `Uploading`;
    if (step === 2) return `Uploading`;
    if (step >= 3 && step <= 5) return "Extracting Text";
    if (step === 6) return "Chunking";
    if (step === 7) return "Generating Embeddings";
    if (step === 8 || step === 9) return "Saving Vectors";
    if (step === 10) return "Updating Knowledge Base";
    return "Uploading";
  };

  // Get badge variant
  const getBadgeDetails = () => {
    if (isFailed) return { text: "Failed", color: "bg-red-500/10 text-red-400 border border-red-500/20" };
    if (isReady) return { text: "Indexed", color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" };
    if (step === 1) return { text: "Pending", color: "bg-blue-500/10 text-blue-400 border border-blue-500/20" };
    return { text: "Processing", color: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" };
  };

  const badge = getBadgeDetails();

  // Handle countdown remaining time
  useEffect(() => {
    if (isReady || isFailed) {
      setCountdown(0);
      return;
    }

    // calculate total remaining duration
    let totalSecs = 0;
    for (let i = step - 1; i < STEP_INFOS.length; i++) {
      totalSecs += STEP_INFOS[i].duration;
    }
    
    // adjust if uploading
    if (step === 1) {
      const remainingUploadPct = 1 - (progress / 100);
      totalSecs = Math.round(remainingUploadPct * STEP_INFOS[0].duration) + totalSecs - STEP_INFOS[0].duration;
    }

    setCountdown(Math.max(1, totalSecs));
  }, [step, progress, isReady, isFailed]);

  // Tick down the countdown timer
  useEffect(() => {
    if (countdown <= 1) return;
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(1, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  return (
    <div className="p-4 bg-slate-950/60 border border-slate-900 rounded-xl space-y-4 shadow-xl glass-card transition-all duration-300">
      {/* File Header Info */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-indigo-500/10 rounded-lg flex-shrink-0">
            <FileText className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-slate-200 truncate max-w-[200px]" title={fileName}>
              {fileName}
            </h4>
            <p className="text-[10px] text-slate-500 mt-0.5">{formatBytes(fileSize)}</p>
          </div>
        </div>
        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${badge.color}`}>
          {badge.text}
        </span>
      </div>

      {/* Progress & Status Indicators */}
      <div className="space-y-2">
        <div className="flex justify-between items-end text-xs">
          <span className="font-medium text-slate-300">{getStageLabel()}</span>
          <span className="font-bold text-indigo-400">{pct}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800/40">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              isFailed
                ? "bg-red-500"
                : isReady
                ? "bg-emerald-500"
                : "bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 animate-shimmer bg-[length:200%_auto]"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Estimates & Details */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
          <div className="flex items-center gap-1">
            {!isReady && !isFailed && countdown > 0 && (
              <>
                <Clock className="w-3 h-3 text-slate-500" />
                <span>Approx. {countdown}s remaining</span>
              </>
            )}
            {isReady && <span className="text-emerald-400">Ingestion complete</span>}
            {isFailed && <span className="text-red-400">Failed at Step {step}</span>}
          </div>
          
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className="flex items-center gap-1 hover:text-slate-300 transition-colors"
          >
            <span>Timeline</span>
            {showTimeline ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {isFailed && error && (
        <div className="flex items-start gap-2 p-3 bg-red-950/20 border border-red-900/30 rounded-lg text-[10px] text-red-400 animate-shake">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* Collapsible steps timeline */}
      {showTimeline && (
        <div className="pt-3 border-t border-slate-900/80 space-y-2.5 animate-slide-down">
          {STEP_INFOS.map((item) => {
            const stepCompleted = step > item.step || isReady;
            const stepActive = step === item.step && !isReady && !isFailed;
            const stepFailed = isFailed && step === item.step;

            let dotColor = "bg-slate-900 border-slate-800";
            let textColor = "text-slate-600";
            let icon = null;

            if (stepCompleted) {
              dotColor = "bg-emerald-500/10 border-emerald-500/30";
              textColor = "text-slate-400";
              icon = <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />;
            } else if (stepActive) {
              dotColor = "bg-indigo-500/20 border-indigo-500/40 ring-2 ring-indigo-500/10";
              textColor = "text-slate-200 font-medium";
              icon = <Loader2 className="w-3 h-3 text-indigo-400 animate-spin flex-shrink-0" />;
            } else if (stepFailed) {
              dotColor = "bg-red-500/10 border-red-500/30";
              textColor = "text-red-400";
              icon = <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />;
            }

            return (
              <div key={item.step} className="flex items-start gap-2.5 text-[10px]">
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[8px] font-bold ${dotColor}`}>
                  {icon ? null : item.step}
                  {icon}
                </div>
                <div className="min-w-0 flex-grow">
                  <div className={`flex justify-between ${textColor}`}>
                    <span>{item.label}</span>
                    {stepActive && <span className="text-[8px] text-indigo-400 animate-pulse font-normal">Active</span>}
                  </div>
                  <p className="text-[9px] text-slate-600 mt-0.5 truncate">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
