"""
Filtro de estabilización temporal para mejorar la precisión de detecciones en tiempo real.
Este módulo implementa técnicas para reducir falsos positivos y mejorar la confianza
de las detecciones mediante análisis temporal y filtrado inteligente.
"""

import time
from collections import defaultdict, deque
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import numpy as np

@dataclass
class Detection:
    """Estructura para almacenar información de una detección"""
    numero: str
    modelo: Optional[str]
    confidence: float
    timestamp: float
    bbox: Tuple[int, int, int, int]  # x1, y1, x2, y2

class TemporalStabilizer:
    """
    Filtro que estabiliza las detecciones a lo largo del tiempo para reducir 
    fluctuaciones y mejorar la precisión final
    """
    
    def __init__(self, 
                 window_seconds: float = 3.0,
                 min_detections: int = 3,
                 confidence_threshold: float = 0.4,
                 stability_threshold: float = 0.6):
        """
        Args:
            window_seconds: Ventana de tiempo para análisis temporal
            min_detections: Mínimo número de detecciones para confirmar
            confidence_threshold: Umbral mínimo de confianza individual
            stability_threshold: Umbral de estabilidad para confirmar detección
        """
        self.window_seconds = window_seconds
        self.min_detections = min_detections
        self.confidence_threshold = confidence_threshold
        self.stability_threshold = stability_threshold
        
        # Buffer circular para detecciones recientes
        self.detection_buffer: deque = deque(maxlen=50)
        
        # Contadores por número detectado
        self.number_counts: Dict[str, List[Detection]] = defaultdict(list)
        
        # Última detección confirmada para evitar duplicados
        self.last_confirmed: Optional[Dict] = None
        self.last_confirmed_time: float = 0
        
    def add_detection(self, numero: str, modelo: Optional[str], confidence: float, 
                     bbox: Tuple[int, int, int, int]) -> Optional[Dict]:
        """
        Añade una nueva detección y retorna una detección estabilizada si es confirmada
        
        Returns:
            Dict con detección confirmada o None si no se confirma
        """
        current_time = time.time()
        
        # Filtrar detecciones con muy baja confianza
        if confidence < self.confidence_threshold * 0.7:  # 70% del umbral
            return None
            
        # Crear nueva detección
        detection = Detection(
            numero=numero,
            modelo=modelo,
            confidence=confidence,
            timestamp=current_time,
            bbox=bbox
        )
        
        # Añadir al buffer
        self.detection_buffer.append(detection)
        
        # Limpiar detecciones antiguas
        self._cleanup_old_detections(current_time)
        
        # Analizar estabilidad
        stable_detection = self._analyze_stability(current_time)
        
        return stable_detection
    
    def _cleanup_old_detections(self, current_time: float):
        """Elimina detecciones fuera de la ventana temporal"""
        cutoff_time = current_time - self.window_seconds
        
        # Limpiar buffer
        while self.detection_buffer and self.detection_buffer[0].timestamp < cutoff_time:
            self.detection_buffer.popleft()
        
        # Limpiar contadores
        for numero in list(self.number_counts.keys()):
            self.number_counts[numero] = [
                d for d in self.number_counts[numero] 
                if d.timestamp >= cutoff_time
            ]
            if not self.number_counts[numero]:
                del self.number_counts[numero]
    
    def _analyze_stability(self, current_time: float) -> Optional[Dict]:
        """Analiza la estabilidad de las detecciones recientes"""
        if not self.detection_buffer:
            return None
        
        # Agrupar por número
        recent_by_number = defaultdict(list)
        for detection in self.detection_buffer:
            recent_by_number[detection.numero].append(detection)
        
        # Buscar el número más estable
        best_candidate = None
        best_stability = 0
        
        for numero, detections in recent_by_number.items():
            if len(detections) < self.min_detections:
                continue
                
            # Calcular métricas de estabilidad
            stability_score = self._calculate_stability_score(detections)
            
            if stability_score > best_stability and stability_score >= self.stability_threshold:
                best_stability = stability_score
                best_candidate = {
                    'numero': numero,
                    'detections': detections,
                    'stability_score': stability_score
                }
        
        if best_candidate:
            return self._create_stable_detection(best_candidate, current_time)
        
        return None
    
    def _calculate_stability_score(self, detections: List[Detection]) -> float:
        """
        Calcula un score de estabilidad basado en:
        - Consistencia temporal
        - Confianza promedio
        - Variabilidad de la confianza
        """
        if not detections:
            return 0.0
        
        # Confianza promedio
        confidences = [d.confidence for d in detections]
        avg_confidence = np.mean(confidences)
        
        # Consistencia temporal (detecciones distribuidas en el tiempo)
        timestamps = [d.timestamp for d in detections]
        time_span = max(timestamps) - min(timestamps)
        temporal_consistency = min(1.0, time_span / (self.window_seconds * 0.7))
        
        # Estabilidad de confianza (menor variación = mejor)
        confidence_std = np.std(confidences)
        confidence_stability = max(0, 1.0 - (confidence_std / avg_confidence))
        
        # Score combinado
        stability_score = (
            avg_confidence * 0.4 +           # 40% confianza promedio
            temporal_consistency * 0.3 +      # 30% consistencia temporal  
            confidence_stability * 0.3        # 30% estabilidad de confianza
        )
        
        return stability_score
    
    def _create_stable_detection(self, candidate: Dict, current_time: float) -> Optional[Dict]:
        """Crea una detección estabilizada final"""
        detections = candidate['detections']
        numero = candidate['numero']
        
        # Evitar detecciones duplicadas muy recientes
        if (self.last_confirmed and 
            self.last_confirmed.get('numero') == numero and
            current_time - self.last_confirmed_time < 2.0):  # 2 segundos mínimo
            return None
        
        # Calcular métricas finales
        confidences = [d.confidence for d in detections]
        modelos = [d.modelo for d in detections if d.modelo]
        
        final_detection = {
            'numero': numero,
            'modelo': max(set(modelos), key=modelos.count) if modelos else None,
            'confidence': np.mean(confidences),
            'max_confidence': max(confidences),
            'detection_count': len(detections),
            'stability_score': candidate['stability_score'],
            'timestamp': current_time,
            'temporal_span': max([d.timestamp for d in detections]) - min([d.timestamp for d in detections])
        }
        
        # Actualizar última confirmación
        self.last_confirmed = final_detection
        self.last_confirmed_time = current_time
        
        return final_detection
    
    def get_stats(self) -> Dict:
        """Retorna estadísticas del filtro"""
        current_time = time.time()
        active_numbers = len([
            numero for numero, dets in self.number_counts.items()
            if any(d.timestamp > current_time - self.window_seconds for d in dets)
        ])
        
        return {
            'buffer_size': len(self.detection_buffer),
            'active_numbers': active_numbers,
            'last_confirmed': self.last_confirmed['numero'] if self.last_confirmed else None,
            'last_confirmed_time': self.last_confirmed_time,
            'window_seconds': self.window_seconds
        }


