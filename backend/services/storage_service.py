"""
Storage service — abstracts local filesystem vs Cloudflare R2.

Activated via STORAGE_BACKEND env var:
  local  → saves to static/uploads/ on disk (dev only)
  r2     → uploads to Cloudflare R2 (production)
"""

import os
from core.config import get_settings

settings = get_settings()


class LocalStorageProvider:
    async def save(self, file_bytes: bytes, key: str, content_type: str) -> str:
        filepath = os.path.join("static", key)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "wb") as f:
            f.write(file_bytes)
        return f"{settings.BACKEND_URL}/static/{key}"

    async def delete(self, key: str) -> None:
        filepath = os.path.join("static", key)
        if os.path.exists(filepath):
            os.remove(filepath)


class R2StorageProvider:
    def __init__(self):
        import boto3
        from botocore.config import Config
        self.client = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )
        self.bucket = settings.R2_BUCKET_NAME
        self.public_url = settings.R2_PUBLIC_URL

    async def save(self, file_bytes: bytes, key: str, content_type: str) -> str:
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=file_bytes,
            ContentType=content_type,
            CacheControl="public, max-age=31536000",
        )
        return f"{self.public_url}/{key}"

    async def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)


def get_storage():
    if settings.STORAGE_BACKEND == "r2":
        return R2StorageProvider()
    return LocalStorageProvider()
