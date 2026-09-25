"""
Shaliach AI — R2/S3 Storage Service.
Replaces apps/api/src/common/storage.service.ts.
Provides both StorageService class and get_storage() dependency.
"""

import logging
from io import BytesIO
from typing import Any

import boto3
from botocore.config import Config as BotoConfig

from .config import get_settings

logger = logging.getLogger("shaliach.storage")


class StorageService:
    def __init__(self):
        self.settings = get_settings()
        self._s3 = self._create_s3_client()

    def _create_s3_client(self):
        if not self.settings.R2_ENDPOINT or not self.settings.R2_ACCESS_KEY_ID:
            logger.warning("R2 storage credentials not configured — storage operations will run in mock mode")
            return None
        try:
            return boto3.client(
                "s3",
                endpoint_url=self.settings.R2_ENDPOINT,
                aws_access_key_id=self.settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=self.settings.R2_SECRET_ACCESS_KEY,
                region_name="auto",
                config=BotoConfig(signature_version="s3v4"),
            )
        except Exception as e:
            logger.error(f"Failed to create S3/R2 client: {e}")
            return None

    def upload_file(self, key: str, body: bytes, content_type: str = "application/octet-stream") -> str:
        """Upload a file to R2 storage (or fallback to Redis cache if R2 not configured)."""
        if not self._s3:
            try:
                import redis
                r = redis.from_url(self.settings.REDIS_URL)
                r.set(f"storage:{key}", body, ex=7 * 86400)
                logger.info(f"R2 not configured — saved {key} ({len(body)} bytes) to Redis storage")
            except Exception as e:
                logger.warning(f"Failed to store {key} in Redis storage: {e}")
            return key
        try:
            self._s3.put_object(
                Bucket=self.settings.R2_BUCKET,
                Key=key,
                Body=body,
                ContentType=content_type,
            )
            logger.info(f"Uploaded file to R2: {key}")
            return key
        except Exception as e:
            logger.error(f"Failed to upload file {key} to R2: {e}")
            raise

    def download_file(self, key: str) -> bytes | None:
        """Download a file from R2 as bytes (or fallback to Redis cache)."""
        if not self._s3:
            try:
                import redis
                r = redis.from_url(self.settings.REDIS_URL)
                data = r.get(f"storage:{key}")
                if data:
                    logger.info(f"Retrieved {key} from Redis storage ({len(data)} bytes)")
                    return data
            except Exception as e:
                logger.warning(f"Failed to retrieve {key} from Redis storage: {e}")
            return None
        try:
            response = self._s3.get_object(Bucket=self.settings.R2_BUCKET, Key=key)
            return response["Body"].read()
        except Exception as e:
            logger.error(f"Failed to download file {key} from R2: {e}")
            return None

    def get_file_bytes(self, key: str) -> bytes | None:
        """Alias for download_file."""
        return self.download_file(key)

    def get_presigned_download_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate a presigned download URL."""
        if not self._s3:
            return ""
        try:
            return self._s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.settings.R2_BUCKET, "Key": key},
                ExpiresIn=expires_in,
            )
        except Exception as e:
            logger.error(f"Failed to generate presigned URL for {key}: {e}")
            return ""

    def delete_file(self, key: str) -> None:
        """Delete a file from R2."""
        if not self._s3:
            return
        try:
            self._s3.delete_object(Bucket=self.settings.R2_BUCKET, Key=key)
            logger.info(f"Deleted file from R2: {key}")
        except Exception as e:
            logger.error(f"Failed to delete file {key} from R2: {e}")


_storage_instance: StorageService | None = None


def get_storage() -> StorageService:
    """Dependency: returns the singleton StorageService."""
    global _storage_instance
    if _storage_instance is None:
        _storage_instance = StorageService()
    return _storage_instance


# Module-level convenience functions
def upload_file(key: str, body: bytes, content_type: str = "application/octet-stream") -> str:
    return get_storage().upload_file(key, body, content_type)


def download_file(key: str) -> bytes | None:
    return get_storage().download_file(key)


def get_file_bytes(key: str) -> bytes | None:
    return get_storage().get_file_bytes(key)


def get_presigned_download_url(key: str, expires_in: int = 3600) -> str:
    return get_storage().get_presigned_download_url(key, expires_in)


def delete_file(key: str) -> None:
    get_storage().delete_file(key)
