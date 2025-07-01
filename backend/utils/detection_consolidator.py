#!/usr/bin/env python3
"""
Módulo para consolidar detecciones múltiples de videos
Evita duplicados y optimiza el guardado de registros
"""

from typing import Dict, List, Any, Tuple, Optional
from datetime import datetime, timezone
from pathlib import Path
import statistics

def consolidate_video_detections(
    detection_data: Dict[str, List[Dict]], 
    video_source: str,
    base_timestamp: datetime
) -> Dict[str, Dict[str, Any]]:
    """
    Consolida múltiples detecciones del mismo número en un video
    
    Args:
        detection_data: {numero: [lista_detecciones]}
        video_source: Nombre del video fuente
        base_timestamp: Timestamp base del video
        
    Returns:
        {numero: datos_consolidados}
    """
    if not detection_data or not isinstance(detection_data, dict):
        return {}
    
    consolidated = {}
    
    print(f"📊 Consolidando detecciones para {len(detection_data)} números únicos del video {video_source}")
    
    for numero_str, lista_detecciones in detection_data.items():
        if not lista_detecciones:
            continue
            
        # Filtrar detecciones válidas
        detecciones_validas = [
            d for d in lista_detecciones 
            if isinstance(d, dict) and d.get('confianza', 0) > 0
        ]
        
        if not detecciones_validas:
            print(f"⚠️ No hay detecciones válidas para número {numero_str}")
            continue
        
        # Encontrar la detección con mayor confianza
        mejor_deteccion = max(detecciones_validas, key=lambda x: x.get('confianza', 0))
        
        # Calcular estadísticas
        confianzas = [d.get('confianza', 0) for d in detecciones_validas]
        frames = [d.get('frame', 0) for d in detecciones_validas]
        
        confianza_max = max(confianzas)
        confianza_promedio = statistics.mean(confianzas)
        confianza_mediana = statistics.median(confianzas)
        
        # Datos consolidados
        consolidado = {
            'numero': numero_str,
            'confianza': confianza_max,  # Usar la máxima confianza
            'imagen_path': mejor_deteccion.get('imagen_path', f"uploads/{video_source}"),
            'modelo_ladrillo': mejor_deteccion.get('modelo_ladrillo'),
            'timestamp': base_timestamp,
            'metadata_consolidado': {
                'total_detecciones': len(detecciones_validas),
                'confianza_promedio': round(confianza_promedio, 4),
                'confianza_mediana': round(confianza_mediana, 4),
                'confianza_min': min(confianzas),
                'confianza_max': confianza_max,
                'frames_detectado': sorted(frames),
                'frame_mejor_deteccion': mejor_deteccion.get('frame', 0),
                'video_source': video_source,
                'consolidation_strategy': 'max_confidence'
            }
        }
        
        consolidated[numero_str] = consolidado
        
        print(f"✅ Consolidado número {numero_str}: {len(detecciones_validas)} detecciones → Conf.Max: {confianza_max:.3f}, Conf.Prom: {confianza_promedio:.3f}")
    
    print(f"📋 Consolidación completada: {len(consolidated)} números únicos")
    return consolidated

def should_consolidate_detections(detection_data: Dict) -> bool:
    """
    Determina si las detecciones necesitan consolidación
    """
    if not detection_data or not isinstance(detection_data, dict):
        return False
    
    # Contar total de detecciones
    total_detections = sum(
        len(lista) if isinstance(lista, list) else 1 
        for lista in detection_data.values()
    )
    
    # Consolidar si hay más de 3 detecciones totales o más de 1 por número
    needs_consolidation = (
        total_detections > 3 or 
        any(isinstance(lista, list) and len(lista) > 1 for lista in detection_data.values())
    )
    
    if needs_consolidation:
        print(f"🔄 Consolidación requerida: {total_detections} detecciones para {len(detection_data)} números")
    
    return needs_consolidation

def validate_consolidated_data(consolidated: Dict[str, Dict]) -> bool:
    """
    Valida que los datos consolidados sean correctos
    """
    if not consolidated:
        return True  # Datos vacíos son válidos
    
    for numero, datos in consolidated.items():
        # Verificar campos requeridos
        required_fields = ['numero', 'confianza', 'timestamp']
        if not all(field in datos for field in required_fields):
            print(f"❌ Validación fallida para número {numero}: campos faltantes")
            return False
        
        # Verificar tipos
        if not isinstance(datos['confianza'], (int, float)) or datos['confianza'] < 0:
            print(f"❌ Validación fallida para número {numero}: confianza inválida")
            return False
        
        if not isinstance(datos['timestamp'], datetime):
            print(f"❌ Validación fallida para número {numero}: timestamp inválido")
            return False
    
    print(f"✅ Validación exitosa para {len(consolidated)} registros consolidados")
    return True
