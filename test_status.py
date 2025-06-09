#!/usr/bin/env python3
"""
Script simple para probar si el modelo funciona correctamente
"""

print("🔍 INICIANDO PRUEBA SIMPLE DEL MODELO")
print("=" * 50)

try:
    # Importar lo necesario
    import sys
    import os
    
    # Agregar la ruta del backend
    backend_path = r"c:\Users\NEVER\OneDrive\Documentos\VSCode\MisProyectos\app_imagenes\backend"
    sys.path.append(backend_path)
    
    print(f"✅ Directorio backend agregado: {backend_path}")
    
    # Importar el procesador
    from utils.image_processing import processor
    
    print(f"✅ Modelo cargado: {processor.model is not None}")
    print(f"🔧 Confianza mínima: {processor.min_confidence}")
    print(f"🏷️ Número de clases: {len(processor.model.names)}")
    print(f"📋 Primeras 10 clases: {list(processor.model.names.values())[:10]}")
    
    # Verificar archivos
    model_path = os.path.join(backend_path, "models", "numeros_enteros", "yolo_model", "training", "best.pt")
    video_path = os.path.join(backend_path, "models", "numeros_enteros", "yolo_model", "dataset", "CarroNenteros800.mp4")
    
    print(f"📁 Modelo existe: {os.path.exists(model_path)}")
    print(f"🎬 Video existe: {os.path.exists(video_path)}")
    
    if os.path.exists(video_path):
        size_mb = os.path.getsize(video_path) / (1024 * 1024)
        print(f"📊 Tamaño del video: {size_mb:.2f} MB")
    
    print("\n🚀 MODELO LISTO PARA USO")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
