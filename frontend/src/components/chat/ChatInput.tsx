"use client";

import React, { useRef, useEffect, useState } from "react";
import { Send, ArrowUp, Eraser } from "lucide-react";
import Button from "@/components/ui/Button";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onClear?: () => void;
}

export default function ChatInput({ onSend, disabled, placeholder = "Ask a question...", onClear }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (value.trim() && !disabled) {
      onSend(value.trim());
      setValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-3 bg-slate-900/80 border border-slate-800 rounded-xl glass-card items-end relative shadow-2xl">
      {onClear && (
        <Button
          type="button"
          variant="icon"
          onClick={onClear}
          disabled={disabled}
          title="Clear Conversation"
          className="text-slate-500 hover:text-red-400 p-2 border border-slate-800/40 rounded-lg hover:bg-slate-800/40 transition-colors self-end"
        >
          <Eraser className="w-4 h-4" />
        </Button>
      )}

      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-grow bg-transparent border-0 focus:ring-0 resize-none text-slate-200 text-sm max-h-[200px] outline-none py-2 px-1 placeholder-slate-500 min-w-0"
      />

      <Button
        type="submit"
        disabled={disabled || !value.trim()}
        className={`p-2.5 rounded-lg flex items-center justify-center transition-all ${
          value.trim() && !disabled
            ? "bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20"
            : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/30"
        }`}
      >
        <ArrowUp className="w-4 h-4" />
      </Button>
    </form>
  );
}
