"""
Visual Embedding Service
Generates visual embeddings using CLIP for image similarity search
"""

import logging
from typing import List, Optional
import numpy as np
from PIL import Image
import io

logger = logging.getLogger(__name__)


class VisualEmbeddingService:
    """Service for generating visual embeddings using CLIP"""
    
    def __init__(self):
        self.model = None
        self.processor = None
        self.device = None
        self.dimension = 512  # CLIP ViT-B/32 dimension
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize CLIP model"""
        try:
            from sentence_transformers import SentenceTransformer
            import torch
            
            # Use CLIP model from sentence-transformers (easier integration)
            self.model = SentenceTransformer('clip-ViT-B-32')
            
            # Set device
            self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
            self.model.to(self.device)
            
            logger.info(f"CLIP model initialized on {self.device}")
            
        except Exception as e:
            logger.error(f"Failed to initialize CLIP model: {e}", exc_info=True)
            self.model = None
    
    def generate_image_embedding(
        self,
        image_data: bytes
    ) -> Optional[List[float]]:
        """
        Generate embedding for an image
        
        Args:
            image_data: Raw image bytes
            
        Returns:
            List of floats representing the visual embedding
        """
        if not self.model:
            logger.warning("CLIP model not available")
            return None
        
        try:
            # Load image from bytes
            image = Image.open(io.BytesIO(image_data))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Generate embedding
            embedding = self.model.encode(image, convert_to_numpy=True)
            
            # Convert to list and normalize
            embedding_list = embedding.tolist()
            
            return embedding_list
            
        except Exception as e:
            logger.error(f"Error generating image embedding: {e}", exc_info=True)
            return None
    
    def generate_image_embedding_from_path(
        self,
        image_path: str
    ) -> Optional[List[float]]:
        """
        Generate embedding from image file path
        
        Args:
            image_path: Path to image file
            
        Returns:
            Visual embedding vector
        """
        if not self.model:
            logger.warning("CLIP model not available")
            return None
        
        try:
            # Load image
            image = Image.open(image_path)
            
            # Convert to RGB
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Generate embedding
            embedding = self.model.encode(image, convert_to_numpy=True)
            
            return embedding.tolist()
            
        except Exception as e:
            logger.error(f"Error generating embedding from {image_path}: {e}", exc_info=True)
            return None
    
    def generate_text_embedding(
        self,
        text: str
    ) -> Optional[List[float]]:
        """
        Generate CLIP text embedding (for cross-modal search)
        
        Args:
            text: Text description
            
        Returns:
            Text embedding in same space as visual embeddings
        """
        if not self.model:
            logger.warning("CLIP model not available")
            return None
        
        try:
            # Generate text embedding
            embedding = self.model.encode(text, convert_to_numpy=True)
            
            return embedding.tolist()
            
        except Exception as e:
            logger.error(f"Error generating text embedding: {e}", exc_info=True)
            return None
    
    def compute_similarity(
        self,
        embedding1: List[float],
        embedding2: List[float]
    ) -> float:
        """
        Compute cosine similarity between two embeddings
        
        Args:
            embedding1: First embedding vector
            embedding2: Second embedding vector
            
        Returns:
            Similarity score (0-1)
        """
        try:
            # Convert to numpy arrays
            vec1 = np.array(embedding1)
            vec2 = np.array(embedding2)
            
            # Compute cosine similarity
            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)
            
            similarity = dot_product / (norm1 * norm2)
            
            return float(similarity)
            
        except Exception as e:
            logger.error(f"Error computing similarity: {e}")
            return 0.0
    
    def batch_generate_embeddings(
        self,
        image_paths: List[str],
        batch_size: int = 8
    ) -> List[Optional[List[float]]]:
        """
        Generate embeddings for multiple images efficiently
        
        Args:
            image_paths: List of image file paths
            batch_size: Number of images to process at once
            
        Returns:
            List of embedding vectors
        """
        if not self.model:
            logger.warning("CLIP model not available")
            return [None] * len(image_paths)
        
        embeddings = []
        
        for i in range(0, len(image_paths), batch_size):
            batch_paths = image_paths[i:i + batch_size]
            
            try:
                # Load images
                images = []
                for path in batch_paths:
                    try:
                        img = Image.open(path)
                        if img.mode != 'RGB':
                            img = img.convert('RGB')
                        images.append(img)
                    except Exception as e:
                        logger.warning(f"Failed to load {path}: {e}")
                        images.append(None)
                
                # Filter out failed images
                valid_images = [img for img in images if img is not None]
                
                if valid_images:
                    # Generate embeddings for batch
                    batch_embeddings = self.model.encode(
                        valid_images,
                        convert_to_numpy=True,
                        batch_size=batch_size
                    )
                    
                    # Map back to original order
                    emb_idx = 0
                    for img in images:
                        if img is not None:
                            embeddings.append(batch_embeddings[emb_idx].tolist())
                            emb_idx += 1
                        else:
                            embeddings.append(None)
                else:
                    embeddings.extend([None] * len(batch_paths))
                    
            except Exception as e:
                logger.error(f"Error in batch embedding generation: {e}")
                embeddings.extend([None] * len(batch_paths))
        
        logger.info(f"Generated {sum(1 for e in embeddings if e is not None)}/{len(image_paths)} embeddings")
        return embeddings
    
    def get_embedding_dimension(self) -> int:
        """Get the dimension of embeddings"""
        return self.dimension
