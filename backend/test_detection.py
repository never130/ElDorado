#!/usr/bin/env python3
"""
Script de prueba para diagnosticar problemas de detección del modelo números enteros
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from utils.image_processing import detectar_vagoneta_y_placa_mejorado, processor
from main import procesar_video_mp4
import cv2

async def test_sample_video():
    """Prueba el video de muestra incluido en el dataset"""
    sample_video = r"c:\Users\NEVER\OneDrive\Documentos\VSCode\MisProyectos\app_imagenes\backend\models\numeros_enteros\yolo_model\dataset\CarroNenteros800.mp4"
    
    print("🎬 PRUEBA DE VIDEO DE MUESTRA")
    print("=" * 50)
    print(f"📁 Video: {sample_video}")
    print(f"🔧 Confianza actual: {processor.min_confidence}")
    print(f"🏷️  Clases del modelo: {len(processor.model.names)}")
    print(f"📋 Nombres de clases: {list(processor.model.names.values())}")
    
    if not os.path.exists(sample_video):
        print("❌ Video de muestra no encontrado")
        return
    
    # Obtener info del video
    cap = cv2.VideoCapture(sample_video)
    if cap.isOpened():
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        duration = total_frames / fps
        cap.release()
        
        print(f"📊 Información del video:")
        print(f"   - Frames totales: {total_frames}")
        print(f"   - FPS: {fps:.2f}")
        print(f"   - Duración: {duration:.2f} segundos")
    
    print("\n🔍 Iniciando detección...")
    numero_detectado = await procesar_video_mp4(sample_video)
    
    print("\n📈 RESULTADO:")
    if numero_detectado:
        print(f"✅ Número detectado: {numero_detectado}")
    else:
        print("❌ No se detectó ningún número")
    
    return numero_detectado

def test_confidence_levels():
    """Prueba diferentes niveles de confianza"""
    print("\n🔧 PRUEBA DE NIVELES DE CONFIANZA")
    print("=" * 50)
    
    confidence_levels = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3]
    
    for conf in confidence_levels:
        processor.min_confidence = conf
        print(f"📊 Configurando confianza a: {conf}")
        
        # Aquí podrías probar con una imagen específica
        # Por ahora solo reportamos el cambio
        print(f"   ✅ Confianza actualizada: {processor.min_confidence}")

def extract_sample_frames():
    """Extrae algunos frames del video para análisis manual"""
    sample_video = r"c:\Users\NEVER\OneDrive\Documentos\VSCode\MisProyectos\app_imagenes\backend\models\numeros_enteros\yolo_model\dataset\CarroNenteros800.mp4"
    
    print("\n🖼️  EXTRAYENDO FRAMES DE MUESTRA")
    print("=" * 50)
    
    if not os.path.exists(sample_video):
        print("❌ Video de muestra no encontrado")
        return
    
    cap = cv2.VideoCapture(sample_video)
    if not cap.isOpened():
        print("❌ No se pudo abrir el video")
        return
    
    # Crear directorio para frames
    frames_dir = "extracted_frames"
    os.makedirs(frames_dir, exist_ok=True)
    
    # Extraer algunos frames clave
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_indices = [
        total_frames // 4,      # 25%
        total_frames // 2,      # 50%
        3 * total_frames // 4   # 75%
    ]
    
    for i, frame_idx in enumerate(frame_indices):
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        
        if ret:
            frame_path = f"{frames_dir}/frame_{i+1}_at_{frame_idx}.jpg"
            cv2.imwrite(frame_path, frame)
            print(f"💾 Frame guardado: {frame_path}")
            
            # Probar detección en este frame
            try:
                cropped_placa_img, bbox_vagoneta, bbox_placa, numero = detectar_vagoneta_y_placa_mejorado(frame_path)
                if numero:
                    print(f"   ✅ Número detectado: {numero}")
                else:
                    print(f"   ❌ No se detectó número")
            except Exception as e:
                print(f"   ⚠️  Error en detección: {str(e)}")
    
    cap.release()
    print(f"\n📁 Frames extraídos en directorio: {frames_dir}")

async def main():
    """Función principal de pruebas"""
    print("🚀 SISTEMA DE DIAGNÓSTICO DE DETECCIÓN")
    print("=" * 60)
    
    # 1. Probar video de muestra
    await test_sample_video()
    
    # 2. Probar diferentes niveles de confianza
    test_confidence_levels()
    
    # 3. Extraer frames para análisis
    extract_sample_frames()
    
    print("\n" + "=" * 60)
    print("✅ Diagnóstico completado")
    print("💡 Recomendaciones:")
    print("   - Si no hay detecciones, verificar el dataset de entrenamiento")
    print("   - Considerar reentrenar el modelo con más datos")
    print("   - Ajustar parámetros de preprocesamiento")

if __name__ == "__main__":
    asyncio.run(main())
