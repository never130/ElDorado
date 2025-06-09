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

    def detect_objects(self, image: np.ndarray) -> Dict[str, Any]:
        """Detecta vagoneta, placa y modelo de ladrillo en la imagen"""
        if image is None:
            print("❌ Error Crítico: ImageProcessor.detect_objects recibió una imagen None.")
            # Devuelve detecciones vacías para evitar más errores si esto ocurre.
            return {'vagoneta': None, 'placa': None, 'ladrillo': None}

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
            
            detection_info = {'bbox': bbox, 'confidence': confidence}

            if class_name == 'vagoneta':
                detections['vagoneta'] = detection_info
            elif class_name == 'placa':
                detections['placa'] = detection_info
            elif 'ladrillo' in class_name: # Asumiendo que ladrillo también podría querer confianza
                detections['ladrillo'] = {
                    'bbox': bbox,
                    'tipo': class_name,
                    'confidence': confidence
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
        }        # Agregar información del modelo de ladrillo si se detectó
        if detections['ladrillo']:
            result['modelo_ladrillo'] = detections['ladrillo']['tipo']
        
        self.last_detection = result
        return result

    def get_last_detection(self) -> Optional[Dict[str, Any]]:
        """Retorna la última detección exitosa"""
        return self.last_detection

    def detect_calado_numbers_mejorado(self, image: np.ndarray, umbral_agrupacion: int = 50) -> Optional[Dict[str, Any]]:
        """
        Versión mejorada que detecta y agrupa números individuales en números compuestos.
        Integra la lógica del código de Colab con tu modelo existente.
        """
        try:
            # Verificar que la imagen es válida
            if image is None:
                print("❌ Error: imagen es None")
                return None
                
            if not hasattr(image, 'ndim') or image.ndim != 3:
                print(f"❌ Error: imagen inválida, ndim = {getattr(image, 'ndim', 'N/A')}")
                return None
                
            if image.size == 0:
                print("❌ Error: imagen vacía")
                return None
            
            # Aplicar tu modelo actual de números enteros
            results = self.model(image, conf=self.min_confidence)
            
            if not results or not results[0].boxes:
                return None
            
            # Usar la nueva función de agrupación
            frame_procesado, numero_compuesto, info_deteccion = detectar_numero_compuesto_desde_resultados(
                results, 
                image.copy(), 
                umbral_agrupacion
            )
            
            if numero_compuesto and info_deteccion:
                # Analizar calidad de la detección
                analisis_calidad = analizar_calidad_deteccion(info_deteccion)
                
                # Agregar información adicional
                info_deteccion.update({
                    'numero': numero_compuesto,
                    'calidad': analisis_calidad,
                    'frame_procesado': frame_procesado is not None
                })
                
                self.last_detection = info_deteccion
                return info_deteccion
            
            return None
            
        except Exception as e:
            print(f"❌ Error en detect_calado_numbers_mejorado: {e}")
            import traceback
            traceback.print_exc()
            return None

    def detect_calado_numbers(self, image: np.ndarray) -> Optional[Dict[str, Any]]:
        """
        Función original mantenida como fallback
        """
        if image is None:
            print("❌ Error Crítico: ImageProcessor.detect_calado_numbers recibió una imagen None.")
            return None
        try:
            results = self.model(image, conf=self.min_confidence)[0]
            
            # Verificar si hay detecciones válidas
            if results.boxes is None or len(results.boxes.xyxy) == 0:
                return None
            
            # Obtener la mejor detección (mayor confianza)
            best_idx = torch.argmax(results.boxes.conf)
            best_box = results.boxes.xyxy[best_idx]
            best_conf = results.boxes.conf[best_idx]
            best_cls = results.boxes.cls[best_idx]
            
            # Extraer coordenadas del bounding box
            x1, y1, x2, y2 = map(int, best_box)
            
            # Recortar la región de la placa
            cropped_image = image[y1:y2, x1:x2]
            
            if cropped_image.size == 0:
                return None
            
            # Aplicar OCR usando tu función existente
            numero_detectado = extract_number_from_image(cropped_image)
            
            if numero_detectado:
                return {
                    'numero': numero_detectado,
                    'confidence': float(best_conf),
                    'bbox': (x1, y1, x2, y2),
                    'class_id': int(best_cls),
                    'cropped_image': cropped_image
                }
            
            return None
            
        except Exception as e:
            print(f"Error en detect_calado_numbers: {e}")
            return None
       

