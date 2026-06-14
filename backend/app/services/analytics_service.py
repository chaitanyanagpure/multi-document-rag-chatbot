"""
VerbaFlow AI - Analytics Service
Performs database queries to aggregate enterprise metrics, token usage,
response time distributions, user engagement, and operational cost estimations.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from uuid import UUID

from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message, MessageRole, MessageCitation
from app.models.chat import Chat
from app.models.document import Document
from app.models.user import User

logger = logging.getLogger(__name__)


class AnalyticsService:
    """
    Service for calculating organization analytics.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_overview(self, org_id: UUID) -> Dict[str, Any]:
        """Get high level summary stats for the organization."""
        # Total queries (number of user messages)
        query_stmt = (
            select(func.count(Message.id))
            .join(Chat, Message.chat_id == Chat.id)
            .where(and_(Chat.org_id == org_id, Message.role == MessageRole.USER))
        )
        total_queries_res = await self.db.execute(query_stmt)
        total_queries = total_queries_res.scalar() or 0

        # Active users
        user_stmt = select(func.count(User.id)).where(and_(User.org_id == org_id, User.is_active == True))
        active_users_res = await self.db.execute(user_stmt)
        active_users = active_users_res.scalar() or 0

        # Avg response latency (ms)
        latency_stmt = (
            select(func.avg(Message.latency_ms))
            .join(Chat, Message.chat_id == Chat.id)
            .where(and_(Chat.org_id == org_id, Message.role == MessageRole.ASSISTANT))
        )
        latency_res = await self.db.execute(latency_stmt)
        avg_latency = float(latency_res.scalar() or 0.0)

        # Total tokens consumed
        token_stmt = (
            select(func.sum(Message.token_count))
            .join(Chat, Message.chat_id == Chat.id)
            .where(Chat.org_id == org_id)
        )
        token_res = await self.db.execute(token_stmt)
        total_tokens = int(token_res.scalar() or 0)

        # Estimated cost (Gemini text-1.5-pro approx cost: $1.25 / 1M tokens)
        estimated_cost = (total_tokens / 1000000) * 1.25

        return {
            "total_queries": total_queries,
            "active_users": active_users,
            "avg_response_time_ms": round(avg_latency, 2),
            "total_tokens": total_tokens,
            "estimated_cost_usd": round(estimated_cost, 4),
        }

    async def get_daily_query_counts(self, org_id: UUID, days: int = 30) -> List[Dict[str, Any]]:
        """Queries count grouped by date for the last X days."""
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # In SQLite/Postgres we format the date
        # To be compatible with both, we use a custom date trunking strategy
        stmt = (
            select(
                func.date_trunc('day', Message.created_at).label("day"),
                func.count(Message.id).label("count")
            )
            .join(Chat, Message.chat_id == Chat.id)
            .where(
                and_(
                    Chat.org_id == org_id,
                    Message.role == MessageRole.USER,
                    Message.created_at >= start_date
                )
            )
            .group_by(func.date_trunc('day', Message.created_at))
            .order_by("day")
        )
        
        try:
            res = await self.db.execute(stmt)
            rows = res.all()
            return [{"date": row.day.strftime("%Y-%m-%d") if hasattr(row.day, "strftime") else str(row.day), "count": row.count} for row in rows]
        except Exception:
            # Fallback for SQLite/other DBs in testing environments
            fallback_stmt = (
                select(
                    Message.created_at,
                    func.count(Message.id)
                )
                .join(Chat, Message.chat_id == Chat.id)
                .where(
                    and_(
                        Chat.org_id == org_id,
                        Message.role == MessageRole.USER,
                        Message.created_at >= start_date
                    )
                )
                .group_by(Message.created_at)
            )
            res = await self.db.execute(fallback_stmt)
            rows = res.all()
            daily_dict = {}
            for row in rows:
                date_str = row[0].strftime("%Y-%m-%d") if hasattr(row[0], "strftime") else str(row[0])[:10]
                daily_dict[date_str] = daily_dict.get(date_str, 0) + row[1]
            
            return [{"date": k, "count": v} for k, v in sorted(daily_dict.items())]

    async def get_token_usage_stats(self, org_id: UUID, days: int = 30) -> List[Dict[str, Any]]:
        """Token usage metrics grouped by date."""
        start_date = datetime.utcnow() - timedelta(days=days)
        
        stmt = (
            select(
                func.date_trunc('day', Message.created_at).label("day"),
                func.sum(Message.token_count).label("tokens")
            )
            .join(Chat, Message.chat_id == Chat.id)
            .where(
                and_(
                    Chat.org_id == org_id,
                    Message.created_at >= start_date
                )
            )
            .group_by(func.date_trunc('day', Message.created_at))
            .order_by("day")
        )

        try:
            res = await self.db.execute(stmt)
            rows = res.all()
            return [{"date": row.day.strftime("%Y-%m-%d") if hasattr(row.day, "strftime") else str(row.day), "tokens": int(row.tokens or 0)} for row in rows]
        except Exception:
            # Fallback
            fallback_stmt = (
                select(
                    Message.created_at,
                    Message.token_count
                )
                .join(Chat, Message.chat_id == Chat.id)
                .where(
                    and_(
                        Chat.org_id == org_id,
                        Message.created_at >= start_date
                    )
                )
            )
            res = await self.db.execute(fallback_stmt)
            rows = res.all()
            token_dict = {}
            for row in rows:
                date_str = row[0].strftime("%Y-%m-%d") if hasattr(row[0], "strftime") else str(row[0])[:10]
                token_dict[date_str] = token_dict.get(date_str, 0) + (row[1] or 0)
            
            return [{"date": k, "tokens": v} for k, v in sorted(token_dict.items())]

    async def get_top_documents(self, org_id: UUID, limit: int = 10) -> List[Dict[str, Any]]:
        """Get the most referenced documents in citations."""
        stmt = (
            select(
                Document.name.label("name"),
                func.count(MessageCitation.id).label("citation_count")
            )
            .join(MessageCitation, Document.id == MessageCitation.doc_id)
            .where(Document.org_id == org_id)
            .group_by(Document.name)
            .order_by(desc("citation_count"))
            .limit(limit)
        )
        res = await self.db.execute(stmt)
        rows = res.all()
        return [{"name": r.name, "citations": r.citation_count} for r in rows]

    async def get_latency_distribution(self, org_id: UUID, days: int = 7) -> List[Dict[str, Any]]:
        """Get latency distribution counts for histograms (e.g. buckets: 0-1s, 1-3s, 3-5s, 5s+)."""
        start_date = datetime.utcnow() - timedelta(days=days)
        stmt = (
            select(Message.latency_ms)
            .join(Chat, Message.chat_id == Chat.id)
            .where(
                and_(
                    Chat.org_id == org_id,
                    Message.role == MessageRole.ASSISTANT,
                    Message.latency_ms.isnot(None),
                    Message.created_at >= start_date
                )
            )
        )
        res = await self.db.execute(stmt)
        latencies = [r[0] for r in res.all()]

        buckets = {
            "0-1s": 0,
            "1-2s": 0,
            "2-5s": 0,
            "5-10s": 0,
            "10s+": 0
        }

        for lat in latencies:
            seconds = lat / 1000.0
            if seconds <= 1.0:
                buckets["0-1s"] += 1
            elif seconds <= 2.0:
                buckets["1-2s"] += 1
            elif seconds <= 5.0:
                buckets["2-5s"] += 1
            elif seconds <= 10.0:
                buckets["5-10s"] += 1
            else:
                buckets["10s+"] += 1

        return [{"bucket": k, "count": v} for k, v in buckets.items()]
