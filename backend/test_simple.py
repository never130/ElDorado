#!/usr/bin/env python3
"""
Script simple para probar detección con una imagen
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.image_processing import processor, detectar_vagoneta_y_placa_mejorado
import cv2

def extract_one_frame():
    """Extrae un frame del video para prueba"""
    sample_video = r"c:\Users\NEVER\OneDrive\Documentos\VSCode\MisProyectos\app_imagenes\backend\models\numeros_enteros\yolo_model\dataset\CarroNenteros800.mp4"
    
    print("🖼️ Extrayendo frame de prueba...")
    
    cap = cv2.VideoCapture(sample_video)
    if not cap.isOpened():
        print("❌ No se pudo abrir el video")
        return None
    
    # Ir al frame del medio
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    middle_frame = total_frames // 2
    
    cap.set(cv2.CAP_PROP_POS_FRAMES, middle_frame)
    ret, frame = cap.read()
    
    if ret:
        frame_path = "test_frame.jpg"
        cv2.imwrite(frame_path, frame)
        print(f"✅ Frame guardado: {frame_path}")
        cap.release()
        return frame_path
    
    cap.release()
    return None

def test_detection_simple():
    """Prueba detección en una imagen"""
    frame_path = extract_one_frame()
    
    if not frame_path:
        print("❌ No se pudo extraer frame")
        return
    
    print(f"\n🔍 Probando detección en: {frame_path}")
    print(f"🔧 Confianza: {processor.min_confidence}")
    
    try:
        # Detección mejorada
        cropped_placa_img, bbox_vagoneta, bbox_placa, numero = detectar_vagoneta_y_placa_mejorado(frame_path)
        
        if numero:
            print(f"✅ ÉXITO: Número detectado: {numero}")
        else:
            print(f"❌ No se detectó número")
            
        print(f"📊 bbox_vagoneta: {bbox_vagoneta}")
        print(f"📊 bbox_placa: {bbox_placa}")
        
    except Exception as e:
        print(f"💥 Error: {str(e)}")
    
    # Limpiar
    try:
        os.remove(frame_path)
        print(f"🗑️ Archivo temporal eliminado")
    except:
        pass

if __name__ == "__main__":
    print("🧪 PRUEBA SIMPLE DE DETECCIÓN")
    print("=" * 40)
    test_detection_simple()
