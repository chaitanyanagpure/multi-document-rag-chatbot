"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useUIStore } from "@/lib/store";
import { KnowledgeBase, Document } from "@/types";
import { ArrowLeft, FileText, Trash2, ShieldAlert, Plus, Check, Loader2, Play } from "lucide-react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Modal, { ConfirmDialog } from "@/components/ui/Modal";
import Table from "@/components/ui/Table";
import Spinner from "@/components/ui/Spinner";
import FileUploadZone from "@/components/documents/FileUploadZone";
import IngestionProgress from "@/components/documents/IngestionProgress";
import { formatBytes, formatDate } from "@/lib/utils";

export default function KBDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const kbId = params.id as string;

  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Keep a mutable ref to always have fresh documents state in interval callbacks
  const documentsRef = useRef<Document[]>([]);
  
  // Upload & Ingestion Progress states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  interface UploadJob {
    id: string;
    fileName: string;
    fileSize: number;
    progress: number;
    step: number;
    status: string;
    stage?: string;
    error?: string | null;
  }

  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<{ id: string; fileSize: number } | null>(null);

  useEffect(() => {
    async function loadKBDetails() {
      try {
        const kbObj = await api.knowledgeBases.get(kbId);
        setKb(kbObj);
        
        const docs = await api.documents.list(kbId);
        documentsRef.current = docs;
        setDocuments(docs);
      } catch (err) {
        console.error("Failed to load KB details:", err);
        router.push("/knowledge-bases");
      } finally {
        setLoading(false);
      }
    }
    loadKBDetails();
  }, [kbId]);

  // Polling transient documents list every 3s
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    // Case-insensitive check for terminal states
    const isTerminal = (status: string) => {
      const s = status?.toUpperCase();
      return s === "READY" || s === "FAILED";
    };
    
    const hasTransientDocs = documents.some((doc) => !isTerminal(doc.status));
    
    if (hasTransientDocs) {
      intervalId = setInterval(async () => {
        try {
          const freshDocs = await api.documents.list(kbId);
          const prevDocs = documentsRef.current;
          
          // Trigger toasts for completions and failures
          freshDocs.forEach((newDoc) => {
            const oldDoc = prevDocs.find((d) => d.id === newDoc.id);
            if (oldDoc && oldDoc.status !== newDoc.status) {
              const { showSuccess, showError } = useUIStore.getState();
              const newStatus = newDoc.status?.toUpperCase();
              if (newStatus === "READY") {
                showSuccess("Ingestion Complete", "Document uploaded and indexed successfully.");
              } else if (newStatus === "FAILED") {
                showError("Ingestion Failed", `Document "${newDoc.name}" failed: ${newDoc.error_message || "Unknown error"}`);
              }
            }
          });
          
          documentsRef.current = freshDocs;
          setDocuments(freshDocs);
        } catch (err) {
          console.error("Error polling documents:", err);
        }
      }, 3000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [documents, kbId]);

  const handleUploadSubmit = async () => {
    if (selectedFiles.length === 0 || uploading) return;
    
    setUploading(true);
    const { showSuccess, showError, showInfo } = useUIStore.getState();
    showInfo("Ingestion Pipeline", `Starting upload and indexing for ${selectedFiles.length} file(s).`);

    // Create client-side job entries
    const newJobs: UploadJob[] = selectedFiles.map((file, idx) => ({
      id: `temp-${Date.now()}-${idx}`,
      fileName: file.name,
      fileSize: file.size,
      progress: 0,
      step: 1,
      status: "uploading",
      error: null
    }));

    setUploadJobs((prev) => [...prev, ...newJobs]);
    setIsUploadModalOpen(false); // Close upload selector modal

    selectedFiles.forEach(async (file, idx) => {
      const jobId = newJobs[idx].id;

      try {
        // Step 1: Upload via Axios with progress tracking
        const doc = await api.documents.upload(kbId, file, (progressEvent) => {
          const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadJobs((prev) =>
            prev.map((j) => (j.id === jobId ? { ...j, progress: pct } : j))
          );
        });

        // Upload success, assign real Doc ID
        setUploadJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? { ...j, id: doc.id, progress: 100, status: "upload_complete" }
              : j
          )
        );

        // Step 2: EventSource to track steps 2-10 in real-time
        const eventSource = api.documents.getStatus(doc.id, (progress) => {
          setUploadJobs((prev) =>
            prev.map((j) =>
              j.id === doc.id
                ? {
                    ...j,
                    step: progress.step,
                    status: progress.status,
                    stage: progress.stage,
                    error: progress.status === "failed" ? (progress.detail || "System processing error") : null
                  }
                : j
            )
          );
 
          if (progress.status?.toUpperCase() === "READY") {
            eventSource.close();
            showSuccess("Ingestion Complete", "Document uploaded and indexed successfully.");
            api.documents.list(kbId).then((docs) => { documentsRef.current = docs; setDocuments(docs); });
          } else if (progress.status?.toUpperCase() === "FAILED") {
            eventSource.close();
            showError("Ingestion Failed", `Document "${file.name}" failed: ${progress.detail || "Processing error"}`);
            api.documents.list(kbId).then((docs) => { documentsRef.current = docs; setDocuments(docs); });
          }
        });
      } catch (err: any) {
        console.error(`Upload error for ${file.name}:`, err);
        const errMsg = err.response?.data?.detail || "Connection interrupted during upload.";
        setUploadJobs((prev) =>
          prev.map((j) =>
            j.id === jobId ? { ...j, status: "failed", step: 0, error: errMsg } : j
          )
        );
        showError("Upload Failed", `Failed to upload "${file.name}": ${errMsg}`);
        api.documents.list(kbId).then((docs) => { documentsRef.current = docs; setDocuments(docs); });
      }
    });

    setSelectedFiles([]);
    setUploading(false);
  };

  const handleDeleteDoc = (docId: string, fileSize: number) => {
    setDocToDelete({ id: docId, fileSize });
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!docToDelete) return;
    const { id: docId, fileSize } = docToDelete;
    setDeleteModalOpen(false);
    setDocToDelete(null);
    try {
      await api.documents.delete(kbId, docId);
      setDocuments(documents.filter(d => d.id !== docId));
      if (kb) {
        setKb({
          ...kb,
          document_count: Math.max(0, (kb.document_count || 0) - 1),
          total_size_bytes: Math.max(0, (kb.total_size_bytes || 0) - fileSize)
        });
      }
      useUIStore.getState().showSuccess("Deleted Document", "Document cleared successfully.");
    } catch (err) {
      console.error("Failed to delete document:", err);
      useUIStore.getState().showError("Delete Failed", "Could not clear document. Try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-64px)] bg-[#0F0F1A]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-[#0F0F1A] min-h-[calc(100vh-64px)] text-slate-100">
      {/* 1. Breadcrumbs / Header */}
      <div className="flex flex-col gap-4">
        <Link href="/knowledge-bases" className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold w-fit">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Collections
        </Link>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              {kb?.name}
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">{kb?.description}</p>
          </div>
          <Button
            variant="primary"
            className="flex items-center gap-1.5 text-xs py-2"
            onClick={() => {
              setSelectedFiles([]);
              setIsUploadModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4" /> Upload Document
          </Button>
        </div>
      </div>

      {/* 1.5. Active Ingestion Progress Queue */}
      {uploadJobs.length > 0 && (
        <Card className="glass-card bg-slate-950/40 border-indigo-950/40 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              Active Ingestion Queue ({uploadJobs.filter(j => j.status !== 'ready' && j.status !== 'failed').length} processing)
            </h3>
            <button
              onClick={() => setUploadJobs([])}
              className="text-[10px] text-indigo-400/70 hover:text-indigo-300 transition-colors"
            >
              Clear Completed
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {uploadJobs.map((job) => (
              <IngestionProgress
                key={job.id}
                fileName={job.fileName}
                fileSize={job.fileSize}
                progress={job.progress}
                step={job.step}
                status={job.status}
                stage={job.stage}
                error={job.error}
              />
            ))}
          </div>
        </Card>
      )}

      {/* 2. Document Table List */}
      <Card className="glass-card bg-slate-900/30 border-slate-800/80 p-4">
        {documents.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-xs flex flex-col items-center justify-center space-y-3">
            <FileText className="w-10 h-10 text-slate-700 animate-pulse" />
            <p>No documents uploaded to this knowledge base collection yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Uploaded At</th>
                  <th className="py-3 px-4">Indexing Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const statusUpper = doc.status?.toUpperCase();
                  let statusBadge: "success" | "warning" | "error" | "info" | "neutral" = "info";
                  if (statusUpper === "READY") statusBadge = "success";
                  else if (statusUpper === "FAILED") statusBadge = "error";
                  else statusBadge = "warning";

                  // Human-readable status labels
                  const statusLabels: Record<string, string> = {
                    "UPLOADING": "uploading",
                    "SCANNING": "scanning",
                    "EXTRACTING": "extracting",
                    "CHUNKING": "chunking",
                    "EMBEDDING": "embedding",
                    "READY": "indexed ✓",
                    "FAILED": "failed ✗",
                  };
                  const displayStatus = statusLabels[statusUpper] ?? doc.status?.toLowerCase() ?? "unknown";

                  return (
                    <tr key={doc.id} className="border-b border-slate-850 hover:bg-slate-900/30 text-slate-300">
                      <td className="py-3.5 px-4 font-medium text-slate-200">{doc.name}</td>
                      <td className="py-3.5 px-4 uppercase">{doc.file_type}</td>
                      <td className="py-3.5 px-4">{formatBytes(doc.file_size)}</td>
                      <td className="py-3.5 px-4">{formatDate(doc.created_at || "")}</td>
                      <td className="py-3.5 px-4">
                        <Badge variant={statusBadge} className="py-0.5 px-2 text-[10px]">
                          {displayStatus}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteDoc(doc.id, doc.file_size)}
                          className="text-slate-500 hover:text-red-400 p-1.5 rounded transition-colors"
                          title="Delete Document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 3. Upload & Ingestion Progress Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Document"
      >
        <div className="space-y-6">
          <FileUploadZone onFilesSelect={setSelectedFiles} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setIsUploadModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleUploadSubmit}
              disabled={selectedFiles.length === 0}
            >
              Start Ingestion Pipeline
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDocToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Document"
        message="Are you sure you want to delete this document? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
      />
    </div>
  );
}
