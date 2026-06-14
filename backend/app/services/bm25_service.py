"""
VerbaFlow AI - BM25 Sparse Retrieval Service
Implements BM25 indexing and search per knowledge base. Persists index to disk.
"""
from __future__ import annotations

import os
import pickle
import re
import logging
import asyncio
from typing import List, Tuple, Dict, Any
from uuid import UUID
from rank_bm25 import BM25Okapi

from app.core.config import settings

logger = logging.getLogger(__name__)


def tokenize_text(text: str) -> List[str]:
    """
    Standard lowercasing and alphanumeric tokenization for BM25.
    Removes stop words or short words.
    """
    # Lowercase and clean special chars
    text = text.lower()
    tokens = re.findall(r"\b\w\w+\b", text)
    
    # Optional basic stop words list
    stop_words = {
        "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "arent",
        "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can",
        "cant", "cannot", "could", "couldnt", "did", "didnt", "do", "does", "doesnt", "doing", "dont", "down",
        "during", "each", "few", "for", "from", "further", "had", "hadnt", "has", "hasnt", "have", "havent",
        "having", "he", "hed", "hell", "hes", "her", "here", "heres", "hers", "herself", "him", "himself",
        "his", "how", "hows", "i", "id", "ill", "im", "ive", "if", "in", "into", "is", "isnt", "it", "its",
        "itself", "lets", "me", "more", "most", "mustnt", "my", "myself", "no", "nor", "not", "of", "off",
        "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same",
        "shant", "she", "shed", "shell", "shes", "should", "shouldnt", "so", "some", "such", "than", "that",
        "thats", "the", "their", "theirs", "them", "themselves", "then", "there", "theres", "these", "they",
        "theyd", "theyll", "theyre", "theyve", "this", "those", "through", "to", "too", "under", "until",
        "up", "very", "was", "wasnt", "we", "wed", "well", "were", "weve", "werent", "what", "whats", "when",
        "whens", "where", "wheres", "which", "while", "who", "whos", "whom", "why", "whys", "with", "wont",
        "would", "wouldnt", "you", "youd", "youll", "youre", "youve", "your", "yours", "yourself", "yourselves"
    }
    
    return [token for token in tokens if token not in stop_words]


