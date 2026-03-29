"""
Visual Embedding Service
Generates visual embeddings via Jina CLIP API (jina-clip-v1, 768 dims).
No local GPU or model download required — identical approach to text embeddings.
"""

import base64
import logging
import time
from typing import List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

JINA_CLIP_URL = "https://api.jina.ai/v1/embeddings"
JINA_CLIP_MODEL = "jina-clip-v1"   # 768 dims, multimodal (text + image)
JINA_CLIP_DIMENSION = 768
JINA_MAX_RETRIES = 5
JINA_RETRY_BASE_DELAY = 2.0  # seconds


class VisualEmbeddingService:
    """Service for generating visual embeddings using Jina CLIP API"""

    def __init__(self):
        self.api_key = settings.JINA_API_KEY
        self.dimension = JINA_CLIP_DIMENSION

    def generate_image_embedding(
        self,
        image_data: bytes
    ) -> Optional[List[float]]:
        """
        Generate embedding for raw image bytes via Jina CLIP API.

        Args:
            image_data: Raw image bytes

        Returns:
            List of 768 floats, or None on failure
        """
        if not self.api_key:
            logger.warning("JINA_API_KEY not set — cannot generate image embeddings")
            return None

        try:
            encoded = base64.b64encode(image_data).decode("utf-8")
            for attempt in range(JINA_MAX_RETRIES):
                with httpx.Client(timeout=30.0) as client:
                    response = client.post(
                        JINA_CLIP_URL,
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": JINA_CLIP_MODEL,
                            "input": [{"image": encoded}],
                        },
                    )

                    if response.status_code == 429:
                        retry_after = float(response.headers.get("Retry-After", JINA_RETRY_BASE_DELAY * (2 ** attempt)))
                        logger.warning(f"Jina CLIP 429 rate limit, waiting {retry_after:.1f}s (attempt {attempt + 1}/{JINA_MAX_RETRIES})")
                        time.sleep(retry_after)
                        continue

                    response.raise_for_status()
                    data = response.json()
                    return data["data"][0]["embedding"]

            logger.error("Jina CLIP max retries exceeded for image embedding")
            return None
        except Exception as e:
            logger.error(f"Error generating image embedding via Jina: {e}", exc_info=True)
            return None

    def generate_image_embedding_from_path(
        self,
        image_path: str
    ) -> Optional[List[float]]:
        """
        Generate embedding from image file path.

        Args:
            image_path: Path to image file

        Returns:
            Visual embedding vector or None on failure
        """
        try:
            with open(image_path, "rb") as f:
                image_data = f.read()
            return self.generate_image_embedding(image_data)
        except Exception as e:
            logger.error(f"Error reading image for embedding {image_path}: {e}", exc_info=True)
            return None
