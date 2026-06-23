"""
NyayaAnumana Dataset Ingester
==============================
Ingests the NyayaAnumana corpus (702,945 Indian legal cases) into VakilAI's
FAISS vector store to dramatically improve RAG-based case search and outcome
prediction accuracy.

Source paper:  https://arxiv.org/abs/2412.08385  (COLING 2025)
Source project: IIT Kanpur BharatGen
Dataset:        Exploration-Lab/NyayaAnumana (HuggingFace)

Usage:
------
# Ingest all cases (will take several hours for 702k cases):
python -m rag.nyayaanumana_ingester

# Limit to first 10,000 cases for testing:
python -m rag.nyayaanumana_ingester --max-cases 10000

# Ingest from a local JSONL file:
python -m rag.nyayaanumana_ingester --local-file /path/to/nyayaanumana.jsonl

# Resume from a checkpoint (after interruption):
python -m rag.nyayaanumana_ingester --resume

Design:
-------
- Streams from HuggingFace datasets (no full download needed for first pass)
- Processes in configurable batches (default 500) to avoid OOM
- Maps NyayaAnumana fields → VakilAI case format
- Saves progress checkpoint every batch so ingestion can be resumed
- Skips duplicate case IDs already in the FAISS index
- Deduplicates by case_id within each batch
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
import time
import uuid
from pathlib import Path
from typing import Iterator, Optional

# ── Add project root to path so config/providers are importable ───────────────
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import settings
from rag.vector_store import case_store

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

CHECKPOINT_PATH = "./data/nyayaanumana_checkpoint.json"
COURT_LEVEL_MAP = {
    "supreme_court": "Supreme Court of India",
    "supreme": "Supreme Court of India",
    "high_court": "High Court",
    "high": "High Court",
    "district": "District Court",
    "tribunal": "Tribunal",
    "daily_orders": "Court Orders",
}


# ── Field mapper ──────────────────────────────────────────────────────────────

def map_nyayaanumana_to_vakilai(row: dict, source: str = "nyayaanumana") -> Optional[dict]:
    """
    Map a NyayaAnumana dataset row to VakilAI case format.
    Returns None if the row lacks minimum required fields.

    NyayaAnumana fields (varies by split):
      - case_id, title, text/judgment_text, court, date, label (outcome),
        statutes, acts, bench, petitioner, respondent
    """
    # Flexible field extraction — dataset splits may use different key names
    case_id = (
        row.get("case_id")
        or row.get("id")
        or row.get("doc_id")
        or str(uuid.uuid4())
    )

    title = (
        row.get("title")
        or row.get("case_title")
        or row.get("name")
        or f"Case {case_id[:8]}"
    )

    text = (
        row.get("text")
        or row.get("judgment_text")
        or row.get("facts")
        or row.get("content")
        or ""
    )

    if not text or len(text) < 50:
        return None  # skip empty cases

    court_raw = (
        row.get("court")
        or row.get("court_name")
        or row.get("court_type")
        or ""
    ).lower()
    court = COURT_LEVEL_MAP.get(court_raw, row.get("court", "Indian Court"))

    date = row.get("date") or row.get("judgment_date") or row.get("year") or ""
    year = 0
    if date:
        try:
            year = int(str(date)[:4])
        except (ValueError, TypeError):
            year = 0

    # Outcome/label — NyayaAnumana uses binary (0=dismissed/1=allowed) or ternary
    label_raw = row.get("label") or row.get("outcome") or row.get("verdict")
    decision = _map_label_to_decision(label_raw)

    # Statutes mentioned
    statutes = row.get("statutes") or row.get("acts") or row.get("sections") or []
    if isinstance(statutes, str):
        statutes = [s.strip() for s in statutes.split(",") if s.strip()]

    # Generate summary from first 600 chars of text
    summary = text[:600].strip()
    if len(text) > 600:
        summary += "…"

    # Infer practice areas from statutes and text
    practice_areas = _infer_practice_areas(text, statutes)

    # Petitioner / respondent
    petitioner = row.get("petitioner") or row.get("appellant") or ""
    respondent = row.get("respondent") or row.get("appellee") or ""
    if petitioner and respondent:
        title = f"{petitioner} v. {respondent}"

    return {
        "id": f"nya_{case_id}",
        "title": title[:200],
        "citation": row.get("citation") or row.get("case_no") or "",
        "court": court,
        "year": year,
        "summary": summary,
        "key_points": "",  # will be lazily enriched by AI on search
        "decision": decision,
        "practice_areas": practice_areas,
        "url": row.get("url") or "",
        "full_text": text[:5000],  # store first 5k chars for in-case search
        "source": source,
    }


def _map_label_to_decision(label) -> str:
    if label is None:
        return ""
    label_str = str(label).strip().lower()
    if label_str in ("1", "allowed", "accepted", "granted", "appeal allowed"):
        return "Allowed"
    if label_str in ("0", "dismissed", "rejected", "denied", "appeal dismissed"):
        return "Dismissed"
    if label_str in ("2", "partly allowed", "partially allowed"):
        return "Partly Allowed"
    return str(label).title()


PRACTICE_AREA_KEYWORDS = {
    "Criminal Law": ["ipc", "crpc", "bnss", "bns", "murder", "theft", "assault", "rape", "criminal", "accused", "fir", "arrest"],
    "Family Law": ["divorce", "matrimonial", "custody", "maintenance", "hindu marriage", "hma", "guardianship"],
    "Property Law": ["property", "land", "possession", "rent", "tenancy", "transfer of property", "tpa", "easement"],
    "Contract Law": ["contract", "agreement", "breach", "specific performance", "arbitration"],
    "Labour Law": ["workman", "employee", "termination", "labour", "industrial", "retrenchment", "pf", "gratuity"],
    "Consumer Protection": ["consumer", "deficiency", "unfair trade", "forum", "commission"],
    "Constitutional Law": ["article 14", "article 21", "fundamental rights", "writ", "habeas corpus", "mandamus", "constitution"],
    "Taxation": ["income tax", "gst", "service tax", "customs", "excise", "taxation"],
    "Banking Law": ["bank", "loan", "npa", "debt recovery", "drt", "sarfaesi"],
    "Motor Accident": ["motor accident", "mact", "vehicle", "compensation", "accident"],
}


def _infer_practice_areas(text: str, statutes: list) -> list[str]:
    text_lower = (text[:1000] + " ".join(statutes)).lower()
    areas = []
    for area, keywords in PRACTICE_AREA_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            areas.append(area)
    return areas[:3] if areas else ["General Law"]


# ── HuggingFace stream iterator ───────────────────────────────────────────────

def _stream_from_huggingface(dataset_id: str, max_cases: int = 0) -> Iterator[dict]:
    """
    Stream NyayaAnumana from HuggingFace datasets without downloading everything.
    Tries multiple known split names.
    """
    try:
        from datasets import load_dataset
    except ImportError:
        logger.error("datasets library not installed. Run: pip install datasets huggingface-hub")
        return

    split_candidates = ["train", "test", "validation", "full"]
    for split in split_candidates:
        try:
            logger.info(f"Loading {dataset_id} (split={split}) from HuggingFace...")
            ds = load_dataset(dataset_id, split=split, streaming=True, trust_remote_code=True)
            count = 0
            for row in ds:
                yield dict(row)
                count += 1
                if max_cases and count >= max_cases:
                    return
            return  # success
        except Exception as e:
            logger.warning(f"Split '{split}' failed: {e}")
            continue

    logger.error(f"Could not load any split from {dataset_id}")


def _stream_from_jsonl(file_path: str, max_cases: int = 0) -> Iterator[dict]:
    """Stream from local JSONL file."""
    count = 0
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
                count += 1
                if max_cases and count >= max_cases:
                    return
            except json.JSONDecodeError:
                continue


# ── Checkpoint ────────────────────────────────────────────────────────────────

def _load_checkpoint() -> dict:
    if os.path.exists(CHECKPOINT_PATH):
        with open(CHECKPOINT_PATH, "r") as f:
            return json.load(f)
    return {"processed": 0, "indexed": 0, "skipped": 0}


def _save_checkpoint(state: dict):
    os.makedirs(os.path.dirname(CHECKPOINT_PATH) or ".", exist_ok=True)
    with open(CHECKPOINT_PATH, "w") as f:
        json.dump(state, f)


# ── Main ingestion loop ───────────────────────────────────────────────────────

async def ingest(
    max_cases: int = 0,
    batch_size: int = 500,
    local_file: Optional[str] = None,
    resume: bool = False,
) -> dict:
    """
    Main ingestion entry point.
    Returns summary: { processed, indexed, skipped, duration_seconds }
    """
    # Pre-load FAISS index
    case_store._load()
    existing_ids = {c.get("id") for c in case_store.metadata}
    logger.info(f"Existing FAISS index: {len(existing_ids)} cases")

    state = _load_checkpoint() if resume else {"processed": 0, "indexed": 0, "skipped": 0}
    skip_count = state["processed"] if resume else 0

    # Choose stream source
    dataset_id = settings.nyayaanumana_dataset
    if local_file:
        logger.info(f"Streaming from local file: {local_file}")
        stream = _stream_from_jsonl(local_file, max_cases or settings.nyayaanumana_max_cases)
    else:
        logger.info(f"Streaming from HuggingFace: {dataset_id}")
        stream = _stream_from_huggingface(dataset_id, max_cases or settings.nyayaanumana_max_cases)

    start_time = time.time()
    batch: list[dict] = []
    processed = 0

    for raw_row in stream:
        processed += 1

        # Skip already-processed rows when resuming
        if resume and processed <= skip_count:
            continue

        case = map_nyayaanumana_to_vakilai(raw_row)
        if case is None:
            state["skipped"] += 1
            continue

        # Skip duplicates
        if case["id"] in existing_ids:
            state["skipped"] += 1
            continue

        batch.append(case)
        existing_ids.add(case["id"])

        if len(batch) >= batch_size:
            added = await case_store.add_cases(batch)
            state["indexed"] += added
            state["processed"] = processed
            batch = []
            _save_checkpoint(state)
            elapsed = time.time() - start_time
            rate = state["indexed"] / elapsed if elapsed > 0 else 0
            logger.info(
                f"Progress: {state['indexed']:,} indexed | {state['skipped']:,} skipped "
                f"| {rate:.0f} cases/sec | elapsed: {elapsed:.0f}s"
            )

    # Final batch
    if batch:
        added = await case_store.add_cases(batch)
        state["indexed"] += added
        state["processed"] = processed
        _save_checkpoint(state)

    duration = time.time() - start_time
    logger.info(
        f"\n{'='*60}\n"
        f"NyayaAnumana ingestion complete!\n"
        f"  Indexed:  {state['indexed']:,} cases\n"
        f"  Skipped:  {state['skipped']:,} cases (duplicates/empty)\n"
        f"  Duration: {duration:.0f}s ({duration/60:.1f} minutes)\n"
        f"  Rate:     {state['indexed']/duration:.0f} cases/sec\n"
        f"  Total in FAISS: {case_store.total_cases():,}\n"
        f"{'='*60}"
    )
    return {**state, "duration_seconds": round(duration)}


# ── CLI entry point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest NyayaAnumana dataset into VakilAI FAISS index")
    parser.add_argument("--max-cases", type=int, default=0, help="Limit cases (0=all)")
    parser.add_argument("--batch-size", type=int, default=500, help="Batch size for FAISS writes")
    parser.add_argument("--local-file", type=str, default=None, help="Path to local JSONL file")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint")
    args = parser.parse_args()

    asyncio.run(ingest(
        max_cases=args.max_cases,
        batch_size=args.batch_size,
        local_file=args.local_file,
        resume=args.resume,
    ))
