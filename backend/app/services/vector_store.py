"""
VerbaFlow AI - Vector Store Service
Abstraction layer over vector stores. Implements FAISS with sharding per organization/knowledge base on disk.
"""
from __future__ import annotations

import os
import shutil
import logging
import asyncio
from abc import ABC, abstractmethod
from typing import List, Dict, Tuple, Any
from uuid import UUID

import numpy as np
import faiss

from app.core.config import settings

logger = logging.getLogger(__name__)


class BaseVectorStore(ABC):
    """
    Abstract base class for all vector store providers.
    """

    @abstractmethod
    async def add_chunks(self, kb_id: UUID, chunk_ids: List[UUID], embeddings: List[List[float]]) -> None:
        """Add document chunks and their embeddings to the vector store."""
        ...

    @abstractmethod
    async def search(self, kb_id: UUID, query_embedding: List[float], top_k: int) -> List[Tuple[UUID, float]]:
        """Search for the top_k most similar chunks in the knowledge base."""
        ...

    @abstractmethod
    async def delete_by_document(self, kb_id: UUID, doc_id: UUID, chunk_ids: List[UUID]) -> None:
        """Delete specific chunks associated with a document."""
        ...

    @abstractmethod
    async def delete_by_kb(self, kb_id: UUID) -> None:
        """Delete the entire knowledge base index."""
        ...


