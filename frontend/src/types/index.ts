// ===========================
// Organization & User Types
// ===========================

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url?: string
  subscription_tier: 'free' | 'starter' | 'professional' | 'enterprise'
  subscription_status: 'active' | 'inactive' | 'trial' | 'cancelled'
  max_users: number
  max_knowledge_bases: number
  max_documents: number
  max_storage_bytes: number
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  role: 'admin' | 'manager' | 'user' | 'viewer'
  organization_id: string
  organization?: Organization
  is_active: boolean
  is_verified: boolean
  last_login_at?: string
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  user_id: string
  device: string
  browser: string
  ip_address: string
  location?: string
  is_current: boolean
  last_active_at: string
  created_at: string
}

// ===========================
// Auth Types
// ===========================

export interface LoginRequest {
  email: string
  password: string
  remember_me?: boolean
}

export interface RegisterRequest {
  email: string
  password: string
  full_name: string
  organization_name: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  user: User
}

export interface RefreshTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

// ===========================
// Knowledge Base Types
// ===========================

export type KBStatus = 'active' | 'indexing' | 'error' | 'empty'

export interface KnowledgeBase {
  id: string
  name: string
  description?: string
  organization_id: string
  status: KBStatus
  document_count: number
  chunk_count: number
  total_size_bytes: number
  embedding_model: string
  chunking_strategy: 'fixed' | 'recursive' | 'semantic' | 'hierarchical'
  chunk_size: number
  chunk_overlap: number
  tags: string[]
  is_public: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateKBRequest {
  name: string
  description?: string
  embedding_model?: string
  chunking_strategy?: string
  chunk_size?: number
  chunk_overlap?: number
  tags?: string[]
  is_public?: boolean
}

export interface KBStats {
  total_documents: number
  indexed_documents: number
  failed_documents: number
  total_chunks: number
  total_size_bytes: number
  last_updated_at?: string
}

// ===========================
// Document Types
// ===========================

export type DocumentStatus =
  | 'pending'
  | 'processing'
  | 'extracting'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'completed'
  | 'ready'
  | 'failed'

export type DocumentType = 'pdf' | 'docx' | 'txt' | 'md' | 'csv' | 'xlsx' | 'pptx' | 'html' | 'json'

export interface Document {
  id: string
  name: string
  original_filename: string
  file_type: DocumentType
  file_size: number
  kb_id: string
  status: DocumentStatus
  chunk_count?: number
  error_message?: string
  metadata: Record<string, unknown>
  tags: string[]
  uploaded_by: string
  uploaded_at: string
  indexed_at?: string
  created_at: string
  updated_at: string
}

export interface IngestionStep {
  step: number
  name: string
  description: string
  status: 'pending' | 'active' | 'completed' | 'failed'
  progress?: number
  message?: string
  started_at?: string
  completed_at?: string
}

export interface IngestionProgress {
  document_id: string
  overall_progress: number
  current_step: number
  steps: IngestionStep[]
  error?: string
}

// ===========================
// Chat & Message Types
// ===========================

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Citation {
  id: string
  document_id: string
  doc_name: string
  page_number?: number
  chunk_index: number
  excerpt: string
  similarity_score: number
  relevance_score: number
  metadata?: Record<string, unknown>
}

export interface MessageDiagnostics {
  retrieved_chunks_count: number
  similarity_scores: number[]
  token_usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  llm_latency_ms: number
  vector_search_latency_ms: number
  api_response_time_ms: number
  error_stack_trace?: string | null
}

export interface Message {
  id: string
  chat_id: string
  role: MessageRole
  content: string
  citations?: Citation[]
  token_count?: number
  model_used?: string
  latency_ms?: number
  is_streaming?: boolean
  created_at: string
  diagnostics?: MessageDiagnostics
}

export interface Chat {
  id: string
  title: string
  organization_id: string
  user_id: string
  kb_id?: string
  knowledge_base?: Pick<KnowledgeBase, 'id' | 'name'>
  message_count: number
  is_pinned: boolean
  is_shared: boolean
  share_token?: string
  folder?: string
  last_message?: Pick<Message, 'content' | 'created_at'>
  created_at: string
  updated_at: string
}

export interface SendMessageRequest {
  content: string
  kb_id?: string
}

export interface CreateChatRequest {
  title?: string
  kb_id?: string
}

// ===========================
// Analytics Types
// ===========================

export interface AnalyticsOverview {
  total_queries: number
  total_queries_change: number
  active_users: number
  active_users_change: number
  avg_response_time_ms: number
  avg_response_time_change: number
  total_tokens: number
  total_tokens_change: number
  total_cost_usd: number
  total_cost_change: number
  total_documents: number
  total_knowledge_bases: number
}

export interface QueryDataPoint {
  date: string
  queries: number
  successful: number
  failed: number
}

export interface TokenDataPoint {
  date: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cost_usd: number
}

export interface ResponseTimeDataPoint {
  range: string
  count: number
}

export interface TopDocument {
  document_id: string
  document_name: string
  knowledge_base_name: string
  access_count: number
  avg_similarity_score: number
}

export interface TopQuery {
  query: string
  count: number
  avg_response_time_ms: number
  last_asked_at: string
}

export interface KBQueryDistribution {
  kb_id: string
  knowledge_base_name: string
  query_count: number
  percentage: number
}

export interface AnalyticsData {
  overview: AnalyticsOverview
  queries_per_day: QueryDataPoint[]
  tokens_per_day: TokenDataPoint[]
  response_time_distribution: ResponseTimeDataPoint[]
  top_documents: TopDocument[]
  top_queries: TopQuery[]
  kb_distribution: KBQueryDistribution[]
}

// ===========================
// Admin Types
// ===========================

export interface SystemStatus {
  backend_status: 'healthy' | 'degraded' | 'down'
  database_status: 'healthy' | 'degraded' | 'down'
  vector_store_status: 'healthy' | 'degraded' | 'down'
  cache_status: 'healthy' | 'degraded' | 'down'
  queue_status: 'healthy' | 'degraded' | 'down'
  backend_latency_ms: number
  database_latency_ms: number
  vector_store_latency_ms: number
  active_connections: number
  queued_jobs: number
  worker_count: number
  uptime_seconds: number
  version: string
}

export interface OrgManagement extends Organization {
  user_count: number
  document_count: number
  total_storage_bytes: number
  total_queries_month: number
  owner_email: string
}

export interface AuditLog {
  id: string
  user_id: string
  user_email: string
  user_name: string
  organization_id: string
  action: string
  resource_type: string
  resource_id: string
  resource_name?: string
  ip_address: string
  user_agent?: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface AIProviderConfig {
  embedding_provider: 'google' | 'openai' | 'cohere'
  embedding_model: string
  llm_provider: 'google' | 'openai' | 'anthropic' | 'azure'
  llm_model: string
  embedding_api_key?: string
  llm_api_key?: string
  tokens_used_today: number
  cost_today_usd: number
  requests_today: number
}

// ===========================
// Settings Types
// ===========================

export interface AISettings {
  embedding_provider: 'google' | 'openai' | 'cohere'
  embedding_model: string
  llm_provider: 'google' | 'openai' | 'anthropic' | 'azure'
  llm_model: string
  embedding_api_key?: string
  llm_api_key?: string
  temperature: number
  max_tokens: number
}

export interface RetrievalSettings {
  chunking_strategy: 'fixed' | 'recursive' | 'semantic' | 'hierarchical'
  chunk_size: number
  chunk_overlap: number
  retrieval_count: number
  similarity_threshold: number
  enable_bm25: boolean
  enable_reranking: boolean
  reranking_model?: string
}

export interface OrganizationSettings {
  name: string
  logo_url?: string
  subscription_tier: string
  subscription_status: string
  max_users: number
  max_knowledge_bases: number
  max_storage_bytes: number
}

export interface AppSettings {
  ai: AISettings
  retrieval: RetrievalSettings
  organization: OrganizationSettings
}

export interface OrgSettings {
  id: string
  org_id: string
  embedding_provider: string
  llm_provider: string
  llm_model: string
  embedding_model: string
  chunk_size: number
  chunk_overlap: number
  chunking_strategy: 'fixed' | 'recursive' | 'semantic' | 'hierarchical'
  retrieval_count: number
  similarity_threshold: number
  max_file_size_mb: number
  enable_bm25: boolean
  enable_reranking: boolean
  enable_query_expansion: boolean
  created_at: string
  updated_at: string
}


// ===========================
// API Response Types
// ===========================

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface APIError {
  detail: string
  code?: string
  field?: string
}

export interface SuccessResponse {
  message: string
  success: boolean
}

// ===========================
// UI State Types
// ===========================

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

export interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string; size?: number }>
  badge?: number
  children?: NavItem[]
  adminOnly?: boolean
}
