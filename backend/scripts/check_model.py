#!/usr/bin/env python3
"""
Script para verificar la carga del modelo y configuración
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.image_processing import processor

def check_model_status():
    """Verifica el estado del modelo"""
    print("🔍 VERIFICANDO ESTADO DEL MODELO")
    print("=" * 40)
    
    try:
        print(f"✅ Modelo cargado: {processor.model is not None}")
        print(f"🔧 Confianza: {processor.min_confidence}")
        print(f"🏷️ Número de clases: {len(processor.model.names)}")
        print(f"📋 Clases: {list(processor.model.names.values())}")
        
        # Verificar ruta del modelo
        model_path = r"c:\Users\NEVER\OneDrive\Documentos\VSCode\MisProyectos\app_imagenes\backend\models\numeros_enteros\yolo_model\training\best.pt"
        print(f"📁 Modelo existe: {os.path.exists(model_path)}")
        
        # Verificar video de muestra
        video_path = r"c:\Users\NEVER\OneDrive\Documentos\VSCode\MisProyectos\app_imagenes\backend\models\numeros_enteros\yolo_model\dataset\CarroNenteros800.mp4"
        print(f"🎬 Video de muestra existe: {os.path.exists(video_path)}")
        
        if os.path.exists(video_path):
            size_mb = os.path.getsize(video_path) / (1024 * 1024)
            print(f"📊 Tamaño del video: {size_mb:.2f} MB")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    check_model_status()
