"""
Text Chunking Service
Splits documents into semantically meaningful chunks for RAG
"""

import logging
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class TextChunk:
    """Represents a chunk of text with metadata"""
    text: str
    chunk_index: int
    start_char: int
    end_char: int
    metadata: Dict[str, Any]


class ChunkingService:
    """Service for chunking text documents"""
    
    def __init__(
        self,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
        min_chunk_size: int = 100
    ):
        """
        Initialize chunking service
        
        Args:
            chunk_size: Target size of each chunk in characters
            chunk_overlap: Number of overlapping characters between chunks
            min_chunk_size: Minimum chunk size (discard smaller chunks)
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.min_chunk_size = min_chunk_size
    
    def chunk_text(
        self,
        text: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[TextChunk]:
        """
        Split text into overlapping chunks
        
        Args:
            text: Text to chunk
            metadata: Additional metadata to attach to chunks
            
        Returns:
            List of TextChunk objects
        """
        if not text or len(text) < self.min_chunk_size:
            return []
        
        metadata = metadata or {}
        chunks = []
        
        # Clean text
        text = self._clean_text(text)
        
        # Split by paragraphs first
        paragraphs = self._split_paragraphs(text)
        
        current_chunk = ""
        current_start = 0
        chunk_index = 0
        
        for para in paragraphs:
            # If adding this paragraph exceeds chunk size
            if len(current_chunk) + len(para) > self.chunk_size and current_chunk:
                # Save current chunk
                if len(current_chunk) >= self.min_chunk_size:
                    chunks.append(TextChunk(
                        text=current_chunk.strip(),
                        chunk_index=chunk_index,
                        start_char=current_start,
                        end_char=current_start + len(current_chunk),
                        metadata=metadata.copy()
                    ))
                    chunk_index += 1
                
                # Start new chunk with overlap
                old_chunk_len = len(current_chunk)  # capture before reassignment
                overlap_text = self._get_overlap(current_chunk)
                current_start = current_start + old_chunk_len - len(overlap_text)
                current_chunk = overlap_text + para
            else:
                current_chunk += para
        
        # Add final chunk
        if len(current_chunk) >= self.min_chunk_size:
            chunks.append(TextChunk(
                text=current_chunk.strip(),
                chunk_index=chunk_index,
                start_char=current_start,
                end_char=current_start + len(current_chunk),
                metadata=metadata.copy()
            ))
        
        logger.info(f"Created {len(chunks)} chunks from text (length={len(text)})")
        return chunks
    
    def chunk_by_sections(
        self,
        text: str,
        section_pattern: str = r'^#+\s+(.+)$',
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[TextChunk]:
        """
        Split text by sections (e.g., markdown headers)
        
        Args:
            text: Text to chunk
            section_pattern: Regex pattern for section headers
            metadata: Additional metadata
            
        Returns:
            List of TextChunk objects
        """
        metadata = metadata or {}
        chunks = []
        
        # Split into sections
        sections = re.split(section_pattern, text, flags=re.MULTILINE)
        
        chunk_index = 0
        current_pos = 0
        
        for i in range(0, len(sections), 2):
            section_title = sections[i] if i > 0 else ""
            section_text = sections[i + 1] if i + 1 < len(sections) else sections[i]
            
            # Combine title and text
            full_text = f"{section_title}\n\n{section_text}".strip()
            
            if len(full_text) < self.min_chunk_size:
                continue
            
            # If section is too large, split it further
            if len(full_text) > self.chunk_size * 1.5:
                sub_chunks = self.chunk_text(full_text, metadata)
                for sub_chunk in sub_chunks:
                    sub_chunk.chunk_index = chunk_index
                    sub_chunk.metadata["section"] = section_title
                    chunks.append(sub_chunk)
                    chunk_index += 1
            else:
                chunks.append(TextChunk(
                    text=full_text,
                    chunk_index=chunk_index,
                    start_char=current_pos,
                    end_char=current_pos + len(full_text),
                    metadata={**metadata, "section": section_title}
                ))
                chunk_index += 1
            
            current_pos += len(full_text)
        
        logger.info(f"Created {len(chunks)} section-based chunks")
        return chunks
    
    def _clean_text(self, text: str) -> str:
        """Clean and normalize text"""
        # Remove multiple newlines
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        # Remove multiple spaces
        text = re.sub(r' {2,}', ' ', text)
        
        # Remove leading/trailing whitespace from lines
        lines = [line.strip() for line in text.split('\n')]
        text = '\n'.join(lines)
        
        return text.strip()
    
    def _split_paragraphs(self, text: str) -> List[str]:
        """Split text into paragraphs"""
        # Split by double newline or more
        paragraphs = re.split(r'\n\n+', text)
        
        # Filter out empty paragraphs
        paragraphs = [p.strip() + '\n\n' for p in paragraphs if p.strip()]
        
        return paragraphs
    
    def _get_overlap(self, text: str) -> str:
        """Get overlap text from end of chunk"""
        if len(text) <= self.chunk_overlap:
            return text
        
        # Try to find sentence boundary
        overlap_start = len(text) - self.chunk_overlap
        
        # Look for sentence ending (. ! ?)
        sentence_end = text.rfind('.', overlap_start)
        if sentence_end == -1:
            sentence_end = text.rfind('!', overlap_start)
        if sentence_end == -1:
            sentence_end = text.rfind('?', overlap_start)
        
        if sentence_end > overlap_start:
            return text[sentence_end + 1:].strip() + ' '
        
        # Fallback to word boundary
        space_pos = text.rfind(' ', overlap_start)
        if space_pos > overlap_start:
            return text[space_pos + 1:].strip() + ' '
        
        # Last resort: character boundary
        return text[-self.chunk_overlap:]


# Predefined chunking strategies
class ChunkingStrategy:
    """Predefined chunking strategies for different document types"""
    
    @staticmethod
    def code_standards() -> ChunkingService:
        """Strategy for building codes, fire-safety normatives, legal standards.

        Larger chunks keep individual regulatory articles/clauses intact.
        A typical article in a Romanian normative spans 1 000-2 000 characters;
        600-char chunks were splitting them mid-sentence.
        """
        return ChunkingService(
            chunk_size=1500,
            chunk_overlap=300,
            min_chunk_size=150
        )

    @staticmethod
    def general_documents() -> ChunkingService:
        """Strategy for general documents"""
        return ChunkingService(
            chunk_size=1200,
            chunk_overlap=250,
            min_chunk_size=100
        )

    @staticmethod
    def technical_specs() -> ChunkingService:
        """Strategy for technical specifications"""
        return ChunkingService(
            chunk_size=1000,
            chunk_overlap=200,
            min_chunk_size=100
        )
