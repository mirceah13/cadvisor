"""
Embedding Service
Generates vector embeddings using Jina AI (free tier, 768 dims)
"""

import asyncio
import logging
import time
import httpx
from typing import List, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

JINA_EMBED_URL = "https://api.jina.ai/v1/embeddings"
JINA_MODEL = "jina-embeddings-v2-base-en"  # 768 dims, matches EMBEDDING_DIMENSION
JINA_BATCH_SIZE = 50   # Reduced from 100 to stay under rate limits
JINA_MAX_RETRIES = 5
JINA_RETRY_BASE_DELAY = 2.0  # seconds


class EmbeddingService:
    """Service for generating text embeddings via Jina AI"""

    def __init__(self):
        self.api_key = settings.JINA_API_KEY
        self.dimension = 768

    async def generate_embedding(self, text: str) -> Optional[List[float]]:
        """Generate embedding for a single text (delegates to batch method)."""
        results = await self.generate_embeddings_batch([text])
        return results[0] if results else None

    async def generate_embeddings_batch(
        self,
        texts: List[str],
        batch_size: int = JINA_BATCH_SIZE,
    ) -> List[Optional[List[float]]]:
        """
        Generate embeddings for a list of texts using Jina AI's batch endpoint.
        Sends up to `batch_size` texts per HTTP request to minimise API calls.

        Returns a list of the same length as `texts`;
        failed items are represented as None.
        """
        if not self.api_key:
            logger.error("JINA_API_KEY not set — cannot generate embeddings")
            return [None] * len(texts)

        all_embeddings: List[Optional[List[float]]] = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            # Track non-empty texts and their original positions
            indexed = [(j, t) for j, t in enumerate(batch) if t and t.strip()]
            batch_result: List[Optional[List[float]]] = [None] * len(batch)

            if not indexed:
                all_embeddings.extend(batch_result)
                continue

            for attempt in range(JINA_MAX_RETRIES):
                try:
                    async with httpx.AsyncClient(timeout=60.0) as client:
                        response = await client.post(
                            JINA_EMBED_URL,
                            headers={
                                "Authorization": f"Bearer {self.api_key}",
                                "Content-Type": "application/json",
                            },
                            json={
                                "model": JINA_MODEL,
                                "input": [t for _, t in indexed],
                            },
                        )

                        if response.status_code == 429:
                            retry_after = float(response.headers.get("Retry-After", JINA_RETRY_BASE_DELAY * (2 ** attempt)))
                            logger.warning(
                                f"Jina rate limit (429) on batch {i // batch_size + 1}, "
                                f"attempt {attempt + 1}/{JINA_MAX_RETRIES}. "
                                f"Waiting {retry_after:.1f}s..."
                            )
                            await asyncio.sleep(retry_after)
                            continue

                        response.raise_for_status()
                        data = response.json()

                    for result_idx, (orig_idx, _) in enumerate(indexed):
                        embedding = data.get("data", [{}])[result_idx].get("embedding")
                        batch_result[orig_idx] = embedding

                    logger.info(
                        f"Jina batch {i // batch_size + 1}: embedded "
                        f"{len(indexed)} texts ({i + len(batch)}/{len(texts)} total)"
                    )
                    break  # success

                except httpx.TimeoutException:
                    logger.error(f"Timeout on Jina batch {i // batch_size + 1}, attempt {attempt + 1}")
                    if attempt < JINA_MAX_RETRIES - 1:
                        await asyncio.sleep(JINA_RETRY_BASE_DELAY * (2 ** attempt))
                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 429:
                        retry_after = float(e.response.headers.get("Retry-After", JINA_RETRY_BASE_DELAY * (2 ** attempt)))
                        logger.warning(f"Jina 429 on batch, waiting {retry_after:.1f}s (attempt {attempt + 1})")
                        await asyncio.sleep(retry_after)
                    else:
                        logger.error(f"HTTP {e.response.status_code} on Jina batch {i // batch_size + 1}: {e}")
                        break
                except Exception as e:
                    logger.error(f"Unexpected error on Jina batch: {e}", exc_info=True)
                    break

            all_embeddings.extend(batch_result)
            # Pause between batches to stay under Jina free-tier rate limits
            if i + batch_size < len(texts):
                await asyncio.sleep(2.0)

        return all_embeddings

    def get_embedding_dimension(self) -> int:
        """Get the dimension of embeddings"""
        return self.dimension
