from ultralytics import YOLO
import cv2
import os
import tkinter as tk
from tkinter import filedialog

# Inicializar ventana de tkinter (no visible)
root = tk.Tk()
root.withdraw()

# Cargar el modelo YOLOv8
model = YOLO('best.pt')

while True:
    print("\n¿Con qué fuente querés hacer la detección?")
    print("1 - Cámara web")
    print("2 - Archivo de video o imagen (MP4, JPG, PNG, etc.)")
    opcion = input("Elegí 1 o 2: ")

    if opcion == "1":
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("No se pudo acceder a la cámara.")
            continue

        print("Presioná 'q' para salir.")
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            results = model.predict(source=frame, conf=0.5)
            annotated_frame = results[0].plot()
            cv2.imshow("Detección en vivo (cámara)", annotated_frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
        cap.release()
        cv2.destroyAllWindows()

    elif opcion == "2":
        print("Seleccioná el archivo (imagen o video)...")
        fuente = filedialog.askopenfilename(
            title="Seleccioná archivo",
            filetypes=[
                ("Videos e Imágenes", "*.mp4 *.avi *.mov *.jpg *.png"),
                ("Todos los archivos", "*.*")
            ]
        )
        if not fuente:
            print(" No se seleccionó ningún archivo.")
            continue

        ext = os.path.splitext(fuente)[-1].lower()

        if ext in ['.mp4', '.avi', '.mov']:
            cap = cv2.VideoCapture(fuente)
            print("Presioná 'q' para salir.")
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                results = model.predict(source=frame, conf=0.5)
                annotated_frame = results[0].plot()
                cv2.imshow("Detección en video", annotated_frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
            cap.release()
            cv2.destroyAllWindows()
        else:
            # Imagen
            results = model.predict(source=fuente, show=True, conf=0.3)

    else:
        print("Opción inválida. Intentalo de nuevo.")
        continue

    repetir = input("¿Querés volver a ejecutar la detección? (s/n): ")
    if repetir.lower() != "s":
        print("Saliendo del programa.")
        break
