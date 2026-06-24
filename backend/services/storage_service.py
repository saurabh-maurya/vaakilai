import logging
from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from bson import ObjectId
from database import get_db

logger = logging.getLogger(__name__)


async def upload_file(content: bytes, path: str, content_type: str, bucket_name: str = "documents") -> str:
    """Upload bytes to MongoDB GridFS. Returns gridfs://<bucket>/<file_id>."""
    db = get_db()
    fs = AsyncIOMotorGridFSBucket(db, bucket_name=bucket_name)
    file_id = await fs.upload_from_stream(
        path,
        content,
        metadata={"content_type": content_type, "path": path},
    )
    logger.info("GridFS upload: bucket=%s path=%s file_id=%s", bucket_name, path, file_id)
    return f"gridfs://{bucket_name}/{file_id}"


async def download_file(grid_uri: str) -> tuple[bytes, str]:
    """Download from GridFS URI. Returns (bytes, content_type)."""
    bucket_name, file_id_str = grid_uri.replace("gridfs://", "").split("/", 1)
    db = get_db()
    fs = AsyncIOMotorGridFSBucket(db, bucket_name=bucket_name)
    stream = await fs.open_download_stream(ObjectId(file_id_str))
    content = await stream.read()
    content_type = (stream.metadata or {}).get("content_type", "application/octet-stream")
    return content, content_type


async def delete_file(grid_uri: str) -> None:
    """Delete a file from GridFS by its URI."""
    try:
        bucket_name, file_id_str = grid_uri.replace("gridfs://", "").split("/", 1)
        db = get_db()
        fs = AsyncIOMotorGridFSBucket(db, bucket_name=bucket_name)
        await fs.delete(ObjectId(file_id_str))
    except Exception as e:
        logger.error("GridFS delete failed for %s: %s", grid_uri, e)


# ── Compatibility shims for verification.py and payment_service.py ─────────────

async def upload_to_s3(content: bytes, s3_key: str, content_type: str, bucket: str = None) -> str:
    """Shim: routes legacy S3 calls to GridFS."""
    bucket_name = "invoices" if bucket and "invoice" in bucket else "documents"
    return await upload_file(content, s3_key, content_type, bucket_name)


async def get_presigned_url(s3_key: str, content_type: str, expires: int = 3600) -> str:
    """GridFS has no presigned URLs — uploads go through POST /api/v1/documents/upload."""
    return ""


async def get_download_url(grid_uri: str, expires: int = 3600) -> str:
    """Return the grid_uri unchanged — the /file/{doc_id} endpoint serves it."""
    return grid_uri
