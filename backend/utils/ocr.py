import cv2
import numpy as np
import pytesseract
import re
from typing import Optional

def preprocess_for_ocr(image: np.ndarray) -> Optional[np.ndarray]:
    """Preprocesa una imagen para mejorar el OCR"""
    if image is None or not isinstance(image, np.ndarray) or image.size == 0:
        print("Error en preprocess_for_ocr: La imagen de entrada es None, no es un array numpy o está vacía.")
        return None

    # Convertir a escala de grises
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Aplicar umbral adaptativo
    thresh = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY_INV, 11, 2
    )
    
    # Reducir ruido
    kernel = np.ones((2,2), np.uint8)
    cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    
    return cleaned

def validate_number(text: str) -> Optional[str]:
    """Valida y limpia el número detectado"""
    # Eliminar espacios y caracteres no deseados
    cleaned = re.sub(r'[^0-9]', '', text)
    
    # Validar longitud (ajustar según tus números de vagoneta)
    if len(cleaned) >= 2 and len(cleaned) <= 5:
        return cleaned
    return None

def extract_number_from_image(image: np.ndarray) -> Optional[str]:
    """Extrae el número de una imagen de placa"""
    if image is None or not isinstance(image, np.ndarray) or image.size == 0:
        print("Error en extract_number_from_image: La imagen de entrada es None, no es un array numpy o está vacía.")
        return None

    # Preprocesar imagen
    processed = preprocess_for_ocr(image)
    
    if processed is None:
        print("Error en extract_number_from_image: Falló el preprocesamiento de la imagen.")
        return None
    
    # Configurar Tesseract para números
    custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789'
    
    try:
        # Realizar OCR
        text = pytesseract.image_to_string(processed, config=custom_config)
        
        # Validar y limpiar resultado
        number = validate_number(text)
        
        if not number:
            # Intentar con configuración alternativa
            custom_config = r'--oem 3 --psm 7 -c tessedit_char_whitelist=0123456789'
            text = pytesseract.image_to_string(processed, config=custom_config)
            number = validate_number(text)
        
        return number
    except Exception as e:
        print(f"Error en OCR: {str(e)}")
        return None
