#!/usr/bin/env python3
"""
Script de prueba para verificar la detección de números
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.utils.image_processing import run_detection_on_path
import cv2
import numpy as np

def test_number_detection():
    """Prueba la detección de números en imágenes"""
    
    # Buscar imágenes de prueba en el directorio uploads
    uploads_dir = os.path.join(os.path.dirname(__file__), 'backend', 'uploads')
    
    if not os.path.exists(uploads_dir):
        print(f"❌ Directorio uploads no encontrado: {uploads_dir}")
        return
    
    # Buscar archivos de imagen
    image_files = []
    for file in os.listdir(uploads_dir):
        if file.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp')):
            image_files.append(os.path.join(uploads_dir, file))
    
    if not image_files:
        print("❌ No se encontraron imágenes en el directorio uploads")
        return
    
    print(f"🔍 Encontradas {len(image_files)} imágenes para probar")
      # Probar con las primeras 3 imágenes
    for i, image_path in enumerate(image_files[:3]):
        print(f"\n{'='*50}")
        print(f"🖼️ PROBANDO IMAGEN {i+1}: {os.path.basename(image_path)}")
        print(f"{'='*50}")
        
        # Ejecutar detección
        result = run_detection_on_path(image_path)
        
        if result:
            print("✅ RESULTADOS DE DETECCIÓN:")
            numero = result.get('numero_detectado')
            confianza_numero = result.get('confianza_numero')
            modelo_ladrillo = result.get('modelo_ladrillo')
            confianza_ladrillo = result.get('confianza_ladrillo')
            
            print(f"  📍 Número detectado: {numero if numero else 'No detectado'}")
            if confianza_numero is not None:
                print(f"  🎯 Confianza número: {confianza_numero:.3f}")
            else:
                print(f"  🎯 Confianza número: N/A")
                
            print(f"  🧱 Modelo ladrillo: {modelo_ladrillo if modelo_ladrillo else 'No detectado'}")
            if confianza_ladrillo is not None:
                print(f"  🎯 Confianza ladrillo: {confianza_ladrillo:.3f}")
            else:
                print(f"  🎯 Confianza ladrillo: N/A")
                
            print(f"  📦 Bbox número: {result.get('bbox_numero', 'N/A')}")
            
            # Indicar si solo se detectaron ladrillos
            if modelo_ladrillo and not numero:
                print("  ℹ️ NOTA: Esta imagen contiene solo ladrillos, no números de vagoneta")
        else:
            print("❌ No se obtuvieron resultados de detección")

if __name__ == "__main__":
    print("🧪 INICIANDO PRUEBAS DE DETECCIÓN DE NÚMEROS")
    print("="*60)
    test_number_detection()
    print("\n🏁 PRUEBAS COMPLETADAS")
