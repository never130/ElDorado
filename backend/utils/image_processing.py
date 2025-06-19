import torch
from ultralytics import YOLO
from ultralytics.nn.tasks import DetectionModel
from ultralytics.nn.modules.conv import Conv as UltralyticsConv # Import Ultralytics Conv
from ultralytics.nn.modules.conv import Concat # Import Concat
from torch.nn.modules.container import Sequential, ModuleList # Import ModuleList
from torch.nn.modules.conv import Conv2d # Importar Conv2d
from torch.nn.modules.batchnorm import BatchNorm2d # Import BatchNorm2d
from torch.nn.modules.activation import SiLU # Import SiLU
from ultralytics.nn.modules.block import C2f, Bottleneck, SPPF # Import C2f, Bottleneck, and SPPF
from ultralytics.nn.modules.block import DFL # Import DFL
from torch.nn.modules.pooling import MaxPool2d # Import MaxPool2d
from torch.nn.modules.upsampling import Upsample # Import Upsample
from ultralytics.nn.modules.head import Detect # Import Detect
import os
import cv2
import numpy as np
from typing import Optional, Dict, Any # Add this line
from .ocr import extract_number_from_image # <--- Añadir esta línea
from .number_grouping import detectar_numero_compuesto_desde_resultados, analizar_calidad_deteccion # Importar nueva funcionalidad

_PLACEHOLDER_CROPPED_IMAGE = np.zeros((1, 1, 3), dtype=np.uint8)

# Permitir la deserialización de clases específicas si es necesario
# Esto es crucial si el modelo .pt fue guardado con una versión de PyTorch
# que incluía estas clases directamente en el archivo de pesos.
# Solo añade clases aquí si confías plenamente en el origen del archivo .pt.
try:
    # Lista de clases que pueden ser necesarias para tu modelo YOLOv8
    # Es posible que necesites añadir más clases dependiendo de la arquitectura exacta
    # y cómo fue guardado el modelo.
    safe_globals_list = [
        DetectionModel,
        Sequential,
        Conv2d,
        UltralyticsConv, # Add Ultralytics Conv to the list
        BatchNorm2d, # Add BatchNorm2d to the list
        SiLU, # Add SiLU to the list
        C2f, # Add C2f to the list
        ModuleList, # Add ModuleList to the list
        Bottleneck, # Add Bottleneck to the list
        SPPF, # Add SPPF to the list
        MaxPool2d, # Add MaxPool2d to the list
        Upsample, # Add Upsample to the list
        Concat, # Add Concat to the list - Corrected typo here
        Detect, # Add Detect to the list
        DFL # Add DFL to the list
    ]
    # Añadir más clases si aparecen errores similares para otras clases
    # Ejemplo: from another_module import AnotherClass
    # safe_globals_list.append(AnotherClass)

    torch.serialization.add_safe_globals(safe_globals_list)
    print(f"ℹ️ Clases seguras para deserialización de PyTorch añadidas: {safe_globals_list}")
except AttributeError:
    print("⚠️ torch.serialization.add_safe_globals no está disponible. Esto es normal en versiones antiguas de PyTorch.")
except Exception as e:
    print(f"❓ Error al intentar añadir clases seguras para PyTorch: {e}")


