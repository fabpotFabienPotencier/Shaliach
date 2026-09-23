"""
Shaliach AI — R2/S3 Storage Service.
Replaces apps/api/src/common/storage.service.ts.
"""

import logging
from io import BytesIO

import boto3
from botocore.config import Config as BotoConfig

from .config import get_settings

logger = logging.getLogger("shaliach.storage")

settings = get_settings()


def _create_s3_client():
    if not settings.R2_ENDPOINT:
        logger.warning("R2_ENDPOINT not configured — storage operations will fail")
        return None
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=BotoConfig(signature_version="s3v4"),
    )


_s3 = _create_s3_client()


async def upload_file(key: str, body: bytes, content_type: str = "application/octet-stream") -> str:
    """Upload a file to R2 storage."""
    _s3.put_object(
        Bucket=settings.R2_BUCKET,
        Key=key,
        Body=body,
        ContentType=content_type,
    )
    logger.info(f"Uploaded file to R2: {key}")
    return key


async def get_file_bytes(key: str) -> bytes:
    """Download a file from R2 as bytes."""
    response = _s3.get_object(Bucket=settings.R2_BUCKET, Key=key)
    return response["Body"].read()


async def get_presigned_download_url(key: str, expires_in: int = 3600) -> str:
    """Generate a presigned download URL."""
    return _s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET, "Key": key},
        ExpiresIn=expires_in,
    )


async def delete_file(key: str) -> None:
    """Delete a file from R2."""
    _s3.delete_object(Bucket=settings.R2_BUCKET, Key=key)
    logger.info(f"Deleted file from R2: {key}")
