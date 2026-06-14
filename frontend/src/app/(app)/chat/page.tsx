"use client";

import React, { useEffect, useState, useRef } from "react";
import { useChatStore } from "@/lib/store";
import { useKBStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Chat, Message, KnowledgeBase, Citation } from "@/types";
import {
  MessageSquare,
  Plus,
  Trash2,
  Pin,
  FolderOpen,
  Send,
  Loader2,
  FileText,
  ChevronRight,
  Info,
  ExternalLink,
  Bot
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import MessageBubble from "@/components/chat/MessageBubble";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { ConfirmDialog } from "@/components/ui/Modal";


export default function ChatPage() {
  const { chats, activeChat, messages, isStreaming, setActiveChat, setChats, addMessage, setMessages } = useChatStore();
  const { knowledgeBases, activeKB, setKnowledgeBases, setActiveKB } = useKBStore();

  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingKBs, setLoadingKBs] = useState(true);
  const [selectedKBId, setSelectedKBId] = useState<string>("");
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [showCitationDrawer, setShowCitationDrawer] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);


  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load KBs and Chats
  useEffect(() => {
    async function loadData() {
      try {
        const kbList = await api.knowledgeBases.list();
        setKnowledgeBases(kbList);
        if (kbList.length > 0) {
          setSelectedKBId(kbList[0].id);
          setActiveKB(kbList[0]);
        }
        setLoadingKBs(false);

        const chatList = await api.chats.list();
        setChats(chatList);
        if (chatList.length > 0) {
          // Default to first chat
          handleSelectChat(chatList[0]);
        }
        setLoadingChats(false);
      } catch (err) {
        console.error("Failed to load initial chat page data:", err);
      }
    }
    loadData();
  }, []);

  const handleSelectChat = async (chat: Chat) => {
    setActiveChat(chat);
    setShowCitationDrawer(false);
    setActiveCitation(null);
    try {
      const msgList = await api.messages.list(chat.id);
      setMessages(msgList);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

  const handleCreateChat = async () => {
    if (!selectedKBId) return;
    try {
      const selected = knowledgeBases.find(k => k.id === selectedKBId);
      const newChat = await api.chats.create({
        title: `New Chat - ${selected?.name || "Topic"}`,
        kb_id: selectedKBId
      });
      setChats([newChat, ...chats]);
      setActiveChat(newChat);
      setMessages([]);
    } catch (err) {
      console.error("Failed to create chat:", err);
    }
  };

  const handleDeleteChat = (chatId: string) => {
    setChatToDelete(chatId);
    setDeleteModalOpen(true);
  };

  const handleConfirmDeleteChat = async () => {
    if (!chatToDelete) return;
    const chatId = chatToDelete;
    setDeleteModalOpen(false);
    setChatToDelete(null);
    try {
      await api.chats.delete(chatId);
      const updated = chats.filter(c => c.id !== chatId);
      setChats(updated);
      if (activeChat?.id === chatId) {
        if (updated.length > 0) {
          handleSelectChat(updated[0]);
        } else {
          setActiveChat(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error("Failed to delete chat:", err);
    }
  };


  const handleSend = async (text: string) => {
    if (!activeChat) return;

    // 1. Add user message locally
    const userMsg: Message = {
      id: Math.random().toString(),
      chat_id: activeChat.id,
      role: "user",
      content: text,
      created_at: new Date().toISOString()
    };
    addMessage(userMsg);
    useChatStore.setState({ isStreaming: true });

    // 2. Setup Assistant message shell
    const assistantMsg: Message = {
      id: "streaming-response-id",
      chat_id: activeChat.id,
      role: "assistant",
      content: "",
      citations: [],
      created_at: new Date().toISOString()
    };
    addMessage(assistantMsg);

    let accumulatedAnswer = "";
    
    // Safety timeout: force-stop spinner after 90 seconds if done never arrives
    const streamingTimeout = setTimeout(() => {
      const { isStreaming } = useChatStore.getState();
      if (isStreaming) {
        useChatStore.setState({ isStreaming: false });
        useChatStore.setState((state) => {
          const msgs = [...state.messages];
          const idx = msgs.findIndex(m => m.id === "streaming-response-id");
          if (idx !== -1 && !msgs[idx].content) {
            msgs[idx] = { ...msgs[idx], content: "[Response timed out. Please try again.]" };
          }
          return { messages: msgs };
        });
      }
    }, 90000);
    
    try {
      // Stream tokens using SSE
      await api.messages.sendMessage(
        activeChat.id,
        text,
        (eventData) => {
          if (eventData.type === "citation") {
            // Add citations
            useChatStore.setState((state) => {
              const msgs = [...state.messages];
              const idx = msgs.findIndex(m => m.id === "streaming-response-id");
              if (idx !== -1) {
                msgs[idx] = { ...msgs[idx], citations: eventData.citations };
              }
              return { messages: msgs };
            });
          } else if (eventData.type === "token") {
            accumulatedAnswer += eventData.token;
            // Append token
            useChatStore.setState((state) => {
              const msgs = [...state.messages];
              const idx = msgs.findIndex(m => m.id === "streaming-response-id");
              if (idx !== -1) {
                msgs[idx] = { ...msgs[idx], content: accumulatedAnswer };
              }
              return { messages: msgs };
            });
          } else if (eventData.type === "diagnostics") {
            // Store diagnostics data locally
            useChatStore.setState((state) => {
              const msgs = [...state.messages];
              const idx = msgs.findIndex(m => m.id === "streaming-response-id");
              if (idx !== -1) {
                msgs[idx] = { ...msgs[idx], diagnostics: eventData.diagnostics };
              }
              return { messages: msgs };
            });
          } else if (eventData.type === "error") {
            // Always show error content and stop spinner
            clearTimeout(streamingTimeout);
            const errorContent = accumulatedAnswer || eventData.error || "An error occurred. Please try again.";
            useChatStore.setState((state) => {
              const msgs = [...state.messages];
              const idx = msgs.findIndex(m => m.id === "streaming-response-id");
              if (idx !== -1) {
                msgs[idx] = { ...msgs[idx], content: errorContent };
              }
              return { messages: msgs };
            });
          } else if (eventData.type === "done") {
            clearTimeout(streamingTimeout);
            useChatStore.setState({ isStreaming: false });
            // Re-fetch messages to get correct DB IDs, citations, latencies, etc.
            api.messages.list(activeChat.id).then(setMessages);
          }
        }
      );
    } catch (err) {
      console.error("Error streaming chat:", err);
      clearTimeout(streamingTimeout);
      useChatStore.setState({ isStreaming: false });
      // Show error in the assistant bubble
      useChatStore.setState((state) => {
        const msgs = [...state.messages];
        const idx = msgs.findIndex(m => m.id === "streaming-response-id");
        if (idx !== -1 && !msgs[idx].content) {
          msgs[idx] = { ...msgs[idx], content: "[Connection error. Please try again.]" };
        }
        return { messages: msgs };
      });
      // Refresh messages from DB
      api.messages.list(activeChat.id).then(setMessages);
    }
  };

  const handleCitationClick = (citation: Citation) => {
    setActiveCitation(citation);
    setShowCitationDrawer(true);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-[#0A0A14] text-slate-100 relative">
      {/* 1. Left Chat List Sidebar */}
      <div className="w-80 border-r border-slate-900 bg-slate-950 flex flex-col justify-between flex-shrink-0">
        <div className="p-4 space-y-4 flex-grow overflow-y-auto scrollbar-thin">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Chat Threads</h3>
            <Button variant="primary" className="p-1.5 rounded-lg text-xs" onClick={handleCreateChat} disabled={loadingKBs || knowledgeBases.length === 0}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* KB Selection Dropdown for New Threads */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-500 font-semibold uppercase">Scope Knowledge Base</label>
            <select
              value={selectedKBId}
              onChange={(e) => setSelectedKBId(e.target.value)}
              className="w-full text-xs bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            >
              {loadingKBs ? (
                <option>Loading knowledge bases...</option>
              ) : knowledgeBases.length === 0 ? (
                <option>No KBs available</option>
              ) : (
                knowledgeBases.map((kb) => (
                  <option key={kb.id} value={kb.id}>
                    {kb.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* List of Chats */}
          {loadingChats ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : chats.length === 0 ? (
            <div className="text-center py-8 text-slate-600 text-xs">No active chats found. Create one above to start.</div>
          ) : (
            <div className="space-y-1">
              {chats.map((chat) => {
                const isActive = activeChat?.id === chat.id;
                return (
                  <div
                    key={chat.id}
                    onClick={() => handleSelectChat(chat)}
                    className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${
                      isActive ? "bg-indigo-600/10 border border-indigo-500/30 text-indigo-200" : "hover:bg-slate-900/50 text-slate-400"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="text-xs truncate font-medium">{chat.title}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteChat(chat.id);
                      }}
                      className="text-slate-600 hover:text-red-400 p-1 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. Main Chat Panel */}
      <div className="flex-grow flex flex-col justify-between overflow-hidden bg-[#0F0F1A]">
        {activeChat ? (
          <>
            {/* Header */}
            <div className="h-14 border-b border-slate-900/80 bg-slate-950/80 flex items-center justify-between px-6">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-400" />
                <div>
                  <h2 className="text-xs font-semibold text-slate-200">{activeChat.title}</h2>
                  <p className="text-[10px] text-slate-500">
                    Scoped to KB: {knowledgeBases.find(k => k.id === activeChat.kb_id)?.name || "Default"}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-grow overflow-y-auto scrollbar-thin flex flex-col">
              {messages.length === 0 ? (
                <div className="flex-grow flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-lg mx-auto">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <MessageSquare className="w-6 h-6 animate-pulse" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-200">Start a Thread</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Ask any question. The assistant will search the indexed pages of documents in this knowledge base and generate an answer with inline citations.
                  </p>
                </div>
              ) : (
                <div className="flex-grow">
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} onCitationClick={handleCitationClick} />
                  ))}
                  {isStreaming && <TypingIndicator />}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="p-4 bg-slate-950/60 border-t border-slate-900/80">
              <div className="max-w-4xl mx-auto">
                <ChatInput onSend={handleSend} disabled={isStreaming} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-md mx-auto">
            <Bot className="w-16 h-16 text-indigo-500 animate-bounce" />
            <h3 className="text-base font-bold text-slate-100">Welcome to VerbaFlow AI</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              To begin, create a chat thread scoped to one of your document knowledge bases from the sidebar, and ask your questions.
            </p>
          </div>
        )}
      </div>

      {/* 3. Right Citation Drawer */}
      {showCitationDrawer && activeCitation && (
        <div className="w-96 border-l border-slate-900 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between flex-shrink-0 animate-slide-up relative">
          <div className="p-5 flex-grow overflow-y-auto scrollbar-thin space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-400" />
                Citation Excerpt
              </h3>
              <button
                onClick={() => setShowCitationDrawer(false)}
                className="text-xs text-slate-500 hover:text-slate-300 font-semibold"
              >
                Close
              </button>
            </div>

            {/* Metadata info */}
            <div className="space-y-1 p-3 bg-slate-900/40 border border-slate-800/85 rounded-xl text-[11px] text-slate-400">
              <div className="flex justify-between">
                <span>Document:</span>
                <span className="font-semibold text-slate-200 truncate max-w-[180px]">{activeCitation.doc_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Reference:</span>
                <span className="font-semibold text-slate-200">
                  {activeCitation.page_number ? `Page ${activeCitation.page_number}` : `Chunk index ${activeCitation.chunk_index}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Retrieval Score:</span>
                <Badge variant="success" className="text-[9px] py-0 scale-95 origin-right">
                  {Math.round((activeCitation.similarity_score || 0) * 100)}% Match
                </Badge>
              </div>
            </div>

            {/* Raw Chunk Content */}
            <div className="space-y-1.5">
              <h4 className="text-[10px] text-slate-500 font-semibold uppercase">Extracted Context Chunk</h4>
              <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl text-xs text-slate-300 leading-relaxed max-h-[400px] overflow-y-auto scrollbar-thin italic">
                "{activeCitation.excerpt}"
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setChatToDelete(null);
        }}
        onConfirm={handleConfirmDeleteChat}
        title="Delete Chat"
        message="Are you sure you want to delete this conversation? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
      />
    </div>
  );
}