# Inicializar el procesador como singleton
processor = ImageProcessor()

def process_image(image: np.ndarray) -> Optional[Dict[str, Any]]:
    """Función auxiliar para procesar una imagen"""
    return processor.process_frame(image)

def detectar_vagoneta_y_placa(image_data: np.ndarray) -> tuple[np.ndarray, Optional[np.ndarray], Optional[np.ndarray], Optional[str], Optional[float]]:
    """
    Detecta la vagoneta, la placa, extrae el número de la placa, la imagen recortada de la placa y la confianza de detección de la placa.

    Args:
        image_data (np.ndarray): Imagen a procesar (NumPy array).

    Returns:
        tuple: (cropped_placa_img, bbox_vagoneta, bbox_placa, numero_detectado, confianza)
               - cropped_placa_img (np.ndarray): Imagen recortada de la placa (or placeholder).
               - bbox_vagoneta (Optional[np.ndarray]): Bounding box de la vagoneta.
               - bbox_placa (Optional[np.ndarray]): Bounding box de la placa.
               - numero_detectado (Optional[str]): Número de placa detectado.
               - confianza_placa (Optional[float]): Confianza de la detección de la placa.
    """
    image = image_data 
    if image is None or not hasattr(image, 'size') or image.size == 0: 
        print(f"Error: Imagen de entrada es None, no es un array numpy válido o está vacía en detectar_vagoneta_y_placa.")
        return _PLACEHOLDER_CROPPED_IMAGE, None, None, None, None

    detections = processor.detect_objects(image)

    bbox_vagoneta_info = detections.get('vagoneta')
    bbox_placa_info = detections.get('placa')
    
    bbox_vagoneta = bbox_vagoneta_info['bbox'] if bbox_vagoneta_info else None
    bbox_placa_coords = bbox_placa_info['bbox'] if bbox_placa_info else None
    placa_confidence = bbox_placa_info['confidence'] if bbox_placa_info else None
    
    actual_cropped_placa_img = None
    numero_detectado = None

    if bbox_placa_coords is not None:
        placa_y_start, placa_y_end = int(bbox_placa_coords[1]), int(bbox_placa_coords[3])
        placa_x_start, placa_x_end = int(bbox_placa_coords[0]), int(bbox_placa_coords[2])
        
        placa_y_start = max(0, placa_y_start)
        placa_x_start = max(0, placa_x_start)
        placa_y_end = min(image.shape[0], placa_y_end)
        placa_x_end = min(image.shape[1], placa_x_end)

        if placa_y_start < placa_y_end and placa_x_start < placa_x_end:
            placa_image_cropped = image[placa_y_start:placa_y_end, placa_x_start:placa_x_end]
            if placa_image_cropped.size > 0:
                actual_cropped_placa_img = placa_image_cropped
                numero_detectado = extract_number_from_image(actual_cropped_placa_img)
            else:
                print(f"Advertencia: El recorte de la placa resultó en una imagen vacía.")
        else:
            print(f"Advertencia: Coordenadas de recorte de placa inválidas.")
            
    return (actual_cropped_placa_img if actual_cropped_placa_img is not None else _PLACEHOLDER_CROPPED_IMAGE), \
           bbox_vagoneta, bbox_placa_coords, numero_detectado, placa_confidence

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

