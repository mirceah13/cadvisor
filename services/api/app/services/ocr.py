"""
OCR Service
Extracts text from images using Tesseract
"""

import logging
from typing import Optional, Dict, Any
from pathlib import Path
import cv2
import numpy as np

logger = logging.getLogger(__name__)


class OCRService:
    """Service for extracting text from images using OCR"""
    
    def __init__(self):
        self.tesseract_available = self._check_tesseract()
    
    def _check_tesseract(self) -> bool:
        """Check if Tesseract is installed"""
        try:
            import pytesseract
            # Try to get version to verify installation
            pytesseract.get_tesseract_version()
            return True
        except Exception as e:
            logger.warning(f"Tesseract not available: {e}")
            return False
    
    def extract_text_from_image(
        self,
        image_path: str,
        language: str = 'ron+eng',  # Romanian + English
        preprocess: bool = True
    ) -> Dict[str, Any]:
        """
        Extract text from image using OCR
        
        Args:
            image_path: Path to image file
            language: Tesseract language code(s)
            preprocess: Whether to preprocess image for better OCR
            
        Returns:
            Dict with extracted text and metadata
        """
        if not self.tesseract_available:
            return {
                'text': '',
                'confidence': 0.0,
                'error': 'Tesseract not available'
            }
        
        try:
            import pytesseract
            
            # Read image
            image = cv2.imread(image_path)
            
            if image is None:
                return {
                    'text': '',
                    'confidence': 0.0,
                    'error': 'Failed to load image'
                }
            
            # Preprocess image for better OCR
            if preprocess:
                image = self._preprocess_image(image)
            
            # Extract text with detailed data
            data = pytesseract.image_to_data(
                image,
                lang=language,
                output_type=pytesseract.Output.DICT
            )
            
            # Get full text
            text = pytesseract.image_to_string(image, lang=language)
            
            # Calculate average confidence
            confidences = [int(conf) for conf in data['conf'] if conf != '-1']
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            
            # Extract structured data (words with positions and confidence)
            words = []
            n_boxes = len(data['text'])
            for i in range(n_boxes):
                if int(data['conf'][i]) > 0:  # Only confident detections
                    words.append({
                        'text': data['text'][i],
                        'confidence': int(data['conf'][i]),
                        'x': data['left'][i],
                        'y': data['top'][i],
                        'width': data['width'][i],
                        'height': data['height'][i]
                    })
            
            return {
                'text': text.strip(),
                'confidence': avg_confidence,
                'word_count': len([w for w in words if w['text'].strip()]),
                'words': words,
                'language': language
            }
            
        except Exception as e:
            logger.error(f"Error during OCR: {e}", exc_info=True)
            return {
                'text': '',
                'confidence': 0.0,
                'error': str(e)
            }
    
    def _preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """
        Preprocess image for better OCR results
        
        Args:
            image: OpenCV image (numpy array)
            
        Returns:
            Preprocessed image
        """
        # Convert to grayscale
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Apply denoising
        denoised = cv2.fastNlMeansDenoising(gray)
        
        # Apply adaptive thresholding to handle varying lighting
        thresh = cv2.adaptiveThreshold(
            denoised,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            11,
            2
        )
        
        # Deskew image if needed (basic implementation)
        thresh = self._deskew(thresh)
        
        return thresh
    
    def _deskew(self, image: np.ndarray) -> np.ndarray:
        """Deskew image to correct rotation"""
        try:
            coords = np.column_stack(np.where(image > 0))
            angle = cv2.minAreaRect(coords)[-1]
            
            # Adjust angle
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle
            
            # Only deskew if angle is significant
            if abs(angle) > 0.5:
                (h, w) = image.shape[:2]
                center = (w // 2, h // 2)
                M = cv2.getRotationMatrix2D(center, angle, 1.0)
                rotated = cv2.warpAffine(
                    image,
                    M,
                    (w, h),
                    flags=cv2.INTER_CUBIC,
                    borderMode=cv2.BORDER_REPLICATE
                )
                return rotated
        except Exception as e:
            logger.warning(f"Deskewing failed: {e}")
        
        return image
    
    def extract_technical_annotations(
        self,
        image_path: str,
        patterns: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        Extract technical annotations (angles, measurements) from diagrams
        
        Args:
            image_path: Path to technical diagram
            patterns: List of regex patterns to extract
            
        Returns:
            Dict with extracted annotations
        """
        import re
        
        result = self.extract_text_from_image(image_path)
        
        if not result['text']:
            return result
        
        # Default patterns for technical drawings
        if patterns is None:
            patterns = [
                r'α[≤>=<]+\d+°',  # Angle specifications (α≤80°)
                r'\d+°',           # Plain angles
                r'\d+\s*mm',       # Millimeters
                r'\d+\s*cm',       # Centimeters
                r'\d+\s*m',        # Meters
                r'[A-Z]\d+',       # Labels (A1, B2, etc.)
            ]
        
        annotations = []
        text = result['text']
        
        for pattern in patterns:
            matches = re.findall(pattern, text)
            annotations.extend(matches)
        
        result['annotations'] = list(set(annotations))  # Remove duplicates
        result['annotation_count'] = len(result['annotations'])
        
        return result
