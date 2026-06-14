"use client";

import React from "react";
import { Citation } from "@/types";
import { FileText, ArrowUpRight } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";

interface CitationCardProps {
  citation: Citation;
  onClick?: () => void;
}

export default function CitationCard({ citation, onClick }: CitationCardProps) {
  const score = citation.similarity_score || citation.relevance_score || 0;
  const percentageScore = Math.round(score * 100);

  // Determine variant based on score
  let badgeVariant: "success" | "warning" | "error" | "info" = "info";
  if (score >= 0.8) badgeVariant = "success";
  else if (score >= 0.6) badgeVariant = "info";
  else if (score >= 0.4) badgeVariant = "warning";
  else badgeVariant = "error";

  return (
    <Card
      onClick={onClick}
      hover
      className={`glass-card p-3 border-slate-800/80 bg-slate-900/60 flex flex-col justify-between cursor-pointer ${
        onClick ? "hover:border-indigo-500/50 hover:bg-slate-900/80" : ""
      }`}
    >
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <FileText className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-slate-200 truncate" title={citation.doc_name}>
              {citation.doc_name}
            </span>
          </div>
          <Badge variant={badgeVariant} className="text-[10px] py-0 px-1.5 flex-shrink-0">
            {percentageScore}% Match
          </Badge>
        </div>

        {/* Excerpt */}
        <p className="text-[11px] text-slate-400 line-clamp-3 leading-normal italic">
          "{citation.excerpt}"
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/40 text-[10px] text-slate-500">
        <span>
          {citation.page_number !== null && citation.page_number !== undefined
            ? `Page ${citation.page_number}`
            : `Chunk #${citation.chunk_index}`}
        </span>
        {onClick && (
          <span className="flex items-center gap-0.5 text-indigo-400 hover:text-indigo-300">
            View full text <ArrowUpRight className="w-2.5 h-2.5" />
          </span>
        )}
      </div>
    </Card>
  );
}
