"""
VerbaFlow AI - Chunker Service
Implements Fixed, Recursive, Semantic, and Hierarchical chunking strategies.
"""
from __future__ import annotations

import logging
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class TextChunk:
    """Represents a single text chunk produced by a chunker."""

    content: str
    chunk_index: int
    page_number: Optional[int] = None
    token_count: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.token_count = self._estimate_tokens(self.content)

    @staticmethod
    def _estimate_tokens(text: str) -> int:
        """Estimate token count using a ~4 chars/token heuristic."""
        return max(1, len(text) // 4)


class BaseChunker(ABC):
    """Abstract base for all chunking strategies."""

    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200) -> None:
        if chunk_overlap >= chunk_size:
            raise ValueError("chunk_overlap must be less than chunk_size")
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    @abstractmethod
    def chunk(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> List[TextChunk]:
        """
        Split text into chunks.

        Args:
            text: Source text to chunk.
            metadata: Optional metadata propagated to each chunk.

        Returns:
            Ordered list of TextChunk instances.
        """
        ...

    def _attach_metadata(
        self, chunks: List[TextChunk], base_metadata: Optional[Dict[str, Any]]
    ) -> List[TextChunk]:
        """Merge base_metadata into each chunk's metadata dict."""
        if base_metadata:
            for chunk in chunks:
                chunk.metadata.update(base_metadata)
        return chunks


class FixedChunker(BaseChunker):
    """
    Splits text by a fixed character count with overlapping windows.

    Pros: Predictable chunk sizes, fast.
    Cons: May cut sentences in half.
    """

    def chunk(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> List[TextChunk]:
        """
        Produce overlapping fixed-size character chunks.

        Args:
            text: Input text.
            metadata: Optional chunk metadata.

        Returns:
            List of TextChunk instances.
        """
        if not text.strip():
            return []

        chunks: List[TextChunk] = []
        start = 0
        idx = 0

        while start < len(text):
            end = min(start + self.chunk_size, len(text))
            chunk_text = text[start:end].strip()
            if chunk_text:
                chunks.append(
                    TextChunk(
                        content=chunk_text,
                        chunk_index=idx,
                        metadata=dict(metadata or {}),
                    )
                )
                idx += 1
            # Advance with overlap
            start += self.chunk_size - self.chunk_overlap

        return self._attach_metadata(chunks, metadata)


class RecursiveChunker(BaseChunker):
    """
    Splits text hierarchically by paragraph, sentence, word boundaries.

    Tries each separator in order; falls back to the next if chunks
    are still too large.

    Pros: Preserves natural language boundaries.
    Cons: Variable chunk sizes.
    """

    # Ordered from most to least specific
    SEPARATORS = [
        "\n\n",   # Paragraphs
        "\n",     # Lines
        ". ",     # Sentences
        "! ",
        "? ",
        "; ",
        ", ",
        " ",      # Words
        "",       # Characters (last resort)
    ]

    def chunk(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> List[TextChunk]:
        """Split text recursively respecting natural boundaries."""
        if not text.strip():
            return []

        raw_chunks = self._split_recursive(text, self.SEPARATORS)
        merged = self._merge_chunks(raw_chunks)

        result: List[TextChunk] = []
        for idx, chunk_text in enumerate(merged):
            if chunk_text.strip():
                result.append(
                    TextChunk(
                        content=chunk_text.strip(),
                        chunk_index=idx,
                        metadata=dict(metadata or {}),
                    )
                )

        return self._attach_metadata(result, metadata)

    def _split_recursive(self, text: str, separators: List[str]) -> List[str]:
        """Recursively split until all pieces are within chunk_size."""
        if len(text) <= self.chunk_size:
            return [text]

        if not separators:
            # Hard split at chunk_size
            return [text[i:i + self.chunk_size] for i in range(0, len(text), self.chunk_size)]

        sep = separators[0]
        parts = text.split(sep) if sep else list(text)
        remaining_separators = separators[1:]

        result: List[str] = []
        for part in parts:
            if len(part) <= self.chunk_size:
                result.append(part)
            else:
                result.extend(self._split_recursive(part, remaining_separators))
        return result

    def _merge_chunks(self, pieces: List[str]) -> List[str]:
        """
        Merge small pieces into chunks up to chunk_size, with overlap.

        Adjacent pieces are combined until the next would exceed chunk_size,
        then a new chunk starts.
        """
        chunks: List[str] = []
        current = ""
        overlap_buffer = ""

        for piece in pieces:
            piece = piece.strip()
            if not piece:
                continue

            if len(current) + len(piece) + 1 <= self.chunk_size:
                current = f"{current} {piece}".strip() if current else piece
            else:
                if current:
                    chunks.append(current)
                    # Carry over overlap from the end of the previous chunk
                    overlap_buffer = current[-self.chunk_overlap:] if self.chunk_overlap else ""
                current = f"{overlap_buffer} {piece}".strip() if overlap_buffer else piece

        if current:
            chunks.append(current)

        return chunks


class SemanticChunker(BaseChunker):
    """
    Finds natural semantic break points using sentence-level embedding cosine similarity.

    Splits when similarity between adjacent sentences drops below a threshold,
    indicating a topic change. Falls back to RecursiveChunker for very short texts.

    Note: Requires an embedding provider call per sentence pair (expensive on cold start).
    Use caching in production. This implementation uses a synchronous embedding
    approximation with TF-IDF cosine similarity to avoid async complexity here.
    """

    def __init__(
        self,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        similarity_threshold: float = 0.75,
    ) -> None:
        super().__init__(chunk_size, chunk_overlap)
        self.similarity_threshold = similarity_threshold

    def chunk(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> List[TextChunk]:
        """
        Chunk text by semantic similarity between adjacent sentences.

        Args:
            text: Input text.
            metadata: Optional chunk metadata.

        Returns:
            Semantically coherent TextChunk list.
        """
        if not text.strip():
            return []

        sentences = self._split_sentences(text)
        if len(sentences) < 2:
            return RecursiveChunker(self.chunk_size, self.chunk_overlap).chunk(text, metadata)

        # Group sentences into chunks based on similarity
        chunk_groups: List[List[str]] = []
        current_group: List[str] = [sentences[0]]

        for i in range(1, len(sentences)):
            sim = self._tfidf_cosine_similarity(
                " ".join(current_group), sentences[i]
            )
            current_len = sum(len(s) for s in current_group)

            if sim >= self.similarity_threshold and current_len + len(sentences[i]) < self.chunk_size:
                current_group.append(sentences[i])
            else:
                chunk_groups.append(current_group)
                # Overlap: carry last N chars
                overlap_sentences: List[str] = []
                char_count = 0
                for s in reversed(current_group):
                    char_count += len(s)
                    overlap_sentences.insert(0, s)
                    if char_count >= self.chunk_overlap:
                        break
                current_group = overlap_sentences + [sentences[i]]

        if current_group:
            chunk_groups.append(current_group)

        result: List[TextChunk] = []
        for idx, group in enumerate(chunk_groups):
            content = " ".join(group).strip()
            if content:
                result.append(
                    TextChunk(
                        content=content,
                        chunk_index=idx,
                        metadata=dict(metadata or {}),
                    )
                )

        return self._attach_metadata(result, metadata)

    def _split_sentences(self, text: str) -> List[str]:
        """Split text into sentences using regex heuristics."""
        # Split on sentence-ending punctuation followed by whitespace + capital
        sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z])", text)
        return [s.strip() for s in sentences if s.strip()]

    def _tfidf_cosine_similarity(self, text_a: str, text_b: str) -> float:
        """
        Approximate cosine similarity using term overlap (Jaccard-like).

        This avoids a network call. For production, replace with real embeddings.
        """
        words_a = set(re.findall(r"\b\w+\b", text_a.lower()))
        words_b = set(re.findall(r"\b\w+\b", text_b.lower()))
        if not words_a or not words_b:
            return 0.0
        intersection = words_a & words_b
        union = words_a | words_b
        return len(intersection) / len(union)


class HierarchicalChunker(BaseChunker):
    """
    Preserves document structure by chunking at section/subsection/paragraph level.

    Identifies sections by markdown-style headers (# H1, ## H2) or ALL CAPS lines.
    Produces chunks annotated with their section path in metadata.

    Pros: Maintains document hierarchy context.
    Cons: Requires well-structured documents.
    """

    HEADER_PATTERN = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)
    CAPS_HEADER_PATTERN = re.compile(r"^[A-Z][A-Z\s]{4,}$", re.MULTILINE)

    def chunk(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> List[TextChunk]:
        """
        Chunk text respecting section headers for structural context.

        Args:
            text: Document text (best results with Markdown-formatted content).
            metadata: Optional chunk metadata.

        Returns:
            List of TextChunk instances annotated with section information.
        """
        if not text.strip():
            return []

        sections = self._split_by_headers(text)
        result: List[TextChunk] = []
        chunk_idx = 0

        for section_path, section_text in sections:
            if not section_text.strip():
                continue

            # Sub-chunk each section with RecursiveChunker
            sub_chunker = RecursiveChunker(self.chunk_size, self.chunk_overlap)
            sub_chunks = sub_chunker.chunk(section_text)

            for sub in sub_chunks:
                sub_meta = dict(metadata or {})
                sub_meta["section"] = section_path
                result.append(
                    TextChunk(
                        content=sub.content,
                        chunk_index=chunk_idx,
                        metadata=sub_meta,
                    )
                )
                chunk_idx += 1

        return result

    def _split_by_headers(self, text: str) -> List[tuple[str, str]]:
        """
        Split document into (section_path, content) tuples by headers.

        Args:
            text: Document text.

        Returns:
            List of (section_header, content) tuples.
        """
        sections: List[tuple[str, str]] = []
        current_header = "Introduction"
        current_parts: List[str] = []

        for line in text.split("\n"):
            header_match = self.HEADER_PATTERN.match(line)
            if header_match:
                # Save current section
                if current_parts:
                    sections.append((current_header, "\n".join(current_parts)))
                    current_parts = []
                level = len(header_match.group(1))
                current_header = f"{'  ' * (level - 1)}{header_match.group(2)}"
            else:
                current_parts.append(line)

        if current_parts:
            sections.append((current_header, "\n".join(current_parts)))

        # If no headers found, return the whole text as one section
        if not sections:
            sections = [("Document", text)]

        return sections


class ChunkerFactory:
    """
    Factory that returns the appropriate chunker based on a strategy name.

    Usage:
        chunker = ChunkerFactory.create("recursive", chunk_size=1000, overlap=200)
        chunks = chunker.chunk(text)
    """

    @staticmethod
    def create(
        strategy: str,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        **kwargs: Any,
    ) -> BaseChunker:
        """
        Instantiate a chunker for the given strategy.

        Args:
            strategy: One of "fixed", "recursive", "semantic", "hierarchical".
            chunk_size: Maximum characters per chunk.
            chunk_overlap: Overlap characters between consecutive chunks.
            **kwargs: Additional parameters forwarded to the chunker constructor.

        Returns:
            An instantiated BaseChunker subclass.

        Raises:
            ValueError if strategy is unknown.
        """
        strategy = strategy.lower()
        registry = {
            "fixed": FixedChunker,
            "recursive": RecursiveChunker,
            "semantic": SemanticChunker,
            "hierarchical": HierarchicalChunker,
        }
        chunker_cls = registry.get(strategy)
        if not chunker_cls:
            raise ValueError(
                f"Unknown chunking strategy '{strategy}'. "
                f"Choose from: {list(registry.keys())}"
            )
        return chunker_cls(chunk_size=chunk_size, chunk_overlap=chunk_overlap, **kwargs)
