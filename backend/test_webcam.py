#!/usr/bin/env python3
"""
Script de prueba para diagnosticar problemas de acceso a la webcam
"""
import cv2
import time

def test_webcam_access():
    print("🔍 Iniciando diagnóstico de webcam...")
    
    # Probar diferentes índices de cámara
    for camera_index in range(5):  # Probar índices 0-4
        print(f"\n📷 Probando cámara índice {camera_index}...")
        
        try:
            cap = cv2.VideoCapture(camera_index)
            
            if cap is None:
                print(f"❌ cv2.VideoCapture({camera_index}) devolvió None")
                continue
                
            is_opened = cap.isOpened()
            print(f"📊 cap.isOpened() = {is_opened}")
            
            if is_opened:
                # Obtener propiedades
                width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
                height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
                fps = cap.get(cv2.CAP_PROP_FPS)
                print(f"✅ Cámara {camera_index} detectada: {width}x{height} @ {fps} FPS")
                
                # Intentar leer un frame
                ret, frame = cap.read()
                print(f"📸 Lectura de frame: ret={ret}, frame={'OK' if frame is not None else 'None'}")
                
                if ret and frame is not None:
                    print(f"✅ ¡Cámara {camera_index} funcionando correctamente!")
                    print(f"📊 Forma del frame: {frame.shape}")
                    
                    # Guardar frame de prueba
                    cv2.imwrite(f'test_webcam_{camera_index}.jpg', frame)
                    print(f"💾 Frame guardado como test_webcam_{camera_index}.jpg")
                else:
                    print(f"❌ No se pudo leer frame de cámara {camera_index}")
            else:
                print(f"❌ No se pudo abrir cámara índice {camera_index}")
                
            cap.release()
            time.sleep(0.5)  # Pausa entre pruebas
            
        except Exception as e:
            print(f"❌ Error probando cámara {camera_index}: {e}")
    
    print("\n🔍 Diagnóstico completado.")

if __name__ == "__main__":
    test_webcam_access()
