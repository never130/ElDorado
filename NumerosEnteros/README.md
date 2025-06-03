Numeros Calados - Detección con YOLOv8

Descripción Este módulo implementa un modelo YOLOv8 entrenado para la detección de números enteros en carros. Utiliza un dataset optimizado de Roboflow y genera resultados en videos procesados, permitiendo análisis en tiempo real o por lotes.

Estructura del Proyecto

NumerosCalados/

┣ dataset/ # Dataset de entrenamiento

┃ ┣ CarroNenteros800.mp4 # Video original con números calados

┃ ┣ readme.dataset # Descripción del dataset

┣ training/ # Código de entrenamiento

┃ ┣ train.py # Script para entrenar YOLOv8

┃ ┣ data.yaml # Configuración del dataset

┃ ┣ best.pt # Modelo YOLOv8 entrenado

┣ detection/ # Código de inferencia

┃ ┣ detect_video.py # Detección en videos

┣ results/ # Datos generados tras la detección

┃ ┣ detecciones.json # Resultados en formato JSON

┃ ┣ video_prueba.mp4 # Video con detección aplicada

┣ readme.rpbpflow # Información sobre el dataset en Roboflow

Instalación y Requisitos

Antes de ejecutar el código, asegúrate de tener Python 3.8+, ultralytics y OpenCV instalados:

bash

pip install ultralytics opencv-python pymongo

Entrenamiento del Modelo

Para entrenar YOLOv8 con el dataset de Roboflow, ejecuta:

python

from ultralytics import YOLO

modelo = YOLO("yolov8n.pt") # Cargar modelo base
modelo.train(data="dataset/data.yaml", epochs=150, imgsz=1280, project="runs", name="train_final")
Esto generará un modelo optimizado en training/best.pt.

Detección en Video

Para ejecutar la detección en un video con YOLOv8:

python

from ultralytics import YOLO

modelo = YOLO("training/best.pt")
modelo.predict(source="dataset/CarroNenteros800.mp4", conf=0.7, save=True, project="results", name="detect_final")

Esto generará el video procesado en results/video_prueba.mp4.

Guardar Detecciones en MongoDB

Si deseas almacenar los datos de detección en MongoDB, usa este script:

python
import pymongo
import json

cliente = pymongo.MongoClient("mongodb://localhost:27017/")
db = cliente["deteccion_numeros"]
coleccion = db["resultados"]

with open("results/detecciones.json", "r") as file:
detecciones = json.load(file)

coleccion.insert_many(detecciones)

print("Detecciones almacenadas en MongoDB.")
