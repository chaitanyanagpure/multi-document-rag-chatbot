"""
VerbaFlow AI - RAG Pipeline Tests
Validates chunking logic and reciprocal rank fusion algorithms.
"""
from __future__ import annotations

import pytest
from uuid import uuid4

from app.services.chunker import ChunkerFactory
from app.services.rag_service import RAGPipeline


def test_recursive_chunker():
    text = (
        "This is a paragraph about finance policies. It has multiple sentences. "
        "We want to split it by character and boundaries.\n\n"
        "This is a second paragraph that is also quite detailed. "
        "Let's see if recursive boundary matching splits this into parts."
    )
    
    chunker = ChunkerFactory.create(strategy="recursive", chunk_size=100, chunk_overlap=10)
    chunks = chunker.chunk(text)
    
    assert len(chunks) > 0
    assert all(len(c.content) <= 150 for c in chunks)  # soft boundary allowance


def test_reciprocal_rank_fusion():
    pipeline = RAGPipeline(db=None)  # db session not required for mathematical RRF
    
    id1 = uuid4()
    id2 = uuid4()
    id3 = uuid4()
    
    dense_results = [(id1, 0.95), (id2, 0.85)]
    sparse_results = [(id2, 12.5), (id3, 8.2)]
    
    fused = pipeline.reciprocal_rank_fusion(dense_results, sparse_results, k=60)
    
    assert len(fused) == 3
    # id2 should rank high because it appears in both dense and sparse results
    assert fused[0][0] == id2
