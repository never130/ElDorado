#!/usr/bin/env python3
"""
Script rápido para probar acceso a webcam sin bloqueos
"""
import cv2
import time
import threading

def test_camera_with_timeout(index, timeout=5):
    """Prueba una cámara con timeout"""
    result = {'success': False, 'error': None, 'info': None}
    
    def test_camera():
        try:
            print(f"  → Abriendo cámara {index}...")
            cap = cv2.VideoCapture(index)
            
            if cap is None:
                result['error'] = 'VideoCapture returned None'
                return
            
            print(f"  → Verificando si está abierta...")
            if not cap.isOpened():
                result['error'] = 'Camera not opened'
                cap.release()
                return
                
            print(f"  → Obteniendo propiedades...")
            width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
            height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
            fps = cap.get(cv2.CAP_PROP_FPS)
            
            print(f"  → Intentando leer un frame...")
            ret, frame = cap.read()
            
            if ret and frame is not None:
                result['success'] = True
                result['info'] = {
                    'width': int(width),
                    'height': int(height),
                    'fps': fps,
                    'frame_shape': frame.shape
                }
                print(f"  ✅ Frame leído exitosamente: {frame.shape}")
            else:
                result['error'] = f'Cannot read frame: ret={ret}, frame={frame is not None}'
                
            cap.release()
            
        except Exception as e:
            result['error'] = str(e)
    
    # Ejecutar en hilo con timeout
    thread = threading.Thread(target=test_camera)
    thread.daemon = True
    thread.start()
    thread.join(timeout)
    
    if thread.is_alive():
        result['error'] = f'Timeout after {timeout} seconds'
        print(f"  ⏰ Timeout después de {timeout} segundos")
        return result
    
    return result

def main():
    print("🔍 Diagnóstico rápido de webcam (con timeout)...")
    print("=" * 50)
    
    # Probar cámaras del 0 al 5
    for i in range(6):
        print(f"\n📷 Probando cámara índice {i}...")
        result = test_camera_with_timeout(i, timeout=3)
        
        if result['success']:
            info = result['info']
            print(f"  ✅ EXITOSO - {info['width']}x{info['height']} @ {info['fps']} FPS")
            print(f"     Frame shape: {info['frame_shape']}")
        else:
            print(f"  ❌ FALLÓ - {result['error']}")
    
    print("\n" + "=" * 50)
    print("💡 Consejos si no funciona ninguna cámara:")
    print("  1. Cierra Chrome/WhatsApp/Teams/Zoom")
    print("  2. Verifica permisos de cámara en Windows")
    print("  3. Reinicia el sistema si es necesario")
    print("  4. Prueba con aplicación nativa (Camera de Windows)")

if __name__ == "__main__":
    main()
