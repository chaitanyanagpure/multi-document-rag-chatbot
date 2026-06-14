"use client";

import React, { useState } from "react";
import { Message, Citation } from "@/types";
import { FileText, ChevronDown, ChevronUp, CheckCircle, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import CitationCard from "./CitationCard";

interface MessageBubbleProps {
  message: Message;
  onCitationClick?: (citation: Citation) => void;
}

export default function MessageBubble({ message, onCitationClick }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [showCitations, setShowCitations] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  return (
    <div className={`flex w-full gap-4 p-4 ${isUser ? "flex-row-reverse" : "flex-row bg-slate-900/40 border-y border-slate-800/60"}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        <Avatar name={isUser ? "User" : "VerbaFlow AI"} />
      </div>

      {/* Message Content */}
      <div className="flex-grow max-w-4xl space-y-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">
            {isUser ? "You" : "VerbaFlow AI"}
          </span>
          <span className="text-xs text-slate-500">
            {new Date(message.created_at || Date.now()).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {!isUser && message.model_used && (
            <Badge variant="info" className="text-[10px] scale-90 origin-left">
              {message.model_used}
            </Badge>
          )}
          {!isUser && message.latency_ms && (
            <span className="text-[10px] text-slate-500">
              {((message.latency_ms) / 1000).toFixed(2)}s
            </span>
          )}
        </div>

        {/* Text Body */}
        <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed text-sm">
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown>{message.content}</ReactMarkdown>
          )}
        </div>

        {/* Citations section */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800/80">
            <button
              onClick={() => setShowCitations(!showCitations)}
              className="flex items-center gap-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{message.citations.length} Source Citations</span>
              {showCitations ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showCitations && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 animate-fade-in">
                {message.citations.map((citation, idx) => (
                  <CitationCard
                    key={citation.id || idx}
                    citation={citation}
                    onClick={() => onCitationClick?.(citation)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Diagnostics section */}
        {!isUser && message.diagnostics && (
          <div className="mt-3 pt-3 border-t border-slate-800/40">
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
              <span>Developer Diagnostics</span>
              {showDiagnostics ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showDiagnostics && (
              <div className="mt-3 p-4 bg-slate-950/60 border border-slate-900 rounded-xl space-y-4 font-mono text-[11px] text-slate-400 shadow-inner">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-600 block uppercase tracking-wider">Chunks Searched</span>
                    <span className="text-slate-300 font-bold">{message.diagnostics.retrieved_chunks_count} chunks</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-600 block uppercase tracking-wider">LLM Latency</span>
                    <span className="text-slate-300 font-bold">{((message.diagnostics.llm_latency_ms || 0) / 1000).toFixed(2)}s</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-600 block uppercase tracking-wider">Vector Latency</span>
                    <span className="text-slate-300 font-bold">{((message.diagnostics.vector_search_latency_ms || 0) / 1000).toFixed(2)}s</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-600 block uppercase tracking-wider">API Roundtrip</span>
                    <span className="text-slate-300 font-bold">{((message.diagnostics.api_response_time_ms || 0) / 1000).toFixed(2)}s</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 border-t border-slate-900/50 pt-3">
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-600 block uppercase tracking-wider">Prompt Tokens</span>
                    <span className="text-slate-300">{message.diagnostics.token_usage.prompt_tokens}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-600 block uppercase tracking-wider">Response Tokens</span>
                    <span className="text-slate-300">{message.diagnostics.token_usage.completion_tokens}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-600 block uppercase tracking-wider">Total Tokens</span>
                    <span className="text-slate-300 font-bold text-indigo-400">{message.diagnostics.token_usage.total_tokens}</span>
                  </div>
                </div>

                {message.diagnostics.similarity_scores && message.diagnostics.similarity_scores.length > 0 && (
                  <div className="border-t border-slate-900/50 pt-3 space-y-1">
                    <span className="text-[9px] text-slate-600 block uppercase tracking-wider">Similarity Rank Scores</span>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {message.diagnostics.similarity_scores.map((score, sIdx) => (
                        <span key={sIdx} className="bg-slate-900/80 px-2 py-0.5 rounded text-[10px] border border-slate-800 text-slate-300">
                          Chunk {sIdx + 1}: <span className="text-indigo-400 font-bold">{score.toFixed(4)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {message.diagnostics.error_stack_trace && (
                  <div className="border-t border-slate-900/50 pt-3 space-y-1.5">
                    <span className="text-[9px] text-red-500/80 block uppercase tracking-wider">Error Call Trace Log</span>
                    <pre className="p-3 bg-red-950/10 border border-red-900/20 rounded-lg overflow-x-auto text-[10px] text-red-400/90 leading-relaxed max-h-48 scrollbar-thin select-text">
                      {message.diagnostics.error_stack_trace}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
