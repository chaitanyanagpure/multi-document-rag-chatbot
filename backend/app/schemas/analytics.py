"""
VerbaFlow AI - Analytics Schemas
Pydantic v2 models for analytics endpoints.
"""
from __future__ import annotations

from datetime import date
from typing import Dict, List, Optional

from pydantic import BaseModel


class DailyStats(BaseModel):
    date: date
    query_count: int
    unique_users: int
    avg_latency_ms: Optional[float]
    error_count: int


class TokenUsageStats(BaseModel):
    date: date
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    estimated_cost_usd: float


class DocumentStats(BaseModel):
    document_id: str
    document_name: str
    query_count: int
    avg_relevance_score: Optional[float]
    last_cited: Optional[str]


class UserEngagementStats(BaseModel):
    user_id: str
    user_name: str
    query_count: int
    chat_count: int
    avg_session_duration_min: Optional[float]
    last_active: Optional[str]


class ResponseTimeHistogram(BaseModel):
    bucket_ms: int
    count: int


class RetrievalAccuracyTrend(BaseModel):
    date: date
    avg_relevance_score: float
    avg_citation_count: float


class CostAnalysis(BaseModel):
    period_start: date
    period_end: date
    total_tokens: int
    embedding_cost_usd: float
    llm_cost_usd: float
    total_cost_usd: float
    cost_per_query_usd: float


class AnalyticsOverview(BaseModel):
    total_queries: int
    total_documents: int
    total_users: int
    total_tokens_used: int
    avg_response_time_ms: float
    total_cost_usd: float
    queries_today: int
    active_users_today: int


class AnalyticsQueryParams(BaseModel):
    days: int = 30
    org_id: Optional[str] = None
