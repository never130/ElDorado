import cv2
import time

print("🔍 Probando cámara...")

# Probar diferentes backends
backends = [
    (cv2.CAP_ANY, "CAP_ANY"),
    (cv2.CAP_DSHOW, "CAP_DSHOW"),
    (cv2.CAP_MSMF, "CAP_MSMF"),
    (cv2.CAP_V4L2, "CAP_V4L2")
]

for backend, name in backends:
    print(f"\n📹 Probando backend: {name}")
    try:
        cap = cv2.VideoCapture(0, backend)
        if cap.isOpened():
            print(f"✅ Backend {name} - Cámara abierta")
            
            # Intentar leer un frame
            ret, frame = cap.read()
            if ret and frame is not None:
                print(f"✅ Backend {name} - Frame leído exitosamente")
                height, width = frame.shape[:2]
                print(f"   Resolución: {width}x{height}")
                
                # Guardar frame de prueba
                cv2.imwrite(f"test_frame_{name.lower()}.jpg", frame)
                print(f"   Frame guardado como: test_frame_{name.lower()}.jpg")
                
                cap.release()
                print(f"✅ Backend {name} - FUNCIONA CORRECTAMENTE")
                break
            else:
                print(f"❌ Backend {name} - No se pudo leer frame")
                cap.release()
        else:
            print(f"❌ Backend {name} - No se pudo abrir la cámara")
    except Exception as e:
        print(f"❌ Backend {name} - Error: {e}")
        if 'cap' in locals():
            cap.release()

print("\n🏁 Prueba completada")
