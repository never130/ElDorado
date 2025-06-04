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
        if model_path is None:
            # Construir la ruta al modelo desde la ubicación de este archivo (backend/utils/image_processing.py)
            # Sube tres niveles para llegar a la raíz del proyecto (ElDorado)
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))              # Construye la ruta al modelo dentro de backend/models/numeros_calados
            model_path = os.path.join(project_root, "backend", "models", "numeros_calados", "yolo_model", "training", "best.pt")

        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"El archivo del modelo YOLOv8 no se encontró en la ruta: {model_path}. "
                f"Verifica que el archivo \'best.pt\' exista en \'ElDorado\\backend\\models\\numeros_calados\\yolo_model\\training\\\'.")
        
        print(f"ℹ️ Cargando modelo YOLO desde: {model_path}")
        self.model = YOLO(model_path)
        self.last_detection = None
        self.min_confidence = 0.25 # <-- Cambiado de 0.5 a 0.25

    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Preprocesa la imagen para mejorar la detección"""
        # Convertir a escala de grises
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        # Mejorar contraste
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(gray)
        # Volver a BGR para YOLO
        return cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)

    def detect_objects(self, image: np.ndarray) -> Dict[str, Any]:
        """Detecta vagoneta, placa y modelo de ladrillo en la imagen"""
        # Preprocesar imagen
        processed_image = self.preprocess_image(image)
        
        # Realizar detección con YOLOv8
        results = self.model(processed_image)[0]
        detections = {
            'vagoneta': None,
            'placa': None,
            'ladrillo': None
        }

        # Procesar resultados
        for box in results.boxes:
            confidence = float(box.conf[0])
            if confidence < self.min_confidence:
                continue

            class_id = int(box.cls[0])
            class_name = results.names[class_id]
            bbox = box.xyxy[0].cpu().numpy()

            if class_name == 'vagoneta':
                detections['vagoneta'] = bbox
            elif class_name == 'placa':
                detections['placa'] = bbox
            elif 'ladrillo' in class_name:
                detections['ladrillo'] = {
                    'bbox': bbox,
                    'tipo': class_name
                }

        return detections

    def process_frame(self, frame: np.ndarray) -> Optional[Dict[str, Any]]:
        """Procesa un frame y retorna la información detectada"""
        # Detectar objetos
        detections = self.detect_objects(frame)
        
        if not detections['placa']:
            return None

        # Extraer y procesar número de placa
        placa_bbox = detections['placa']
        placa_image = frame[
            int(placa_bbox[1]):int(placa_bbox[3]),
            int(placa_bbox[0]):int(placa_bbox[2])
        ]
        numero = extract_number_from_image(placa_image)

        if not numero:
            return None

        # Preparar resultado
        result = {
            'numero': numero,
            'confidence': float(detections['placa'][4]) if len(detections['placa']) > 4 else 0.0,
            'bbox': detections['placa'].tolist(),
        }

        # Agregar información del modelo de ladrillo si se detectó
        if detections['ladrillo']:
            result['modelo_ladrillo'] = detections['ladrillo']['tipo']

        self.last_detection = result
        return result

    def get_last_detection(self) -> Optional[Dict[str, Any]]:
        """Retorna la última detección exitosa"""
        return self.last_detection

# Inicializar el procesador como singleton
processor = ImageProcessor()

def process_image(image: np.ndarray) -> Optional[Dict[str, Any]]:
    """Función auxiliar para procesar una imagen"""
    return processor.process_frame(image)

def detectar_vagoneta_y_placa(image_path: str) -> tuple[Optional[np.ndarray], Optional[np.ndarray], Optional[np.ndarray], Optional[str]]:
    """
    Detecta la vagoneta, la placa, extrae el número de la placa y la imagen recortada de la placa.

    Args:
        image_path (str): Ruta a la imagen a procesar.

    Returns:
        tuple: (cropped_placa_img, bbox_vagoneta, bbox_placa, numero_detectado)
               - cropped_placa_img (Optional[np.ndarray]): Imagen recortada de la placa.
               - bbox_vagoneta (Optional[np.ndarray]): Bounding box de la vagoneta.
               - bbox_placa (Optional[np.ndarray]): Bounding box de la placa.
               - numero_detectado (Optional[str]): Número de placa detectado.
    """
    image = cv2.imread(image_path)
    if image is None:
        print(f"Error: No se pudo cargar la imagen desde {image_path}")
        return None, None, None, None

    # ImageProcessor.detect_objects se encarga del preprocesamiento si es necesario
    detections = processor.detect_objects(image)

    bbox_vagoneta = detections.get('vagoneta')
    bbox_placa = detections.get('placa')
    
    cropped_placa_img = None
    numero_detectado = None

    if bbox_placa is not None:
        # Recortar la imagen de la placa de la imagen original
        placa_y_start, placa_y_end = int(bbox_placa[1]), int(bbox_placa[3])
        placa_x_start, placa_x_end = int(bbox_placa[0]), int(bbox_placa[2])
        
        # Asegurarse que las coordenadas son válidas y están dentro de los límites de la imagen
        placa_y_start = max(0, placa_y_start)
        placa_x_start = max(0, placa_x_start)
        placa_y_end = min(image.shape[0], placa_y_end)
        placa_x_end = min(image.shape[1], placa_x_end)

        if placa_y_start < placa_y_end and placa_x_start < placa_x_end:
            placa_image_cropped = image[placa_y_start:placa_y_end, placa_x_start:placa_x_end]
            if placa_image_cropped.size > 0:
                cropped_placa_img = placa_image_cropped
                numero_detectado = extract_number_from_image(placa_image_cropped)
            else:
                print(f"Advertencia: El recorte de la placa resultó en una imagen vacía para {image_path}")
        else:
            print(f"Advertencia: Coordenadas de recorte de placa inválidas para {image_path}")
            
    return cropped_placa_img, bbox_vagoneta, bbox_placa, numero_detectado

def detectar_modelo_ladrillo(image_path: str) -> Optional[str]:
    """
    Detecta el modelo de ladrillo en la imagen.

    Args:
        image_path (str): Ruta a la imagen a procesar.

    Returns:
        Optional[str]: El tipo de modelo de ladrillo detectado, o None si no se detecta.
    """
    image = cv2.imread(image_path)
    if image is None:
        print(f"Error: No se pudo cargar la imagen desde {image_path}")
        return None
    
    detections = processor.detect_objects(image)
    
    ladrillo_info = detections.get('ladrillo')
    if ladrillo_info and 'tipo' in ladrillo_info:
        return ladrillo_info['tipo']
    return None

def detect_calado_numbers(image: np.ndarray) -> Optional[Dict[str, Any]]:
    """
    Detecta números calados directamente usando el modelo NumerosCalados
    
    Args:
        image (np.ndarray): Imagen a procesar
        
    Returns:
        Optional[Dict[str, Any]]: Información de detección con número, confianza y bbox
    """
    try:
        # Realizar detección directa con YOLOv8 usando múltiples configuraciones
        # para maximizar las posibilidades de detección
        best_detection = None
        best_confidence = 0.0
        
        # Configuraciones de detección para probar
        detection_configs = [
            {"imgsz": 640, "conf": 0.05},   # Configuración estándar con umbral muy bajo
            {"imgsz": 1280, "conf": 0.05},  # Resolución alta con umbral muy bajo
            {"imgsz": 320, "conf": 0.01},   # Resolución baja con umbral ultra bajo
        ]
        
        print(f"🔍 Probando {len(detection_configs)} configuraciones de detección...")
        
        for i, config in enumerate(detection_configs):
            try:
                results = processor.model(image, **config)[0]
                
                total_detections = len(results.boxes) if results.boxes is not None else 0
                if total_detections > 0:
                    print(f"  Config {i+1} (imgsz={config['imgsz']}, conf={config['conf']}): {total_detections} detecciones")
                    
                    # Procesar detecciones de esta configuración
                    for box in results.boxes:
                        confidence = float(box.conf[0])
                        class_id = int(box.cls[0])
                        class_name = results.names[class_id]
                        bbox = box.xyxy[0].cpu().numpy()
                        
                        print(f"    Detección: '{class_name}' - Confianza: {confidence:.3f}")
                        
                        # Quedarse con la detección de mayor confianza
                        if confidence > best_confidence:
                            best_confidence = confidence
                            best_detection = {
                                'numero': class_name,
                                'confidence': confidence,
                                'bbox': bbox.tolist(),
                                'class_id': class_id,
                                'config_used': f"imgsz={config['imgsz']}_conf={config['conf']}"
                            }
                else:
                    print(f"  Config {i+1} (imgsz={config['imgsz']}, conf={config['conf']}): 0 detecciones")
                    
            except Exception as config_error:
                print(f"  Config {i+1}: Error - {config_error}")
                continue
        
        if best_detection:
            print(f"✅ Mejor detección: '{best_detection['numero']}' (confianza: {best_detection['confidence']:.3f}) usando {best_detection['config_used']}")
            return best_detection
        else:
            print("⚠️ No se detectaron números calados en la imagen con ninguna configuración")
            return None
            
    except Exception as e:
        print(f"❌ Error procesando imagen para números calados: {e}")
        return None

def process_image_calados(image: np.ndarray) -> Optional[Dict[str, Any]]:
    """
    Función principal para procesar imágenes con el modelo de números calados
    Reemplaza a process_image para el sistema de auto-captura
    """
    return detect_calado_numbers(image)