class BM25IndexRegistry:
    """
    Registry for loading, saving, and querying BM25 indexes.
    Indexes are stored in settings.FAISS_INDEX_PATH with a .bm25 extension.
    """

    def __init__(self) -> None:
        self.base_path = settings.FAISS_INDEX_PATH
        os.makedirs(self.base_path, exist_ok=True)
        self._cache: Dict[str, Tuple[BM25Okapi, List[str]]] = {}
        # Lock mapping per KB to avoid read/write resource competition
        self._locks: Dict[str, asyncio.Lock] = {}

    def _get_kb_lock(self, kb_id: UUID) -> asyncio.Lock:
        kb_str = str(kb_id)
        if kb_str not in self._locks:
            self._locks[kb_str] = asyncio.Lock()
        return self._locks[kb_str]

    def _get_paths(self, kb_id: UUID) -> str:
        return os.path.join(self.base_path, f"{str(kb_id)}.bm25")

    def _load_index(self, kb_id: UUID) -> Tuple[BM25Okapi | None, List[str]]:
        kb_str = str(kb_id)
        if kb_str in self._cache:
            return self._cache[kb_str]

        path = self._get_paths(kb_id)
        if os.path.exists(path):
            try:
                with open(path, "rb") as f:
                    data = pickle.load(f)
                
                # Reconstruct BM25 object from corpus and ids
                corpus = data.get("corpus", [])
                chunk_ids = data.get("chunk_ids", [])
                
                if corpus and chunk_ids:
                    bm25 = BM25Okapi(corpus)
                    self._cache[kb_str] = (bm25, chunk_ids)
                    return bm25, chunk_ids
            except Exception as e:
                logger.error(f"Error loading BM25 index for KB {kb_str}: {e}")

        return None, []

    def _save_index(self, kb_id: UUID, corpus: List[List[str]], chunk_ids: List[str]) -> None:
        kb_str = str(kb_id)
        path = self._get_paths(kb_id)
        
        data = {
            "corpus": corpus,
            "chunk_ids": chunk_ids
        }
        
        with open(path, "wb") as f:
            pickle.dump(data, f)
            
        if corpus:
            bm25 = BM25Okapi(corpus)
            self._cache[kb_str] = (bm25, chunk_ids)
        else:
            self._cache.pop(kb_str, None)

    async def add_chunks(self, kb_id: UUID, chunk_ids: List[UUID], corpus_texts: List[str]) -> None:
        if not corpus_texts:
            return

        lock = self._get_kb_lock(kb_id)
        async with lock:
            bm25, existing_ids = self._load_index(kb_id)
            
            # Reconstruct full corpus for rank_bm25 (needs full corpus to fit IDF calculations correctly)
            full_corpus_texts = []
            full_chunk_ids = []
            
            # Load existing corpus if available
            path = self._get_paths(kb_id)
            if os.path.exists(path):
                try:
                    with open(path, "rb") as f:
                        data = pickle.load(f)
                    # Reconstruct documents from tokens
                    for tokens in data.get("corpus", []):
                        full_corpus_texts.append(tokens)
                    full_chunk_ids = data.get("chunk_ids", [])
                except Exception:
                    pass

            # Tokenize new additions
            for cid, text in zip(chunk_ids, corpus_texts):
                tokens = tokenize_text(text)
                full_corpus_texts.append(tokens)
                full_chunk_ids.append(str(cid))

            # Save index
            self._save_index(kb_id, full_corpus_texts, full_chunk_ids)
            logger.info(f"Updated BM25 index for KB {kb_id} with {len(chunk_ids)} new documents.")

    async def search(self, kb_id: UUID, query: str, top_k: int) -> List[Tuple[UUID, float]]:
        bm25, chunk_ids = self._load_index(kb_id)
        if not bm25 or not chunk_ids:
            return []

        query_tokens = tokenize_text(query)
        if not query_tokens:
            return []

        # Get scores
        scores = bm25.get_scores(query_tokens)
        
        # Zip, filter scores > 0, and sort
        results = []
        for idx, score in enumerate(scores):
            if score > 0:
                results.append((UUID(chunk_ids[idx]), float(score)))

        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]

    async def delete_by_document(self, kb_id: UUID, chunk_ids: List[UUID]) -> None:
        lock = self._get_kb_lock(kb_id)
        async with lock:
            path = self._get_paths(kb_id)
            if not os.path.exists(path):
                return

            # Load existing
            try:
                with open(path, "rb") as f:
                    data = pickle.load(f)
                existing_corpus = data.get("corpus", [])
                existing_ids = data.get("chunk_ids", [])
            except Exception:
                return

            delete_set = {str(cid) for cid in chunk_ids}
            new_corpus = []
            new_ids = []

            for idx, cid in enumerate(existing_ids):
                if cid not in delete_set:
                    new_corpus.append(existing_corpus[idx])
                    new_ids.append(cid)

            # Save updated index
            self._save_index(kb_id, new_corpus, new_ids)
            logger.info(f"Removed document chunks from BM25 index for KB {kb_id}. Remaining: {len(new_ids)}")

    async def delete_by_kb(self, kb_id: UUID) -> None:
        lock = self._get_kb_lock(kb_id)
        async with lock:
            kb_str = str(kb_id)
            self._cache.pop(kb_str, None)
            path = self._get_paths(kb_id)
            if os.path.exists(path):
                os.remove(path)
            logger.info(f"Deleted BM25 index file for KB {kb_id}")


# Global BM25 Registry instance
bm25_registry = BM25IndexRegistry()