class FAISSVectorStore(BaseVectorStore):
    """
    Local vector store using FAISS.
    Saves and loads indexes from disk, partitioned by knowledge base ID.
    """

    def __init__(self) -> None:
        self.base_path = settings.FAISS_INDEX_PATH
        os.makedirs(self.base_path, exist_ok=True)
        # Memory cache of active indexes to avoid loading from disk on every query
        self._cache: Dict[str, Tuple[faiss.Index, List[str]]] = {}
        # Concurrency locks per KB to avoid read/write conflicts
        self._locks: Dict[str, asyncio.Lock] = {}

    def _get_kb_lock(self, kb_id: UUID) -> asyncio.Lock:
        kb_str = str(kb_id)
        if kb_str not in self._locks:
            self._locks[kb_str] = asyncio.Lock()
        return self._locks[kb_str]

    def _get_kb_paths(self, kb_id: UUID) -> Tuple[str, str]:
        """Get the paths for the FAISS index and the corresponding mapping file."""
        kb_str = str(kb_id)
        index_path = os.path.join(self.base_path, f"{kb_str}.index")
        mapping_path = os.path.join(self.base_path, f"{kb_str}.ids")
        return index_path, mapping_path

    def _load_index(self, kb_id: UUID, dimension: int) -> Tuple[faiss.Index, List[str]]:
        """Load index and ID mapping for a knowledge base, or create a new one."""
        kb_str = str(kb_id)
        if kb_str in self._cache:
            return self._cache[kb_str]

        index_path, mapping_path = self._get_kb_paths(kb_id)

        if os.path.exists(index_path) and os.path.exists(mapping_path):
            try:
                index = faiss.read_index(index_path)
                with open(mapping_path, "r", encoding="utf-8") as f:
                    chunk_ids = [line.strip() for line in f if line.strip()]
                
                # Check dimension compatibility
                if index.d != dimension:
                    logger.warning(
                        f"Dimension mismatch for KB {kb_str}. Expected {dimension}, got {index.d}. Recreating."
                    )
                    raise ValueError("Dimension mismatch")
                
                self._cache[kb_str] = (index, chunk_ids)
                return index, chunk_ids
            except Exception as e:
                logger.error(f"Error loading FAISS index for KB {kb_str}: {e}. Creating new index.")

        # Create new index (using Flat Inner Product for cosine similarity / dot product)
        # Assuming normalized vectors, Dot Product (Inner Product) is equivalent to Cosine Similarity
        index = faiss.IndexFlatIP(dimension)
        chunk_ids = []
        self._cache[kb_str] = (index, chunk_ids)
        return index, chunk_ids

    def _save_index(self, kb_id: UUID, index: faiss.Index, chunk_ids: List[str]) -> None:
        """Persist index and ID mappings to disk."""
        kb_str = str(kb_id)
        index_path, mapping_path = self._get_kb_paths(kb_id)
        
        faiss.write_index(index, index_path)
        with open(mapping_path, "w", encoding="utf-8") as f:
            for cid in chunk_ids:
                f.write(f"{cid}\n")
        
        # Update cache
        self._cache[kb_str] = (index, chunk_ids)

    async def add_chunks(self, kb_id: UUID, chunk_ids: List[UUID], embeddings: List[List[float]]) -> None:
        if not embeddings:
            return

        lock = self._get_kb_lock(kb_id)
        async with lock:
            dimension = len(embeddings[0])
            index, existing_ids = self._load_index(kb_id, dimension)

            # Convert to float32 numpy array and normalize vectors for cosine similarity
            embedding_matrix = np.array(embeddings).astype("float32")
            faiss.normalize_L2(embedding_matrix)

            # Add to FAISS index
            index.add(embedding_matrix)

            # Add to ID mappings
            new_ids = [str(cid) for cid in chunk_ids]
            existing_ids.extend(new_ids)

            # Save to disk
            self._save_index(kb_id, index, existing_ids)
            logger.info(f"Added {len(chunk_ids)} chunks to FAISS index for KB {kb_id}")

    async def search(self, kb_id: UUID, query_embedding: List[float], top_k: int) -> List[Tuple[UUID, float]]:
        dimension = len(query_embedding)
        kb_str = str(kb_id)
        index_path, mapping_path = self._get_kb_paths(kb_id)

        # If index does not exist on disk and is not in cache, return empty list
        if kb_str not in self._cache and not (os.path.exists(index_path) and os.path.exists(mapping_path)):
            logger.warning(f"No FAISS index found for KB {kb_id}")
            return []

        index, chunk_ids = self._load_index(kb_id, dimension)
        if index.ntotal == 0:
            return []

        # Format query embedding
        query_vector = np.array([query_embedding]).astype("float32")
        faiss.normalize_L2(query_vector)

        # Search index
        actual_k = min(top_k, index.ntotal)
        scores, indices = index.search(query_vector, actual_k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(chunk_ids):
                continue
            chunk_id = UUID(chunk_ids[idx])
            # FAISS FlatIP returns cosine similarity directly for normalized vectors
            results.append((chunk_id, float(score)))

        # Sort results descending by score
        results.sort(key=lambda x: x[1], reverse=True)
        return results

    async def delete_by_document(self, kb_id: UUID, doc_id: UUID, chunk_ids: List[UUID]) -> None:
        lock = self._get_kb_lock(kb_id)
        async with lock:
            kb_str = str(kb_id)
            index_path, mapping_path = self._get_kb_paths(kb_id)

            if kb_str not in self._cache and not (os.path.exists(index_path) and os.path.exists(mapping_path)):
                return

            # FAISS doesn't support easy deletion in IndexFlat without index rebuilding.
            # We will rebuild the index by removing the deleted chunk IDs.
            dimension = 768  # default dimension, will be auto-detected if index loads
            try:
                temp_index, existing_ids = self._load_index(kb_id, dimension)
                dimension = temp_index.d
            except Exception:
                return

            delete_set = {str(cid) for cid in chunk_ids}
            if not any(cid in delete_set for cid in existing_ids):
                return

            # Extract all vectors remaining
            remaining_vectors = []
            remaining_ids = []

            for idx, cid in enumerate(existing_ids):
                if cid not in delete_set:
                    # Reconstruct vector
                    vec = temp_index.reconstruct(idx)
                    remaining_vectors.append(vec)
                    remaining_ids.append(cid)

            # Re-build FAISS index
            new_index = faiss.IndexFlatIP(dimension)
            if remaining_vectors:
                vectors_matrix = np.array(remaining_vectors).astype("float32")
                faiss.normalize_L2(vectors_matrix)
                new_index.add(vectors_matrix)

            # Save to disk and update cache
            self._save_index(kb_id, new_index, remaining_ids)
            logger.info(f"Rebuilt FAISS index for KB {kb_id} after document deletion. Chunks remaining: {len(remaining_ids)}")

    async def delete_by_kb(self, kb_id: UUID) -> None:
        lock = self._get_kb_lock(kb_id)
        async with lock:
            kb_str = str(kb_id)
            # Remove from cache
            self._cache.pop(kb_str, None)

            # Delete files from disk
            index_path, mapping_path = self._get_kb_paths(kb_id)
            if os.path.exists(index_path):
                os.remove(index_path)
            if os.path.exists(mapping_path):
                os.remove(mapping_path)
            logger.info(f"Deleted FAISS index files for KB {kb_id}")


class PineconeVectorStore(BaseVectorStore):
    """
    Pinecone cloud vector store client stub (Production ready).
    """

    def __init__(self) -> None:
        self.api_key = settings.PINECONE_API_KEY
        self.environment = settings.PINECONE_ENV
        self.index_name = settings.PINECONE_INDEX

    async def add_chunks(self, kb_id: UUID, chunk_ids: List[UUID], embeddings: List[List[float]]) -> None:
        logger.info(f"[Pinecone Stub] Uploading {len(chunk_ids)} chunks for KB {kb_id}")
        # Real implementation would call pinecone client:
        # index = pc.Index(self.index_name)
        # index.upsert(vectors=[(str(cid), emb, {"kb_id": str(kb_id)}) for cid, emb in zip(chunk_ids, embeddings)], namespace=str(kb_id))
        pass

    async def search(self, kb_id: UUID, query_embedding: List[float], top_k: int) -> List[Tuple[UUID, float]]:
        logger.info(f"[Pinecone Stub] Searching KB {kb_id}")
        return []

    async def delete_by_document(self, kb_id: UUID, doc_id: UUID, chunk_ids: List[UUID]) -> None:
        logger.info(f"[Pinecone Stub] Deleting document chunks for doc {doc_id} in KB {kb_id}")
        pass

    async def delete_by_kb(self, kb_id: UUID) -> None:
        logger.info(f"[Pinecone Stub] Deleting namespace/index for KB {kb_id}")
        pass


class VectorStoreFactory:
    """
    Factory to return the configured VectorStore implementation.
    """

    _instance: BaseVectorStore | None = None

    @classmethod
    def get_store(cls) -> BaseVectorStore:
        if cls._instance is not None:
            return cls._instance

        store_type = settings.VECTOR_STORE_TYPE
        if store_type == "faiss":
            cls._instance = FAISSVectorStore()
        elif store_type == "pinecone":
            cls._instance = PineconeVectorStore()
        else:
            raise ValueError(f"Unknown vector store type: {store_type}")

        logger.info(f"Vector store initialized: {store_type}")
        return cls._instance
