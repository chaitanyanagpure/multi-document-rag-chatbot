"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, File, AlertCircle, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";

interface FileUploadZoneProps {
  onFilesSelect: (files: File[]) => void;
  maxSizeMB?: number;
  allowedTypes?: string[];
}

export default function FileUploadZone({
  onFilesSelect,
  maxSizeMB = 50,
  allowedTypes = ["pdf", "docx", "doc", "txt", "csv", "xlsx", "xls", "pptx", "ppt", "html", "md"]
}: FileUploadZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = (files: File[]): File[] => {
    setError(null);
    const valid: File[] = [];
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    const allowedSet = new Set(allowedTypes.map(t => t.toLowerCase()));

    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!allowedSet.has(ext)) {
        setError(`Unsupported file type: .${ext}. Only ${allowedTypes.join(", ")} are supported.`);
        continue;
      }
      if (file.size > maxSizeBytes) {
        setError(`File exceeds max size of ${maxSizeMB}MB: ${file.name}`);
        continue;
      }
      valid.push(file);
    }
    return valid;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      const validFiles = validateFiles(droppedFiles);
      if (validFiles.length > 0) {
        const updated = [...selectedFiles, ...validFiles];
        setSelectedFiles(updated);
        onFilesSelect(updated);
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const chosenFiles = Array.from(e.target.files);
      const validFiles = validateFiles(chosenFiles);
      if (validFiles.length > 0) {
        const updated = [...selectedFiles, ...validFiles];
        setSelectedFiles(updated);
        onFilesSelect(updated);
      }
    }
  };

  const removeFile = (idx: number) => {
    const updated = selectedFiles.filter((_, i) => i !== idx);
    setSelectedFiles(updated);
    onFilesSelect(updated);
    setError(null);
  };

  const browseFiles = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Drag area */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={browseFiles}
        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
          isDragActive
            ? "border-indigo-500 bg-indigo-500/10 scale-[0.99]"
            : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInput}
          className="hidden"
          accept={allowedTypes.map(t => `.${t}`).join(",")}
        />

        <UploadCloud className={`w-12 h-12 mb-3 transition-transform ${isDragActive ? "text-indigo-400 scale-110" : "text-slate-500"}`} />
        
        <p className="text-sm font-semibold text-slate-300 text-center">
          Drag & drop files here, or <span className="text-indigo-400 hover:text-indigo-300">browse</span>
        </p>
        <p className="text-[11px] text-slate-500 mt-1.5 text-center">
          Supports PDF, DOCX, CSV, MD, XLSX, PPTX, HTML up to {maxSizeMB}MB
        </p>
      </div>

      {/* Error alert */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-950/20 border border-red-900/40 rounded-lg text-xs text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* File List */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Selected Files</h4>
          <div className="max-h-[200px] overflow-y-auto space-y-1.5 pr-1.5 scrollbar-thin">
            {selectedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 bg-slate-900/60 border border-slate-800/80 rounded-lg text-xs text-slate-300"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <File className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <span className="truncate max-w-[240px] font-medium">{file.name}</span>
                  <span className="text-[10px] text-slate-500">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
