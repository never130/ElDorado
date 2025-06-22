#!/usr/bin/env python3
"""
Script para verificar qué clases detecta el modelo en las imágenes
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from ultralytics import YOLO
import torch
import cv2

def debug_detections():
    """Muestra todas las detecciones del modelo sin filtros"""
    
    model_path = os.path.join(os.path.dirname(__file__), "backend", "models", "numeros_enteros", "yolo_model", "training", "best.pt")
    uploads_dir = os.path.join(os.path.dirname(__file__), 'backend', 'uploads')
    
    # Cargar modelo
    from ultralytics.nn.tasks import DetectionModel
    from ultralytics.nn.modules.conv import Conv as UltralyticsConv
    from ultralytics.nn.modules.conv import Concat
    from torch.nn.modules.container import Sequential, ModuleList
    from torch.nn.modules.conv import Conv2d
    from torch.nn.modules.batchnorm import BatchNorm2d
    from torch.nn.modules.activation import SiLU
    from ultralytics.nn.modules.block import C2f, Bottleneck, SPPF, DFL
    from torch.nn.modules.pooling import MaxPool2d
    from torch.nn.modules.upsampling import Upsample
    from ultralytics.nn.modules.head import Detect
    
    safe_globals_list = [
        DetectionModel, Sequential, Conv2d, UltralyticsConv, BatchNorm2d, SiLU,
        C2f, ModuleList, Bottleneck, SPPF, MaxPool2d, Upsample, Concat, Detect, DFL
    ]
    torch.serialization.add_safe_globals(safe_globals_list)
    
    model = YOLO(model_path)
    
    # Buscar imágenes
    image_files = []
    for file in os.listdir(uploads_dir):
        if file.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp')):
            image_files.append(os.path.join(uploads_dir, file))
    
    if not image_files:
        print("❌ No se encontraron imágenes")
        return
    
    # Probar con las primeras 3 imágenes
    for i, image_path in enumerate(image_files[:3]):
        print(f"\n{'='*60}")
        print(f"🖼️ IMAGEN {i+1}: {os.path.basename(image_path)}")
        print(f"{'='*60}")
        
        try:
            # Cargar imagen
            image = cv2.imread(image_path)
            if image is None:
                print(f"❌ No se pudo cargar imagen: {image_path}")
                continue
            
            # Ejecutar detección con umbral bajo
            results = model(image, conf=0.1, imgsz=640)
            
            if not results or not results[0].boxes:
                print("❌ No se detectaron objetos")
                continue
            
            results_obj = results[0]
            print(f"✅ {len(results_obj.boxes)} detecciones encontradas:")
            
            # Mostrar todas las detecciones
            for j, box in enumerate(results_obj.boxes):
                confidence = float(box.conf[0])
                class_id = int(box.cls[0])
                class_name = results_obj.names[class_id]
                bbox = box.xyxy[0].cpu().numpy()
                
                categoria = "NÚMERO" if 0 <= class_id <= 99 else "LADRILLO"
                print(f"  [{j+1}] Clase {class_id:3d}: {class_name:10s} | Conf: {confidence:.3f} | {categoria}")
                print(f"       BBox: ({int(bbox[0])}, {int(bbox[1])}, {int(bbox[2])}, {int(bbox[3])})")
                
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("🔍 ANALIZANDO TODAS LAS DETECCIONES DEL MODELO")
    print("="*60)
    debug_detections()
    print("\n🏁 ANÁLISIS COMPLETADO")