def detectar_vagoneta_y_placa_mejorado(image_data: np.ndarray, usar_agrupacion: bool = True) -> tuple[np.ndarray, Optional[np.ndarray], Optional[np.ndarray], Optional[str], Optional[float]]:
    """
    Versión mejorada que integra agrupación de números compuestos y devuelve confianza.
    
    Args:
        image_data (np.ndarray): Imagen a procesar (NumPy array).
        usar_agrupacion (bool): Si usar agrupación de números compuestos
    Returns:
        tuple: (cropped_placa_img, bbox_vagoneta, bbox_placa, numero_detectado, confianza)
               - cropped_placa_img (np.ndarray): Imagen recortada de la placa (or placeholder).
               - bbox_vagoneta (Optional[np.ndarray]): Bounding box de la vagoneta.
               - bbox_placa (Optional[np.ndarray]): Bounding box de la placa.
               - numero_detectado (Optional[str]): Número de placa detectado.
               - confianza (Optional[float]): Confianza de la detección.
    """
    try:
        image = image_data 

        if image is None or not isinstance(image, np.ndarray): 
            print(f"❌ Error: image_data es None o no es un array numpy en detectar_vagoneta_y_placa_mejorado")
            return _PLACEHOLDER_CROPPED_IMAGE, None, None, None, None
            
        if not hasattr(image, 'ndim') or image.ndim != 3: 
            print(f"❌ Error: imagen inválida (ndim != 3), ndim = {getattr(image, 'ndim', 'N/A')}")
            return _PLACEHOLDER_CROPPED_IMAGE, None, None, None, None
            
        if image.size == 0:
            print(f"❌ Error: imagen vacía") 
            return _PLACEHOLDER_CROPPED_IMAGE, None, None, None, None

        if usar_agrupacion:
            resultado = processor.detect_calado_numbers_mejorado(image) 
            
            if resultado and resultado.get('numero'):
                bbox_placa_from_resultado = resultado.get('bbox')
                numero_detectado = resultado.get('numero')
                confianza = resultado.get('confidence') # Clave 'confidence' según el log
                
                actual_cropped_placa_img = None
                bbox_vagoneta = None

                if bbox_placa_from_resultado is not None:
                    x1, y1, x2, y2 = map(int, bbox_placa_from_resultado)
                    x1, y1 = max(0, x1), max(0, y1)
                    x2 = min(image.shape[1], x2)
                    y2 = min(image.shape[0], y2)
                    
                    if y1 < y2 and x1 < x2:
                        actual_cropped_placa_img = image[y1:y2, x1:x2]
                    
                try:
                    detections_obj = processor.detect_objects(image) # Renamed to avoid conflict
                    vagoneta_info = detections_obj.get('vagoneta')
                    if vagoneta_info:
                        bbox_vagoneta = vagoneta_info['bbox']
                except Exception as det_error:
                    print(f"⚠️ Error detectando vagoneta: {det_error}")
                
                print(f"✅ Detección mejorada: {numero_detectado} (confianza: {confianza if confianza is not None else 'N/A'}, calidad: {resultado.get('calidad', {}).get('calidad', 'N/A')})")
                
                return (actual_cropped_placa_img if actual_cropped_placa_img is not None else _PLACEHOLDER_CROPPED_IMAGE), \
                       bbox_vagoneta, \
                       (np.array(bbox_placa_from_resultado) if bbox_placa_from_resultado is not None else None), \
                       numero_detectado, \
                       confianza
            
            print("⚠️ No se detectó número con agrupación, intentando método original...")
            # Fallback ahora devuelve 5 elementos
            return detectar_vagoneta_y_placa(image) 
        
        # Si no usar_agrupacion, llamar al método original (que ahora también devuelve 5 elementos)
        return detectar_vagoneta_y_placa(image) 
        
    except Exception as e:
        print(f"❌ Error en detección mejorada: {e}, usando método original...")
        import traceback
        traceback.print_exc()
        try:
            # Fallback ahora devuelve 5 elementos
            return detectar_vagoneta_y_placa(image) 
        except Exception as fallback_error:
            print(f"❌ Error también en método original (durante el fallback de detección mejorada): {fallback_error}")
            traceback.print_exc() # <--- AÑADIDO: Imprimir traza completa del error de fallback
            return _PLACEHOLDER_CROPPED_IMAGE, None, None, None, None
