"""
PDF indexer — extracts text from uploaded judgment PDFs,
runs AI to extract key points + decision, then indexes into FAISS.
"""

from __future__ import annotations

import hashlib
import io
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract raw text from PDF bytes using pypdf."""
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text.strip()
    except ImportError:
        logger.error("pypdf not installed. Run: pip install pypdf")
        return ""
    except Exception as e:
        logger.error(f"PDF extraction failed: {e}")
        return ""


async def ai_extract_case_metadata(full_text: str, provider) -> dict:
    """Use LLM to extract structured metadata from raw judgment text."""
    snippet = full_text[:4000]
    messages = [
        {
            "role": "system",
            "content": (
                "You are a legal document analyst. Extract structured information from Indian court judgments. "
                "Return ONLY a JSON object with these fields: "
                "title, citation, court, year (integer), summary (2-3 sentences), "
                "key_points (bullet points as string), decision (outcome in 1-2 sentences), "
                "practice_areas (list of up to 3 areas from: Criminal Law, Family Law, Property Law, "
                "Contract Law, Consumer Protection, Labour Law, Constitutional Law, Taxation, "
                "Corporate Law, Banking Law, General)."
            ),
        },
        {"role": "user", "content": f"Extract metadata from this judgment:\n\n{snippet}"},
    ]
    try:
        result = await provider.complete(messages, max_tokens=1024, temperature=0.1)
        import json, re
        match = re.search(r"\{.*\}", result, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception as e:
        logger.error(f"AI metadata extraction failed: {e}")
    return {}


def build_case_from_pdf(pdf_bytes: bytes, filename: str, uploader_id: str) -> dict:
    """Build a case dict from PDF bytes (metadata filled by AI separately)."""
    text = extract_text_from_pdf(pdf_bytes)
    case_id = "pdf_" + hashlib.sha256(pdf_bytes).hexdigest()[:12]
    title = _guess_title_from_text(text) or filename.replace(".pdf", "")
    return {
        "id": case_id,
        "source": "upload",
        "uploaded_by": uploader_id,
        "filename": filename,
        "title": title,
        "citation": "",
        "court": "",
        "year": 0,
        "summary": "",
        "key_points": "",
        "decision": "",
        "full_text": text[:50000],  # cap at 50k chars
        "practice_areas": [],
        "url": "",
    }


def _guess_title_from_text(text: str) -> str:
    lines = [l.strip() for l in text.split("\n") if len(l.strip()) > 10]
    for line in lines[:10]:
        if re.search(r"\bvs?\b|\bversus\b", line, re.IGNORECASE):
            return line[:200]
    return lines[0][:200] if lines else ""
