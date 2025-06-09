#!/usr/bin/env python3
"""
Script rápido para probar las detecciones mejoradas
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.image_processing import processor, detectar_vagoneta_y_placa_mejorado
import cv2
import tempfile

def quick_test():
    """Prueba rápida de detección"""
    print("🔬 PRUEBA RÁPIDA DE DETECCIÓN")
    print("=" * 40)
    
    # Usar video de muestra para extraer un frame
    video_path = r"models\numeros_enteros\yolo_model\dataset\CarroNenteros800.mp4"
    
    if not os.path.exists(video_path):
        print(f"❌ Video no encontrado: {video_path}")
        return
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print("❌ No se pudo abrir el video")
        return
    
    # Saltar a frame 3600 (donde sabemos que hay detecciones)
    cap.set(cv2.CAP_PROP_POS_FRAMES, 3600)
    ret, frame = cap.read()
    
    if not ret:
        print("❌ No se pudo leer el frame")
        cap.release()
        return
    
    cap.release()
    
    # Guardar frame como imagen temporal
    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as temp_file:
        temp_path = temp_file.name
        cv2.imwrite(temp_path, frame)
    
    try:
        print(f"📸 Procesando frame temporal: {temp_path}")
        
        # Probar detección mejorada
        cropped_placa_img, bbox_vagoneta, bbox_placa, numero = detectar_vagoneta_y_placa_mejorado(temp_path)
        
        if numero:
            print(f"✅ ÉXITO: Número detectado = {numero}")
            print(f"📦 BBox placa: {bbox_placa}")
            print(f"🚛 BBox vagoneta: {bbox_vagoneta}")
            print(f"🖼️ Imagen recortada: {cropped_placa_img is not None}")
        else:
            print("❌ No se detectó número")
            
        # Probar también detección directa
        print("\n🔍 Probando detección directa en imagen...")
        resultado_directo = processor.detect_calado_numbers_mejorado(frame)
        
        if resultado_directo:
            print(f"✅ Detección directa: {resultado_directo.get('numero')}")
            print(f"🎯 Confianza: {resultado_directo.get('confidence', 0):.3f}")
        else:
            print("❌ Detección directa falló")
        
    except Exception as e:
        print(f"💥 Error en prueba: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Limpiar archivo temporal
        try:
            os.unlink(temp_path)
        except:
            pass

if __name__ == "__main__":
    quick_test()
