import cv2
import threading
import time

def test_camera_with_timeout(camera_index, timeout=5):
    """Prueba una cámara con timeout para evitar que se cuelgue"""
    result = {'success': False, 'error': None, 'info': None}
    
    def camera_test():
        try:
            print(f"  Intentando abrir cámara {camera_index}...")
            cap = cv2.VideoCapture(camera_index)
            
            if cap.isOpened():
                print(f"  ✅ Cámara {camera_index} se abrió exitosamente")
                
                # Intentar leer un frame
                ret, frame = cap.read()
                if ret and frame is not None:
                    height, width = frame.shape[:2]
                    print(f"  ✅ Frame leído exitosamente: {width}x{height}")
                    result['success'] = True
                    result['info'] = {
                        'width': width,
                        'height': height,
                        'fps': cap.get(cv2.CAP_PROP_FPS)
                    }
                else:
                    print(f"  ❌ No se pudo leer frame de cámara {camera_index}")
                    result['error'] = "No se pudo leer frame"
                
                cap.release()
            else:
                print(f"  ❌ No se pudo abrir cámara {camera_index}")
                result['error'] = "No se pudo abrir"
                
        except Exception as e:
            print(f"  ❌ Error con cámara {camera_index}: {e}")
            result['error'] = str(e)
    
    # Ejecutar en thread con timeout
    thread = threading.Thread(target=camera_test)
    thread.daemon = True
    thread.start()
    thread.join(timeout)
    
    if thread.is_alive():
        print(f"  ⏰ Timeout: Cámara {camera_index} tardó más de {timeout}s (probablemente bloqueada)")
        result['error'] = f"Timeout después de {timeout}s"
    
    return result

def main():
    print("🔍 Diagnóstico rápido de webcam (con timeout)...")
    
    # Probar cámaras 0-3
    available_cameras = []
    
    for i in range(4):
        print(f"\n📷 Probando cámara índice {i}:")
        result = test_camera_with_timeout(i, timeout=3)
        
        if result['success']:
            available_cameras.append(i)
            info = result['info']
            print(f"  ✅ DISPONIBLE: {info['width']}x{info['height']} @ {info['fps']:.1f} FPS")
        else:
            print(f"  ❌ NO DISPONIBLE: {result['error']}")
    
    print(f"\n📊 RESUMEN:")
    if available_cameras:
        print(f"✅ Cámaras disponibles: {available_cameras}")
        print(f"💡 Usa índice {available_cameras[0]} para tu configuración")
    else:
        print("❌ No se encontraron cámaras disponibles")
        print("💡 Posibles soluciones:")
        print("   1. Cierra Chrome, WhatsApp, Teams, Zoom, etc.")
        print("   2. Verifica permisos de cámara en Windows")
        print("   3. Reinicia tu computadora")
        print("   4. Verifica que la cámara esté conectada y funcione")

if __name__ == "__main__":
    main()
