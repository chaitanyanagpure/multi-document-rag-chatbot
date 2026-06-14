"""
VerbaFlow AI - Embedding Service
Abstraction layer over Google and OpenAI embedding providers.
Implements batching, retry logic, and rate limit handling.
"""
from __future__ import annotations

import asyncio
import logging
import re
from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

def is_retryable_exception(e: Exception) -> bool:
    err_msg = str(e).lower()
    # Do not retry client/validation errors: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found
    non_retryable_codes = ["400", "401", "403", "404", "invalid_argument", "unauthenticated", "permission_denied", "not_found"]
    if any(code in err_msg for code in non_retryable_codes):
        return False
    return True

from app.core.config import settings

logger = logging.getLogger(__name__)


class BaseEmbeddingProvider(ABC):
    """
    Abstract base class for all embedding providers.

    Each provider must implement embed_query (single text) and
    embed_documents (batch of texts).
    """

    @abstractmethod
    async def embed_query(self, text: str) -> List[float]:
        """
        Embed a single query string.

        Args:
            text: The query text to embed.

        Returns:
            A list of floats representing the dense embedding vector.
        """
        ...

    @abstractmethod
    async def embed_documents(
        self, texts: List[str], doc_id: Optional[UUID] = None
    ) -> List[List[float]]:
        """
        Embed a batch of document texts.

        Args:
            texts: List of text strings to embed.
            doc_id: Optional document ID.

        Returns:
            List of embedding vectors in the same order as input.
        """
        ...

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Return the embedding vector dimension."""
        ...


class GoogleEmbeddingProvider(BaseEmbeddingProvider):
    """
    Google Generative AI embedding provider.

    Handles batching (API limit: 100 documents/call) and rate limiting.
    """

    BATCH_SIZE = 100
    MAX_CHARS_PER_TEXT = 36000  # API limit ~9000 tokens

    def __init__(self, model: str = settings.GOOGLE_EMBEDDING_MODEL) -> None:
        self.model = model
        self._client = None

    def _get_client(self):
        """Lazy-initialize the Google AI client."""
        if self._client is None:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self._client = genai
        return self._client

    @retry(
        retry=retry_if_exception_type(Exception),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        reraise=True,
    )
    async def embed_query(self, text: str) -> List[float]:
        """
        Embed a single query text.

        Args:
            text: Query string (truncated if > MAX_CHARS_PER_TEXT).

        Returns:
            Embedding vector as list of floats.
        """
        text = text[: self.MAX_CHARS_PER_TEXT]
        client = self._get_client()
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: client.embed_content(
                model=self.model,
                content=text,
                task_type="retrieval_query",
                output_dimensionality=self.dimension,
            ),
        )
        return response["embedding"]

    async def embed_documents(
        self, texts: List[str], doc_id: Optional[UUID] = None
    ) -> List[List[float]]:
        """
        Embed multiple document texts in batches.

        Args:
            texts: List of text strings.
            doc_id: Optional document ID.

        Returns:
            List of embedding vectors.
        """
        client = self._get_client()
        all_embeddings: List[List[float]] = []

        for i in range(0, len(texts), self.BATCH_SIZE):
            batch = texts[i : i + self.BATCH_SIZE]
            batch = [t[: self.MAX_CHARS_PER_TEXT] for t in batch]

            # Batch-level retry loop with exponential backoff for rate limits and transient errors
            max_retries = 8
            base_delay = 5
            batch_num = (i // self.BATCH_SIZE) + 1
            total_batches = (len(texts) + self.BATCH_SIZE - 1) // self.BATCH_SIZE
            
            for attempt in range(max_retries):
                try:
                    logger.info(f"[API CALL] Doc {doc_id or 'unknown'} - Embedding Batch {batch_num}/{total_batches} - Attempt {attempt+1}/{max_retries} - Sending...")
                    if doc_id:
                        try:
                            from app.services.ingestion_service import IngestionTelemetryManager
                            IngestionTelemetryManager.increment_api_calls(doc_id)
                            if attempt > 0:
                                IngestionTelemetryManager.increment_retries(doc_id)
                        except Exception:
                            pass
                    response = await asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda b=batch: client.embed_content(
                            model=self.model,
                            content=b,
                            task_type="retrieval_document",
                            output_dimensionality=self.dimension,
                            request_options={"timeout": 60}  # 60s timeout protection
                        ),
                    )
                    embeddings = response["embedding"]
                    all_embeddings.extend(embeddings)
                    logger.info(f"[API CALL SUCCESS] Doc {doc_id or 'unknown'} - Embedding Batch {batch_num}/{total_batches} - Attempt {attempt+1}/{max_retries} - Succeeded")
                    break
                except Exception as e:
                    err_msg = str(e).lower()
                    is_rate_limit = any(x in err_msg for x in ["429", "resource_exhausted", "quota"])
                    is_transient = is_retryable_exception(e)
                    
                    if is_transient and attempt < max_retries - 1:
                        if is_rate_limit:
                            seconds_match = re.search(r"seconds:\s*(\d+)", err_msg)
                            retry_match = re.search(r"retry\s+in\s+([\d\.]+)\s*s", err_msg)
                            if retry_match:
                                sleep_time = int(float(retry_match.group(1))) + 2
                            elif seconds_match:
                                sleep_time = int(seconds_match.group(1)) + 2
                            else:
                                sleep_time = base_delay * (2 ** attempt)
                            logger.warning(
                                "Gemini API rate limit hit in batch %d/%d (attempt %d/%d) for Doc %s. Sleeping for %ds before retry. Error: %s",
                                batch_num, total_batches, attempt + 1, max_retries, doc_id or "unknown", sleep_time, err_msg
                            )
                        else:
                            sleep_time = 2 * (2 ** attempt)
                            logger.warning(
                                "Gemini API transient error hit in batch %d/%d (attempt %d/%d) for Doc %s. Sleeping for %ds before retry. Error: %s",
                                batch_num, total_batches, attempt + 1, max_retries, doc_id or "unknown", sleep_time, err_msg
                            )
                        await asyncio.sleep(sleep_time)
                    else:
                        logger.error(
                            "Failed to embed batch %d/%d after attempt %d/%d for Doc %s: %s",
                            batch_num, total_batches, attempt + 1, max_retries, doc_id or "unknown", str(e)
                        )
                        raise e

            if i + self.BATCH_SIZE < len(texts):
                await asyncio.sleep(1.0)  # Pacing guard between successful batches

        return all_embeddings

    @property
    def dimension(self) -> int:
        """Google embedding models support 768-dimensional outputs."""
        return 768


class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    """
    OpenAI embedding provider using text-embedding-3-large (3072-dim).

    Handles batching (API limit: 2048 inputs per request) and retries.
    """

    BATCH_SIZE = 100

    def __init__(self, model: str = settings.OPENAI_EMBEDDING_MODEL) -> None:
        self.model = model
        self._client = None

    def _get_client(self):
        """Lazy-initialize the OpenAI async client."""
        if self._client is None:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._client

    @retry(
        retry=retry_if_exception_type(Exception),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        reraise=True,
    )
    async def embed_query(self, text: str) -> List[float]:
        """
        Embed a single query text.

        Args:
            text: Query string.

        Returns:
            Embedding vector.
        """
        client = self._get_client()
        response = await client.embeddings.create(
            model=self.model,
            input=[text],
        )
        return response.data[0].embedding

    async def embed_documents(
        self, texts: List[str], doc_id: Optional[UUID] = None
    ) -> List[List[float]]:
        """
        Embed multiple texts in batches.

        Args:
            texts: List of text strings.
            doc_id: Optional document ID.

        Returns:
            List of embedding vectors.
        """
        client = self._get_client()
        all_embeddings: List[List[float]] = []

        for i in range(0, len(texts), self.BATCH_SIZE):
            batch = texts[i : i + self.BATCH_SIZE]
            batch_num = (i // self.BATCH_SIZE) + 1
            total_batches = (len(texts) + self.BATCH_SIZE - 1) // self.BATCH_SIZE
            
            max_retries = 5
            base_delay = 2
            
            for attempt in range(max_retries):
                try:
                    logger.info(f"[API CALL] Doc {doc_id or 'unknown'} - OpenAI Embedding Batch {batch_num}/{total_batches} - Attempt {attempt+1}/{max_retries} - Sending...")
                    if doc_id:
                        try:
                            from app.services.ingestion_service import IngestionTelemetryManager
                            IngestionTelemetryManager.increment_api_calls(doc_id)
                            if attempt > 0:
                                IngestionTelemetryManager.increment_retries(doc_id)
                        except Exception:
                            pass
                    response = await client.embeddings.create(
                        model=self.model,
                        input=batch,
                        timeout=60.0  # 60s timeout protection
                    )
                    batch_embeddings = [item.embedding for item in sorted(response.data, key=lambda x: x.index)]
                    all_embeddings.extend(batch_embeddings)
                    logger.info(f"[API CALL SUCCESS] Doc {doc_id or 'unknown'} - OpenAI Embedding Batch {batch_num}/{total_batches} - Attempt {attempt+1}/{max_retries} - Succeeded")
                    break
                except Exception as e:
                    err_msg = str(e).lower()
                    is_rate_limit = any(x in err_msg for x in ["429", "rate_limit", "quota"])
                    is_transient = is_retryable_exception(e)
                    
                    if is_transient and attempt < max_retries - 1:
                        sleep_time = base_delay * (2 ** attempt)
                        logger.warning(
                            "OpenAI API transient error hit in batch %d/%d (attempt %d/%d) for Doc %s. Sleeping for %ds before retry. Error: %s",
                            batch_num, total_batches, attempt + 1, max_retries, doc_id or "unknown", sleep_time, err_msg
                        )
                        await asyncio.sleep(sleep_time)
                    else:
                        logger.error(
                            "Failed to embed batch %d/%d after attempt %d/%d for Doc %s: %s",
                            batch_num, total_batches, attempt + 1, max_retries, doc_id or "unknown", str(e)
                        )
                        raise e

            if i + self.BATCH_SIZE < len(texts):
                await asyncio.sleep(0.05)

        return all_embeddings

    @property
    def dimension(self) -> int:
        """OpenAI text-embedding-3-large outputs 3072-dimensional vectors."""
        return 3072


class EmbeddingServiceFactory:
    """
    Returns the configured embedding provider based on settings.

    Caches the provider instance to reuse connections/clients.
    """

    _instance: BaseEmbeddingProvider | None = None

    @classmethod
    def get_provider(
        cls, provider: str | None = None
    ) -> BaseEmbeddingProvider:
        """
        Get or create the embedding provider singleton.

        Args:
            provider: Override the settings provider ('google' or 'openai').

        Returns:
            An instantiated embedding provider.
        """
        if cls._instance is not None:
            return cls._instance

        prov = provider or settings.EMBEDDING_PROVIDER
        if prov == "google":
            cls._instance = GoogleEmbeddingProvider()
        elif prov == "openai":
            cls._instance = OpenAIEmbeddingProvider()
        else:
            raise ValueError(f"Unknown embedding provider: {prov}")

        logger.info("Embedding provider initialized: %s", prov)
        return cls._instance

    @classmethod
    def reset(cls) -> None:
        """Reset the singleton (used in tests)."""
        cls._instance = None
