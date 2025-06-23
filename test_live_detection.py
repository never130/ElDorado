#!/usr/bin/env python3
"""
Test de detección en tiempo real para diagnosticar problemas con la cámara.
Este script simula el comportamiento del monitor en tiempo real para identificar
por qué no se detectan números/ladrillos en la cámara en vivo.
"""

import cv2
import os
import sys
import time
import numpy as np
from datetime import datetime

# Agregar el directorio backend al path para importar los módulos
backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.insert(0, backend_dir)

try:
    from utils.image_processing import run_detection_on_frame, processor
    print("✅ Módulos de detección importados correctamente")
except ImportError as e:
    print(f"❌ Error al importar módulos: {e}")
    sys.exit(1)

def test_model_loading():
    """Prueba que el modelo esté cargado correctamente"""
    print("\n🔍 Verificando carga del modelo...")
    
    try:
        # Verificar que el procesador esté inicializado
        if processor.model is None:
            print("❌ Error: El modelo no está cargado")
            return False
            
        print(f"✅ Modelo cargado correctamente")
        print(f"   - Confianza mínima: {processor.min_confidence}")
        print(f"   - Tipo de modelo: {type(processor.model)}")
        
        # Probar detección con imagen de prueba
        test_image = np.ones((640, 640, 3), dtype=np.uint8) * 128  # Imagen gris
        results = processor.model(test_image, conf=0.1)
        print(f"✅ Modelo responde correctamente a prueba")
        return True
        
    except Exception as e:
        print(f"❌ Error al verificar modelo: {e}")
        return False

def test_camera_access():
    """Prueba el acceso a la cámara"""
    print("\n📹 Probando acceso a la cámara...")
    
    try:
        cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        
        if not cap.isOpened():
            print("❌ No se puede abrir la cámara")
            return False
            
        # Configurar como en el monitor real
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 640)
        cap.set(cv2.CAP_PROP_FPS, 15)
        
        ret, frame = cap.read()
        if not ret or frame is None:
            print("❌ No se pueden leer frames de la cámara")
            cap.release()
            return False
            
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        
        print(f"✅ Cámara funcionando correctamente")
        print(f"   - Resolución: {width}x{height}")
        print(f"   - FPS configurado: {fps}")
        print(f"   - Tamaño del frame: {frame.shape}")
        
        cap.release()
        return True
        
    except Exception as e:
        print(f"❌ Error al acceder a la cámara: {e}")
        return False

def test_live_detection():
    """Prueba la detección en tiempo real"""
    print("\n🎯 Iniciando prueba de detección en tiempo real...")
    print("INSTRUCCIONES:")
    print("- Asegúrate de mostrar números o ladrillos claramente frente a la cámara")
    print("- Mantén buena iluminación")
    print("- Presiona 'q' para salir, 's' para guardar frame actual")
    
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    
    if not cap.isOpened():
        print("❌ No se puede abrir la cámara para la prueba")
        return
    
    # Configurar como en el monitor real
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 640)
    cap.set(cv2.CAP_PROP_FPS, 15)
    
    frame_count = 0
    detections_count = 0
    last_detection_time = 0
    
    print("✅ Cámara iniciada. Buscando detecciones...")
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                continue
                
            frame_count += 1
            current_time = time.time()
            
            # Detectar cada 15 frames (como en el monitor real)
            if frame_count % 15 == 0:
                try:
                    # Usar la misma función que el monitor real
                    results = run_detection_on_frame(frame)
                    
                    if results:
                        numero = results.get('numero_detectado')
                        ladrillo = results.get('modelo_ladrillo')
                        conf_numero = results.get('confianza_numero')
                        conf_ladrillo = results.get('confianza_ladrillo')
                        
                        if numero or ladrillo:
                            detections_count += 1
                            last_detection_time = current_time
                            
                            print(f"\n🎯 DETECCIÓN #{detections_count} (Frame {frame_count}):")
                            if numero:
                                print(f"   📊 Número: {numero} (confianza: {conf_numero:.3f})")
                            if ladrillo:
                                print(f"   🧱 Ladrillo: {ladrillo} (confianza: {conf_ladrillo:.3f})")
                            
                            # Guardar frame de detección
                            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                            filename = f"detection_test_{timestamp}.jpg"
                            cv2.imwrite(filename, frame)
                            print(f"   💾 Frame guardado: {filename}")
                    
                    else:
                        # Mostrar que se está procesando pero sin detectar
                        if frame_count % (15 * 10) == 0:  # Cada 10 detecciones (150 frames)
                            print(f"⏳ Procesando... Frame {frame_count}, Sin detecciones")
                            
                except Exception as e:
                    print(f"❌ Error en detección frame {frame_count}: {e}")
                    import traceback
                    traceback.print_exc()
            
            # Mostrar frame con overlay de información
            display_frame = frame.copy()
            
            # Agregar información en la imagen
            cv2.putText(display_frame, f"Frames: {frame_count}", (10, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            cv2.putText(display_frame, f"Detecciones: {detections_count}", (10, 60), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            if detections_count > 0:
                time_since_last = current_time - last_detection_time
                cv2.putText(display_frame, f"Ultima det: {time_since_last:.1f}s", (10, 90), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            cv2.putText(display_frame, "Presiona 'q' para salir", (10, display_frame.shape[0] - 20), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
            cv2.imshow('Test Deteccion en Vivo', display_frame)
            
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break
            elif key == ord('s'):
                # Guardar frame manual
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"manual_frame_{timestamp}.jpg"
                cv2.imwrite(filename, frame)
                print(f"💾 Frame manual guardado: {filename}")
                
    except KeyboardInterrupt:
        print("\n⚠️ Prueba interrumpida por el usuario")
    
    finally:
        cap.release()
        cv2.destroyAllWindows()
        
        print(f"\n📊 RESUMEN DE LA PRUEBA:")
        print(f"   - Frames procesados: {frame_count}")
        print(f"   - Frames analizados: {frame_count // 15}")
        print(f"   - Detecciones encontradas: {detections_count}")
        
        if detections_count == 0:
            print("\n❌ NO SE DETECTARON OBJETOS")
            print("Posibles causas:")
            print("- El modelo no está cargado correctamente")
            print("- Los objetos no están en el rango de detección del modelo")
            print("- Iluminación insuficiente")
            print("- Los objetos están muy lejos o muy cerca")
            print("- El umbral de confianza es muy alto")
        else:
            print(f"✅ Detecciones funcionando correctamente")

def main():
    """Función principal del diagnóstico"""
    print("🔍 DIAGNÓSTICO DE DETECCIÓN EN TIEMPO REAL")
    print("=" * 50)
    
    # 1. Verificar carga del modelo
    if not test_model_loading():
        print("\n❌ FALLA CRÍTICA: El modelo no está cargado correctamente")
        return
    
    # 2. Verificar acceso a cámara
    if not test_camera_access():
        print("\n❌ FALLA CRÍTICA: No se puede acceder a la cámara")
        return
    
    # 3. Probar detección en tiempo real
    test_live_detection()
    
    print("\n✅ Diagnóstico completado")

if __name__ == "__main__":
    main()
