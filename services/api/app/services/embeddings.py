"""
Embedding Service
Generates vector embeddings using Jina AI (free tier, 768 dims)
"""

import logging
import httpx
from typing import List, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

JINA_EMBED_URL = "https://api.jina.ai/v1/embeddings"
JINA_MODEL = "jina-embeddings-v2-base-en"  # 768 dims, matches EMBEDDING_DIMENSION


class EmbeddingService:
    """Service for generating text embeddings via Jina AI"""
    
    def __init__(self):
        self.api_key = settings.JINA_API_KEY
        self.dimension = 768
        
    async def generate_embedding(self, text: str) -> Optional[List[float]]:
        """
        Generate embedding vector for a single text via Jina AI.
        
        Args:
            text: Text to embed
            
        Returns:
            List of floats representing the embedding vector
        """
        if not text or not text.strip():
            logger.warning("Empty text provided for embedding")
            return None

        if not self.api_key:
            logger.error("JINA_API_KEY not set — cannot generate embedding")
            return None
            
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    JINA_EMBED_URL,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": JINA_MODEL,
                        "input": [text],
                    }
                )
                response.raise_for_status()
                
                data = response.json()
                embedding = data.get("data", [{}])[0].get("embedding")
                
                if not embedding:
                    logger.error("No embedding returned from Jina AI")
                    return None
                
                return embedding
                
        except httpx.TimeoutException:
            logger.error(f"Timeout generating embedding for text (length={len(text)})")
            return None
        except httpx.HTTPError as e:
            logger.error(f"HTTP error generating embedding: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error generating embedding: {e}", exc_info=True)
            return None
    
    async def generate_embeddings_batch(
        self,
        texts: List[str],
        batch_size: int = 10
    ) -> List[Optional[List[float]]]:
        """
        Generate embeddings for multiple texts
        
        Args:
            texts: List of texts to embed
            batch_size: Number of texts to process in parallel
            
        Returns:
            List of embedding vectors (None for failed embeddings)
        """
        embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_embeddings = []
            
            for text in batch:
                embedding = await self.generate_embedding(text)
                batch_embeddings.append(embedding)
            
            embeddings.extend(batch_embeddings)
            
            logger.info(f"Generated {len(batch_embeddings)} embeddings ({i + len(batch)}/{len(texts)})")
        
        return embeddings
    
    def get_embedding_dimension(self) -> int:
        """Get the dimension of embeddings"""
        return self.dimension
