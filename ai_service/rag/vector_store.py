"""
FAISS-based vector store for legal case embeddings.
Persists index + metadata to disk. Thread-safe for async use.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import List, Optional

import numpy as np

from config import settings
from providers.factory import get_embedding_provider

logger = logging.getLogger(__name__)

# Lazy import faiss to avoid hard crash if not installed
try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    logger.warning("faiss-cpu not installed — RAG search unavailable. Run: pip install faiss-cpu")


class CaseVectorStore:
    """Manages FAISS index + case metadata for legal case search."""

    _instance: Optional["CaseVectorStore"] = None

    def __init__(self):
        self.index_path = settings.faiss_index_path
        self.meta_path = f"{self.index_path}.meta.json"
        self.index: Optional[object] = None
        self.metadata: List[dict] = []  # parallel list to FAISS vectors
        self._lock = asyncio.Lock()
        self._embedding_provider = None

    @classmethod
    def get_instance(cls) -> "CaseVectorStore":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _get_embedding_provider(self):
        if self._embedding_provider is None:
            self._embedding_provider = get_embedding_provider()
        return self._embedding_provider

    def _load(self):
        if not FAISS_AVAILABLE:
            return
        os.makedirs(os.path.dirname(self.index_path) or ".", exist_ok=True)
        if os.path.exists(f"{self.index_path}.index"):
            self.index = faiss.read_index(f"{self.index_path}.index")
            with open(self.meta_path, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)
            logger.info(f"Loaded FAISS index with {len(self.metadata)} cases")
        else:
            dim = self._get_embedding_provider().dimension()
            self.index = faiss.IndexFlatIP(dim)  # Inner product (cosine after norm)
            self.metadata = []
            logger.info("Created new FAISS index")

    def _save(self):
        if not FAISS_AVAILABLE or self.index is None:
            return
        os.makedirs(os.path.dirname(self.index_path) or ".", exist_ok=True)
        faiss.write_index(self.index, f"{self.index_path}.index")
        with open(self.meta_path, "w", encoding="utf-8") as f:
            json.dump(self.metadata, f)

    async def add_cases(self, cases: List[dict]) -> int:
        """Embed and add cases to the index. Returns count added."""
        if not FAISS_AVAILABLE:
            return 0
        async with self._lock:
            if self.index is None:
                self._load()

            texts = [self._case_to_text(c) for c in cases]
            provider = self._get_embedding_provider()
            # Batch in chunks of 32 to avoid HF rate limits
            all_embeddings = []
            for i in range(0, len(texts), 32):
                batch = texts[i:i+32]
                embeddings = await provider.embed(batch)
                all_embeddings.extend(embeddings)

            vectors = np.array(all_embeddings, dtype=np.float32)
            # Normalize for cosine similarity
            norms = np.linalg.norm(vectors, axis=1, keepdims=True)
            norms = np.where(norms == 0, 1, norms)
            vectors = vectors / norms

            self.index.add(vectors)
            self.metadata.extend(cases)
            self._save()
            return len(cases)

    async def search(self, query: str, k: int = 10) -> List[dict]:
        """Search for similar cases. Returns list of case dicts with score."""
        if not FAISS_AVAILABLE or self.index is None or self.index.ntotal == 0:
            return []

        provider = self._get_embedding_provider()
        embedding = await provider.embed([query])
        vector = np.array(embedding, dtype=np.float32)
        norms = np.linalg.norm(vector, axis=1, keepdims=True)
        vector = vector / np.where(norms == 0, 1, norms)

        k = min(k, self.index.ntotal)
        scores, indices = self.index.search(vector, k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0 and idx < len(self.metadata):
                case = dict(self.metadata[idx])
                case["relevance_score"] = float(score)
                results.append(case)
        return results

    def get_by_id(self, case_id: str) -> Optional[dict]:
        return next((c for c in self.metadata if c.get("id") == case_id), None)

    def total_cases(self) -> int:
        return len(self.metadata)

    def _case_to_text(self, case: dict) -> str:
        parts = [
            case.get("title", ""),
            case.get("court", ""),
            case.get("summary", ""),
            case.get("key_points", ""),
            case.get("decision", ""),
            " ".join(case.get("practice_areas", [])),
        ]
        return " ".join(filter(None, parts))[:2000]


# Singleton
case_store = CaseVectorStore.get_instance()
