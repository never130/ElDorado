#!/usr/bin/env python3
"""
Script para inspeccionar las clases del modelo YOLO
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from ultralytics import YOLO
import torch

def inspect_model():
    """Inspecciona las clases del modelo YOLO"""
    
    model_path = os.path.join(os.path.dirname(__file__), "backend", "models", "numeros_enteros", "yolo_model", "training", "best.pt")
    
    if not os.path.exists(model_path):
        print(f"❌ Modelo no encontrado: {model_path}")
        return
    
    print(f"🔍 Inspeccionando modelo: {model_path}")
    
    try:
        # Permitir clases seguras para PyTorch
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
        
        # Cargar modelo
        model = YOLO(model_path)
        
        print(f"\n📊 INFORMACIÓN DEL MODELO:")
        print(f"  Número de clases: {len(model.names)}")
        print(f"  Clases del modelo:")
        
        for class_id, class_name in model.names.items():
            print(f"    {class_id:3d}: {class_name}")
        
        print(f"\n🎯 ANALIZANDO MAPEO DE CLASES:")
        print(f"  - Las clases 0-30 deberían ser números enteros")
        print(f"  - Las clases superiores podrían ser ladrillos/otros objetos")
        
        # Verificar si hay clases fuera del rango 0-30
        numeric_classes = {}
        other_classes = {}
        
        for class_id, class_name in model.names.items():
            if class_id <= 30:
                numeric_classes[class_id] = class_name
            else:
                other_classes[class_id] = class_name
        
        print(f"\n📋 CLASES NUMÉRICAS (0-30):")
        for class_id, class_name in sorted(numeric_classes.items()):
            print(f"    {class_id:3d}: {class_name}")
        
        if other_classes:
            print(f"\n🧱 OTRAS CLASES (>30):")
            for class_id, class_name in sorted(other_classes.items()):
                print(f"    {class_id:3d}: {class_name}")
        
    except Exception as e:
        print(f"❌ Error al inspeccionar modelo: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("🔍 INSPECCIONANDO MODELO YOLO")
    print("="*50)
    inspect_model()
    print("\n🏁 INSPECCIÓN COMPLETADA")
