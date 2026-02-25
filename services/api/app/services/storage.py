"""
Storage Service - MinIO/S3 integration for file operations
Handles pre-signed URLs, uploads, downloads, and bucket management
"""

import hashlib
import logging
from datetime import timedelta
from typing import Optional, Tuple
from minio import Minio
from minio.error import S3Error
from app.core.config import settings

logger = logging.getLogger(__name__)


class StorageService:
    """Service for interacting with MinIO/S3 object storage"""
    
    def __init__(self):
        """Initialize MinIO client"""
        # Single internal client — talks to MinIO over the Docker network.
        # We avoid presigned URLs entirely for downloads (signature includes the
        # Host header, which breaks when the host is rewritten for browser access).
        # Instead downloads are proxied through the API via get_object_stream().
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.MINIO_USE_SSL
        )
        self.bucket_name = settings.MINIO_BUCKET
        self._ensure_bucket()
    
    def _ensure_bucket(self):
        """Ensure the bucket exists, create if it doesn't"""
        try:
            if not self.client.bucket_exists(self.bucket_name):
                self.client.make_bucket(self.bucket_name)
                logger.info(f"Created bucket: {self.bucket_name}")
            else:
                logger.debug(f"Bucket exists: {self.bucket_name}")
        except S3Error as e:
            logger.error(f"Error ensuring bucket: {e}")
            raise
    
    def generate_upload_url(
        self, 
        org_id: str, 
        filename: str, 
        content_type: str,
        expires_minutes: int = 15
    ) -> Tuple[str, str]:
        """
        Generate a pre-signed URL for direct upload to MinIO.
        Only used for legacy/direct-upload paths; the main upload flow
        goes through the API's /upload endpoint (multipart POST) instead.
        """
        storage_key = f"orgs/{org_id}/uploads/{filename}"
        
        try:
            url = self.client.presigned_put_object(
                self.bucket_name,
                storage_key,
                expires=timedelta(minutes=expires_minutes)
            )
            # Rewrite internal hostname to the external one for browser access.
            # Note: this breaks AWS Sig4 host verification on some MinIO versions.
            # Prefer the API-proxy download path (get_object_stream) for that reason.
            url = url.replace(
                f"http://{settings.MINIO_ENDPOINT}",
                f"http://{settings.MINIO_EXTERNAL_ENDPOINT}"
            )
            logger.info(f"Generated upload URL for: {storage_key}")
            return url, storage_key
        except S3Error as e:
            logger.error(f"Error generating upload URL: {e}")
            raise

    def get_object_stream(self, storage_key: str):
        """
        Return a raw MinIO HTTP response that can be iterated as a byte stream.
        Use this to proxy a file through the API instead of issuing a presigned URL.
        The caller MUST call .close() and .release_conn() on the returned object
        (or use it inside a try/finally block).

        Returns:
            urllib3.response.HTTPResponse  (iterable in chunks)
        """
        return self.client.get_object(self.bucket_name, storage_key)

    def generate_download_url(
        self,
        storage_key: str,
        expires_minutes: int = 15
    ) -> str:
        """
        Kept for backward-compatibility with any code that still calls it.
        Prefer get_object_stream() + StreamingResponse for new code.
        """
        try:
            url = self.client.presigned_get_object(
                self.bucket_name,
                storage_key,
                expires=timedelta(minutes=expires_minutes)
            )
            url = url.replace(
                f"http://{settings.MINIO_ENDPOINT}",
                f"http://{settings.MINIO_EXTERNAL_ENDPOINT}"
            )
            logger.info(f"Generated download URL for: {storage_key}")
            return url
        except S3Error as e:
            logger.error(f"Error generating download URL: {e}")
            raise
    
    def download_file_to_path(self, storage_key: str, file_path: str) -> None:
        """
        Download a file directly from MinIO to a local path.
        Uses direct MinIO client connection (works inside Docker).
        
        Args:
            storage_key: Object key in storage
            file_path: Local file path to save to
        """
        try:
            self.client.fget_object(self.bucket_name, storage_key, file_path)
            logger.info(f"Downloaded file from {storage_key} to {file_path}")
        except S3Error as e:
            logger.error(f"Error downloading file: {e}")
            raise
    
    def delete_file(self, storage_key: str) -> bool:
        """
        Delete a file from storage
        
        Args:
            storage_key: Object key to delete
            
        Returns:
            True if successful
        """
        try:
            self.client.remove_object(self.bucket_name, storage_key)
            logger.info(f"Deleted file: {storage_key}")
            return True
        except S3Error as e:
            logger.error(f"Error deleting file: {e}")
            return False
    
    def get_file_info(self, storage_key: str) -> Optional[dict]:
        """
        Get metadata about a stored file
        
        Args:
            storage_key: Object key
            
        Returns:
            Dict with file metadata or None if not found
        """
        try:
            stat = self.client.stat_object(self.bucket_name, storage_key)
            return {
                "size": stat.size,
                "content_type": stat.content_type,
                "etag": stat.etag,
                "last_modified": stat.last_modified
            }
        except S3Error as e:
            logger.error(f"Error getting file info: {e}")
            return None
    
    def copy_file(self, source_key: str, dest_key: str) -> bool:
        """
        Copy a file within storage
        
        Args:
            source_key: Source object key
            dest_key: Destination object key
            
        Returns:
            True if successful
        """
        try:
            from minio.commonconfig import CopySource
            self.client.copy_object(
                self.bucket_name,
                dest_key,
                CopySource(self.bucket_name, source_key)
            )
            logger.info(f"Copied file from {source_key} to {dest_key}")
            return True
        except S3Error as e:
            logger.error(f"Error copying file: {e}")
            return False
    
    def calculate_checksum(self, file_path: str) -> str:
        """
        Calculate SHA-256 checksum for a local file
        
        Args:
            file_path: Path to local file
            
        Returns:
            Hex digest of SHA-256 hash
        """
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        return sha256.hexdigest()
