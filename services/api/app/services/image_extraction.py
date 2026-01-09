"""
Image Extraction Service
Extracts images from DOCX and PDF documents
"""

import logging
import os
import tempfile
from typing import List, Dict, Any, Optional
from io import BytesIO
from pathlib import Path
import hashlib

logger = logging.getLogger(__name__)


class ImageExtractionService:
    """Service for extracting images from documents"""
    
    def __init__(self):
        self.supported_formats = {'.docx', '.pdf'}
    
    def extract_images_from_docx(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Extract images from DOCX file
        
        Args:
            file_path: Path to DOCX file
            
        Returns:
            List of dicts with image data and metadata
        """
        try:
            from docx import Document
            from docx.oxml import parse_xml
            import zipfile
            
            images = []
            doc = Document(file_path)
            
            # Method 1: Extract inline pictures from document
            for rel_id, rel in doc.part.rels.items():
                if "image" in rel.target_ref:
                    try:
                        image_data = rel.target_part.blob
                        
                        # Get image format from content type
                        content_type = rel.target_part.content_type
                        extension = self._get_extension_from_content_type(content_type)
                        
                        # Generate hash for deduplication
                        image_hash = hashlib.md5(image_data).hexdigest()
                        
                        images.append({
                            'data': image_data,
                            'format': extension,
                            'content_type': content_type,
                            'hash': image_hash,
                            'source': 'docx_inline',
                            'size': len(image_data)
                        })
                    except Exception as e:
                        logger.warning(f"Failed to extract image {rel_id}: {e}")
            
            # Method 2: Extract from zip structure (more reliable)
            with zipfile.ZipFile(file_path, 'r') as docx_zip:
                for file_info in docx_zip.filelist:
                    if file_info.filename.startswith('word/media/'):
                        try:
                            image_data = docx_zip.read(file_info.filename)
                            
                            # Determine format from filename
                            extension = Path(file_info.filename).suffix.lower()
                            content_type = self._get_content_type_from_extension(extension)
                            
                            # Generate hash
                            image_hash = hashlib.md5(image_data).hexdigest()
                            
                            # Check if already extracted (deduplicate)
                            if not any(img['hash'] == image_hash for img in images):
                                images.append({
                                    'data': image_data,
                                    'format': extension,
                                    'content_type': content_type,
                                    'hash': image_hash,
                                    'source': 'docx_media',
                                    'filename': Path(file_info.filename).name,
                                    'size': len(image_data)
                                })
                        except Exception as e:
                            logger.warning(f"Failed to extract {file_info.filename}: {e}")
            
            logger.info(f"Extracted {len(images)} images from DOCX")
            return images
            
        except Exception as e:
            logger.error(f"Error extracting images from DOCX: {e}", exc_info=True)
            return []
    
    def extract_images_from_pdf(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Extract images from PDF file
        
        Args:
            file_path: Path to PDF file
            
        Returns:
            List of dicts with image data and metadata
        """
        try:
            import fitz  # PyMuPDF
            
            images = []
            doc = fitz.open(file_path)
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                image_list = page.get_images()
                
                for img_index, img in enumerate(image_list):
                    try:
                        xref = img[0]
                        base_image = doc.extract_image(xref)
                        
                        image_data = base_image["image"]
                        extension = base_image["ext"]
                        
                        # Generate hash
                        image_hash = hashlib.md5(image_data).hexdigest()
                        
                        # Check for duplicates
                        if not any(img['hash'] == image_hash for img in images):
                            images.append({
                                'data': image_data,
                                'format': f'.{extension}',
                                'content_type': self._get_content_type_from_extension(f'.{extension}'),
                                'hash': image_hash,
                                'source': 'pdf',
                                'page': page_num + 1,
                                'size': len(image_data)
                            })
                    except Exception as e:
                        logger.warning(f"Failed to extract image {img_index} from page {page_num}: {e}")
            
            doc.close()
            logger.info(f"Extracted {len(images)} unique images from PDF")
            return images
            
        except ImportError:
            logger.error("PyMuPDF (fitz) not installed. Install with: pip install pymupdf")
            return []
        except Exception as e:
            logger.error(f"Error extracting images from PDF: {e}", exc_info=True)
            return []
    
    def extract_images(self, file_path: str, mime_type: str) -> List[Dict[str, Any]]:
        """
        Extract images from document based on type
        
        Args:
            file_path: Path to document file
            mime_type: MIME type of the document
            
        Returns:
            List of extracted images with metadata
        """
        extension = Path(file_path).suffix.lower()
        
        if extension == '.docx' or 'wordprocessingml' in mime_type:
            return self.extract_images_from_docx(file_path)
        elif extension == '.pdf' or mime_type == 'application/pdf':
            return self.extract_images_from_pdf(file_path)
        else:
            logger.warning(f"Unsupported format for image extraction: {extension}")
            return []
    
    def save_image_to_temp(self, image_data: bytes, format: str) -> str:
        """
        Save image data to temporary file
        
        Args:
            image_data: Raw image bytes
            format: Image format (e.g., '.png', '.jpg')
            
        Returns:
            Path to temporary file
        """
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=format
        ) as tmp_file:
            tmp_file.write(image_data)
            return tmp_file.name
    
    def _get_extension_from_content_type(self, content_type: str) -> str:
        """Map content type to file extension"""
        mapping = {
            'image/png': '.png',
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/gif': '.gif',
            'image/bmp': '.bmp',
            'image/tiff': '.tiff',
            'image/svg+xml': '.svg',
            'image/webp': '.webp'
        }
        return mapping.get(content_type, '.png')
    
    def _get_content_type_from_extension(self, extension: str) -> str:
        """Map file extension to content type"""
        mapping = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.tiff': 'image/tiff',
            '.svg': 'image/svg+xml',
            '.webp': 'image/webp',
            '.emf': 'image/x-emf',
            '.wmf': 'image/x-wmf'
        }
        return mapping.get(extension.lower(), 'image/png')
