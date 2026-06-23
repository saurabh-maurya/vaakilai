import re
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime
import httpx

from database import get_db
from middleware.auth_middleware import get_current_user
from services.storage_service import upload_to_s3, get_presigned_url, get_download_url
from services.virus_scanner import scan_bytes
from config import settings

router = APIRouter()

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB

# MIME types validated from magic bytes (first bytes of file content)
# WEBP is handled separately — it requires RIFF at 0 AND WEBP at offset 8
ALLOWED_MIME_MAGIC: dict[str, bytes] = {
    "application/pdf": b"%PDF",
    "image/png": b"\x89PNG",
    "image/jpeg": b"\xff\xd8\xff",
    "application/msword": b"\xd0\xcf\x11\xe0",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": b"PK\x03\x04",
}


def _detect_mime(content: bytes) -> str | None:
    # WEBP: bytes 0-3 == RIFF and bytes 8-11 == WEBP (avoids matching WAV/AVI)
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    for mime, magic in ALLOWED_MIME_MAGIC.items():
        if content[:len(magic)] == magic:
            return mime
    return None


def _oid(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=422, detail="Invalid ID format")


def _safe_filename(filename: str) -> str:
    # Strip path components and only allow safe characters
    name = filename.split("/")[-1].split("\\")[-1]
    name = re.sub(r"[^\w.\-]", "_", name)
    return name[:200] or "upload"


def doc_out(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    case_id: str = None,
    current_user: dict = Depends(get_current_user),
):
    content = await file.read()

    # Enforce size limit
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 25 MB.")

    # Validate MIME type from file magic bytes (not client-supplied Content-Type)
    detected_mime = _detect_mime(content)
    if not detected_mime:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Allowed: PDF, PNG, JPEG, WEBP, DOC, DOCX.",
        )

    # Virus / malware scan before storing
    is_clean, scan_msg = await scan_bytes(content)
    if not is_clean:
        raise HTTPException(status_code=422, detail=f"File rejected by security scan: {scan_msg}")

    safe_name = _safe_filename(file.filename or "upload")
    db = get_db()
    s3_key = f"documents/{current_user['user_id']}/{ObjectId()}/{safe_name}"
    url = await upload_to_s3(content, s3_key, detected_mime)

    doc_record = {
        "user_id": current_user["user_id"],
        "case_id": case_id,
        "filename": safe_name,
        "content_type": detected_mime,
        "size_bytes": len(content),
        "s3_key": s3_key,
        "url": url,
        "ocr_status": "pending",
        "created_at": datetime.utcnow(),
    }
    result = await db.documents.insert_one(doc_record)

    # Trigger OCR if PDF/image
    if detected_mime in ("application/pdf", "image/png", "image/jpeg"):
        async with httpx.AsyncClient() as client:
            try:
                await client.post(
                    f"{settings.ai_service_url}/ai/documents/ocr",
                    json={"document_id": str(result.inserted_id), "s3_key": s3_key},
                    timeout=5.0,
                )
            except Exception:
                pass

    return {"id": str(result.inserted_id), "url": url, "filename": safe_name}


ALLOWED_PRESIGN_CONTENT_TYPES = set(ALLOWED_MIME_MAGIC.keys())


@router.get("/presigned-url")
async def presigned_upload_url(filename: str, content_type: str, current_user: dict = Depends(get_current_user)):
    if content_type not in ALLOWED_PRESIGN_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported content type. Allowed: {sorted(ALLOWED_PRESIGN_CONTENT_TYPES)}",
        )
    safe_name = _safe_filename(filename)
    s3_key = f"documents/{current_user['user_id']}/{ObjectId()}/{safe_name}"
    url = await get_presigned_url(s3_key, content_type)
    return {"upload_url": url, "s3_key": s3_key}


@router.get("/")
async def list_documents(case_id: str = None, current_user: dict = Depends(get_current_user)):
    db = get_db()
    query = {"user_id": current_user["user_id"]}
    if case_id:
        query["case_id"] = case_id
    cursor = db.documents.find(query).sort("created_at", -1)
    results = []
    async for doc in cursor:
        # Replace stored S3 key with a time-limited presigned download URL (1 hour)
        if doc.get("s3_key"):
            doc["url"] = await get_download_url(doc["s3_key"], expires=3600)
        results.append(doc_out(doc))
    return results


@router.get("/{document_id}")
async def get_document(document_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.documents.find_one({"_id": _oid(document_id), "user_id": current_user["user_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    # Replace stored S3 key with a time-limited presigned download URL (1 hour)
    if doc.get("s3_key"):
        doc["url"] = await get_download_url(doc["s3_key"], expires=3600)
    return doc_out(doc)


@router.delete("/{document_id}")
async def delete_document(document_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    await db.documents.delete_one({"_id": _oid(document_id), "user_id": current_user["user_id"]})
    return {"message": "Document deleted"}