class ImageProcessor:
    def __init__(self, model_path: Optional[str] = None): # Hacer model_path opcional
        """Inicializa el procesador de imágenes con YOLOv8"""
        if model_path is None:            # Construir la ruta al modelo desde la ubicación de este archivo (backend/utils/image_processing.py)
            # Sube tres niveles para llegar a la raíz del proyecto (ElDorado)
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))              # Construye la ruta al modelo dentro de backend/models/numeros_enteros
            model_path = os.path.join(project_root, "backend", "models", "numeros_enteros", "yolo_model", "training", "best.pt")

        if not os.path.exists(model_path):            raise FileNotFoundError(
                f"El archivo del modelo YOLOv8 no se encontró en la ruta: {model_path}. "
                f"Verifica que el archivo \'best.pt\' exista en \'ElDorado\\backend\\models\\numeros_enteros\\yolo_model\\training\\\'.")
        
        print(f"ℹ️ Cargando modelo YOLO desde: {model_path}")
        self.model = YOLO(model_path)
        self.last_detection = None
        self.min_confidence = 0.15  # Reducido para mejorar detección de números enteros

    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Preprocesa la imagen para mejorar la detección"""
        # Convertir a escala de grises
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        # Mejorar contraste
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(gray)
        # Volver a BGR para YOLO
        return cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)

    def detect_objects_unified(self, image: np.ndarray, umbral_agrupacion: int = 50) -> Dict[str, Any]:
        """
        Función unificada que detecta todos los objetos de interés en una sola pasada del modelo.
        Detecta: vagoneta, número de vagoneta (agrupando dígitos), y tipo de ladrillo.
        """
        if image is None or image.size == 0:
            print("❌ Error: Imagen de entrada es None o está vacía en detect_objects_unified.")
            return {}

        # 1. Ejecutar el modelo UNA SOLA VEZ
        processed_image = self.preprocess_image(image)
        results = self.model(processed_image, conf=self.min_confidence)

        if not results or not results[0].boxes:
            return {}
        
        results_obj = results[0] # Main result object

        # 2. Agrupar los dígitos para formar el número de vagoneta
        _, numero_compuesto, info_numero = detectar_numero_compuesto_desde_resultados(
            results, 
            image.copy(), 
            umbral_agrupacion
        )

        final_result = {
            'numero_detectado': None,
            'confianza_numero': None,
            'bbox_numero': None,
            'modelo_ladrillo': None,
            'confianza_ladrillo': None,
            'bbox_ladrillo': None,
            'bbox_vagoneta': None,
            'confianza_vagoneta': None,
        }

        if numero_compuesto and info_numero:
            final_result['numero_detectado'] = numero_compuesto
            final_result['confianza_numero'] = info_numero.get('confidence')
            final_result['bbox_numero'] = info_numero.get('bbox')

        # 3. Extraer detecciones de ladrillo y vagoneta del MISMO resultado
        best_ladrillo = None
        best_vagoneta = None

        for box in results_obj.boxes:
            confidence = float(box.conf[0])
            class_id = int(box.cls[0])
            class_name = results_obj.names[class_id]
            bbox = box.xyxy[0].cpu().numpy()

            if 'ladrillo' in class_name:
                if best_ladrillo is None or confidence > best_ladrillo['confidence']:
                    best_ladrillo = {
                        'tipo': class_name,
                        'confidence': confidence,
                        'bbox': bbox
                    }

            if class_name == 'vagoneta':
                 if best_vagoneta is None or confidence > best_vagoneta['confidence']:
                    best_vagoneta = {
                        'confidence': confidence,
                        'bbox': bbox
                    }
        
        if best_ladrillo:
            final_result['modelo_ladrillo'] = best_ladrillo['tipo']
            final_result['confianza_ladrillo'] = best_ladrillo['confidence']
            final_result['bbox_ladrillo'] = best_ladrillo['bbox']

        if best_vagoneta:
            final_result['bbox_vagoneta'] = best_vagoneta['bbox']
            final_result['confianza_vagoneta'] = best_vagoneta['confidence']

        self.last_detection = final_result # Update last detection
        return final_result

    def get_last_detection(self) -> Optional[Dict[str, Any]]:
        """Retorna la última detección exitosa"""
        return self.last_detection

# Inicializar el procesador como singleton
processor = ImageProcessor()

def run_detection_on_path(image_path: str) -> Dict[str, Any]:
    """
    Función principal para ejecutar la detección unificada en una imagen desde una ruta.
    Carga una imagen, la procesa y devuelve todos los objetos detectados.

    Args:
        image_path (str): Ruta a la imagen a procesar.

    Returns:
        Dict[str, Any]: Un diccionario con los resultados de la detección.
    """
    image = cv2.imread(image_path)
    if image is None:
        print(f"Error: No se pudo cargar la imagen desde {image_path}")
        return {}
    
    return processor.detect_objects_unified(image)

def run_detection_on_frame(frame: np.ndarray) -> Dict[str, Any]:
    """
    Función principal para ejecutar la detección unificada en un frame (np.ndarray).

    Args:
        frame (np.ndarray): El frame de video a procesar.

    Returns:
        Dict[str, Any]: Un diccionario con los resultados de la detección.
    """
    if frame is None or frame.size == 0:
        print("Error: El frame de entrada está vacío o es None.")
        return {}
        
    return processor.detect_objects_unified(frame)
