"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { OrgSettings } from "@/types";
import { Settings, Cpu, Sliders, Shield, Save, Check } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Tab control
  const [activeTab, setActiveTab] = useState<"ai" | "retrieval" | "org">("ai");

  // Settings State
  const [settings, setSettings] = useState<Partial<OrgSettings>>({});

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await api.settings.get();
        setSettings(res);
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      const res = await api.settings.update(settings);
      setSettings(res);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
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
    <div className="p-6 space-y-6 bg-[#0F0F1A] min-h-[calc(100vh-64px)] text-slate-100 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            System Configurations
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure system RAG thresholds, model selections, and retrieval properties.
          </p>
        </div>
        
        {success && (
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg animate-fade-in">
            <Check className="w-4 h-4" /> Config saved!
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Navigation tabs */}
        <div className="flex gap-2 border-b border-slate-900 pb-px text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={`flex items-center gap-1.5 pb-2.5 px-1.5 border-b-2 font-semibold transition-colors ${
              activeTab === "ai"
                ? "border-indigo-500 text-indigo-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-350"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" /> AI Providers
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("retrieval")}
            className={`flex items-center gap-1.5 pb-2.5 px-1.5 border-b-2 font-semibold transition-colors ${
              activeTab === "retrieval"
                ? "border-indigo-500 text-indigo-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-350"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> Ingestion & Retrieval
          </button>
        </div>

        {/* Tab contents */}
        <Card className="glass-card bg-slate-900/30 border-slate-800/80 p-6">
          {activeTab === "ai" && (
            <div className="space-y-6">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Model Configuration</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* LLM Provider */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Large Language Model Provider</label>
                  <select
                    value={settings.llm_provider || "gemini"}
                    onChange={(e) => setSettings({ ...settings, llm_provider: e.target.value })}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  >
                    <option value="gemini">Google Gemini AI</option>
                    <option value="openai">OpenAI GPT</option>
                  </select>
                </div>

                {/* LLM Model Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Model Name</label>
                  <input
                    type="text"
                    value={settings.llm_model || ""}
                    onChange={(e) => setSettings({ ...settings, llm_model: e.target.value })}
                    placeholder="e.g. gemini-1.5-pro"
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  />
                </div>

                {/* Embedding Provider */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Vector Embeddings Provider</label>
                  <select
                    value={settings.embedding_provider || "google"}
                    onChange={(e) => setSettings({ ...settings, embedding_provider: e.target.value })}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  >
                    <option value="google">Google Generative AI</option>
                    <option value="openai">OpenAI Embeddings</option>
                  </select>
                </div>

                {/* Embedding Model Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Embeddings Model Name</label>
                  <input
                    type="text"
                    value={settings.embedding_model || ""}
                    onChange={(e) => setSettings({ ...settings, embedding_model: e.target.value })}
                    placeholder="e.g. models/text-embedding-004"
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "retrieval" && (
            <div className="space-y-6">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Retrieval Engine Properties</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Chunk Size */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-400">
                    <span>Chunk Size</span>
                    <span className="text-indigo-400 font-bold">{settings.chunk_size} tokens</span>
                  </div>
                  <input
                    type="range"
                    min={200}
                    max={2000}
                    step={100}
                    value={settings.chunk_size || 1000}
                    onChange={(e) => setSettings({ ...settings, chunk_size: Number(e.target.value) })}
                    className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                {/* Chunk Overlap */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-400">
                    <span>Chunk Overlap</span>
                    <span className="text-indigo-400 font-bold">{settings.chunk_overlap} tokens</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={500}
                    step={50}
                    value={settings.chunk_overlap || 200}
                    onChange={(e) => setSettings({ ...settings, chunk_overlap: Number(e.target.value) })}
                    className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                {/* Retrieval Count */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-400">
                    <span>Top K Retrieval Count</span>
                    <span className="text-indigo-400 font-bold">{settings.retrieval_count} chunks</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={15}
                    step={1}
                    value={settings.retrieval_count || 5}
                    onChange={(e) => setSettings({ ...settings, retrieval_count: Number(e.target.value) })}
                    className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                {/* Similarity Threshold */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-400">
                    <span>Similarity Threshold</span>
                    <span className="text-indigo-400 font-bold">{settings.similarity_threshold}</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    value={settings.similarity_threshold || 0.7}
                    onChange={(e) => setSettings({ ...settings, similarity_threshold: Number(e.target.value) })}
                    className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                {/* BM25 Toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-800 rounded-xl">
                  <div>
                    <span className="text-xs font-semibold text-slate-300">Enable BM25 Sparse Hybrid Search</span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Complement embeddings with keyword indices</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enable_bm25 !== false}
                    onChange={(e) => setSettings({ ...settings, enable_bm25: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 bg-slate-950 border-slate-800 rounded focus:ring-indigo-500"
                  />
                </div>

                {/* Re-ranking Toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-800 rounded-xl">
                  <div>
                    <span className="text-xs font-semibold text-slate-300">Enable LLM-based Re-ranking</span>
                    <p className="text-[10px] text-slate-500 mt-0.5">Recalculate context matching using LLM prompts</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enable_reranking !== false}
                    onChange={(e) => setSettings({ ...settings, enable_reranking: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 bg-slate-950 border-slate-800 rounded focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Action Button */}
        <div className="flex justify-end mt-4">
          <Button type="submit" variant="primary" disabled={saving} className="flex items-center gap-1.5 text-xs py-2 px-5">
            {saving ? (
              <>
                <Spinner size="xs" /> Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Configurations
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