class MotionStabilizer:
    """Detecta si el objeto está en movimiento excesivo para mejorar la detección"""
    
    def __init__(self, movement_threshold: float = 50.0, stability_frames: int = 5):
        self.movement_threshold = movement_threshold
        self.stability_frames = stability_frames
        self.recent_boxes: deque = deque(maxlen=10)
        
    def add_detection_box(self, bbox: Tuple[int, int, int, int]) -> bool:
        """
        Añade una caja de detección y determina si el movimiento es estable
        
        Returns:
            True si el movimiento es estable, False si hay mucho movimiento
        """
        self.recent_boxes.append(bbox)
        
        if len(self.recent_boxes) < 3:
            return True  # Muy pocas muestras para determinar
            
        # Calcular movimiento promedio
        movements = []
        for i in range(1, len(self.recent_boxes)):
            prev_box = self.recent_boxes[i-1]
            curr_box = self.recent_boxes[i]
            
            # Centro de las cajas
            prev_center = ((prev_box[0] + prev_box[2]) / 2, (prev_box[1] + prev_box[3]) / 2)
            curr_center = ((curr_box[0] + curr_box[2]) / 2, (curr_box[1] + curr_box[3]) / 2)
            
            # Distancia euclidiana
            movement = np.sqrt((curr_center[0] - prev_center[0])**2 + 
                             (curr_center[1] - prev_center[1])**2)
            movements.append(movement)
        
        avg_movement = np.mean(movements)
        return avg_movement < self.movement_threshold
