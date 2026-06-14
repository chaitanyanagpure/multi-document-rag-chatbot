"use client";

import React from "react";

export default function TypingIndicator() {
  return (
    <div className="flex gap-4 p-4 bg-slate-900/40 border-y border-slate-800/60 w-full">
      {/* Bot Icon */}
      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20 text-xs">
          AI
        </div>
      </div>

      {/* Typing Bubble */}
      <div className="flex flex-col gap-2 justify-center">
        <span className="text-xs font-semibold text-slate-500">VerbaFlow AI is thinking</span>
        <div className="flex items-center gap-1.5 py-1 px-2 rounded-full bg-slate-800/40 border border-slate-700/30 w-fit">
          <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  );
}
