import boto3
import logging
from config import settings

logger = logging.getLogger(__name__)


def get_s3_client():
    return boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )


async def upload_to_s3(content: bytes, s3_key: str, content_type: str, bucket: str = None) -> str:
    bucket = bucket or settings.s3_bucket_documents
    try:
        s3 = get_s3_client()
        s3.put_object(Bucket=bucket, Key=s3_key, Body=content, ContentType=content_type)
        url = f"https://{bucket}.s3.{settings.aws_region}.amazonaws.com/{s3_key}"
        logger.info(f"Uploaded to S3: {url}")
        return url
    except Exception as e:
        logger.error(f"S3 upload failed: {e}")
        return f"local://{s3_key}"  # fallback for dev


async def get_presigned_url(s3_key: str, content_type: str, expires: int = 3600) -> str:
    try:
        s3 = get_s3_client()
        url = s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": settings.s3_bucket_documents, "Key": s3_key, "ContentType": content_type},
            ExpiresIn=expires,
        )
        return url
    except Exception as e:
        logger.error(f"Presigned URL generation failed: {e}")
        return ""


async def get_download_url(s3_key: str, expires: int = 3600) -> str:
    try:
        s3 = get_s3_client()
        return s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3_bucket_documents, "Key": s3_key},
            ExpiresIn=expires,
        )
    except Exception as e:
        logger.error(f"Download URL generation failed: {e}")
        return ""
