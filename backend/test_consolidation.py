#!/usr/bin/env python3
"""
Test rápido del sistema de consolidación
"""

import asyncio
import sys
from pathlib import Path

# Agregar el directorio backend al path
sys.path.insert(0, str(Path(__file__).parent))

from utils.detection_consolidator import consolidate_video_detections
from datetime import datetime, timezone

def test_consolidation():
    """Prueba la lógica de consolidación"""
    print("🧪 Iniciando test de consolidación...")
    
    # Datos de prueba simulando detecciones múltiples del número "23"
    detection_data = {
        "23": [
            {"confianza": 0.8, "frame": 10, "imagen_path": "uploads/frame_10_23.jpg", "modelo_ladrillo": "tipo_A"},
            {"confianza": 0.9, "frame": 50, "imagen_path": "uploads/frame_50_23.jpg", "modelo_ladrillo": "tipo_A"},
            {"confianza": 0.7, "frame": 90, "imagen_path": "uploads/frame_90_23.jpg", "modelo_ladrillo": "tipo_A"}
        ],
        "45": [
            {"confianza": 0.6, "frame": 30, "imagen_path": "uploads/frame_30_45.jpg", "modelo_ladrillo": "tipo_B"}
        ]
    }
    
    video_source = "test_video.mp4"
    base_timestamp = datetime.now(timezone.utc)
    
    # Llamar la función de consolidación
    resultado = consolidate_video_detections(detection_data, video_source, base_timestamp)
    
    print("📊 Resultados de consolidación:")
    for numero, datos in resultado.items():
        print(f"  Número {numero}:")
        print(f"    - Confianza: {datos['confianza']}")
        print(f"    - Total detecciones: {datos['metadata_consolidado']['total_detecciones']}")
        print(f"    - Confianza promedio: {datos['metadata_consolidado']['confianza_promedio']}")
        print(f"    - Frames: {datos['metadata_consolidado']['frames_detectado']}")
    
    # Verificar que la consolidación funcionó correctamente
    assert "23" in resultado, "Número 23 debería estar en el resultado"
    assert "45" in resultado, "Número 45 debería estar en el resultado"
    assert resultado["23"]["confianza"] == 0.9, "La confianza máxima de 23 debería ser 0.9"
    assert resultado["23"]["metadata_consolidado"]["total_detecciones"] == 3, "Debería haber 3 detecciones para el 23"
    assert resultado["45"]["metadata_consolidado"]["total_detecciones"] == 1, "Debería haber 1 detección para el 45"
    
    print("✅ Test de consolidación completado exitosamente!")
    print(f"📈 Factor de consolidación: De {sum(len(dets) for dets in detection_data.values())} a {len(resultado)} registros")
    
    return True

if __name__ == "__main__":
    try:
        test_consolidation()
        print("🎉 Todos los tests pasaron!")
    except Exception as e:
        print(f"❌ Error en el test: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
