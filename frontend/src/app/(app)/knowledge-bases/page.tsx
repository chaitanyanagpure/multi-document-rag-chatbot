"use client";

import React, { useEffect, useState } from "react";
import { useKBStore } from "@/lib/store";
import { api } from "@/lib/api";
import { KnowledgeBase } from "@/types";
import { Database, Plus, Trash2, Edit2, ArrowRight, Folder, FileText, Settings, ShieldAlert } from "lucide-react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Modal, { ConfirmDialog } from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import { formatBytes } from "@/lib/utils";

export default function KnowledgeBasesPage() {
  const { knowledgeBases, setKnowledgeBases } = useKBStore();
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [kbToDelete, setKbToDelete] = useState<string | null>(null);

  // Load KBs
  useEffect(() => {
    async function loadKBs() {
      try {
        const list = await api.knowledgeBases.list();
        setKnowledgeBases(list);
      } catch (err) {
        console.error("Failed to load knowledge bases:", err);
      } finally {
        setLoading(false);
      }
    }
    loadKBs();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || submitting) return;

    setSubmitting(true);
    try {
      const newKB = await api.knowledgeBases.create({
        name: newName.trim(),
        description: newDesc.trim(),
        settings_json: {
          chunk_size: 1000,
          chunk_overlap: 200,
          chunking_strategy: "recursive",
        }
      });
      setKnowledgeBases([newKB, ...knowledgeBases]);
      setIsModalOpen(false);
      setNewName("");
      setNewDesc("");
    } catch (err) {
      console.error("Failed to create knowledge base:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setKbToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!kbToDelete) return;
    const id = kbToDelete;
    setDeleteModalOpen(false);
    setKbToDelete(null);
    try {
      await api.knowledgeBases.delete(id);
      setKnowledgeBases(knowledgeBases.filter(kb => kb.id !== id));
    } catch (err) {
      console.error("Failed to delete knowledge base:", err);
    }
  };

  // Aggregated totals
  const totalKBs = knowledgeBases.length;
  const totalDocs = knowledgeBases.reduce((acc, kb) => acc + (kb.document_count || 0), 0);
  const totalSize = knowledgeBases.reduce((acc, kb) => acc + (kb.total_size_bytes || 0), 0);

  return (
    <div className="p-6 space-y-6 bg-[#0F0F1A] min-h-[calc(100vh-64px)] text-slate-100">
      {/* 1. Header with stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-400" />
            Knowledge Bases
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Organize collections of documents into distinct semantic indexes for prompt scopes.
          </p>
        </div>
        <Button variant="primary" className="flex items-center gap-1.5 text-xs py-2" onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4" /> Create Knowledge Base
        </Button>
      </div>

      {/* Aggregate stats summary bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card bg-slate-900/40 p-4 border-slate-800/80 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Folder className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Collections</span>
            <p className="text-xl font-bold text-slate-200 mt-0.5">{totalKBs}</p>
          </div>
        </Card>
        <Card className="glass-card bg-slate-900/40 p-4 border-slate-800/80 flex items-center gap-4">
          <div className="p-3 bg-violet-500/10 text-violet-400 rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Indexed Documents</span>
            <p className="text-xl font-bold text-slate-200 mt-0.5">{totalDocs}</p>
          </div>
        </Card>
        <Card className="glass-card bg-slate-900/40 p-4 border-slate-800/80 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Vector Storage Used</span>
            <p className="text-xl font-bold text-slate-200 mt-0.5">{formatBytes(totalSize)}</p>
          </div>
        </Card>
      </div>

      {/* 2. KB Grid List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : knowledgeBases.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl text-center space-y-4 max-w-md mx-auto mt-12">
          <Folder className="w-12 h-12 text-slate-600 animate-pulse" />
          <h3 className="text-sm font-semibold text-slate-300">No Knowledge Bases Found</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Create your first document index. You can then upload PDFs, text files, and spreadsheets to build your organizational assistant.
          </p>
          <Button variant="primary" className="text-xs flex items-center gap-1.5" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4" /> Create Now
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {knowledgeBases.map((kb) => (
            <Card key={kb.id} hover className="glass-card bg-slate-900/30 border-slate-800/80 p-5 flex flex-col justify-between h-[200px]">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-100 truncate max-w-[160px]">{kb.name}</h3>
                  <Badge variant={kb.is_active !== false ? "success" : "neutral"} className="text-[9px]">
                    {kb.is_active !== false ? "Active" : "Archived"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 line-clamp-3 leading-normal h-[54px]">
                  {kb.description || "No description provided."}
                </p>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800/40 text-[10px] text-slate-500">
                <div className="flex items-center gap-3">
                  <span>{kb.document_count || 0} files</span>
                  <span>{formatBytes(kb.total_size_bytes || 0)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteClick(kb.id)}
                    className="p-1 rounded text-slate-600 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <Link href={`/knowledge-bases/${kb.id}`}>
                    <Button className="py-1 px-2.5 rounded-lg text-[10px] bg-slate-800 border border-slate-700/50 text-slate-200 hover:bg-slate-700/60 flex items-center gap-1 font-semibold">
                      Manage <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 3. Create KB Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create Knowledge Base">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400">Collection Name</label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Finance Policies"
              className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400">Description</label>
            <textarea
              rows={3}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Provide context on what files are in this database..."
              className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setKbToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Knowledge Base"
        message="Are you sure you want to delete this Knowledge Base? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
      />
    </div>
  );
}
