
from ultralytics import YOLO

modelo = YOLO("yolov8n.pt")
modelo.train(data="/content/Calados_Carros-1/data.yaml", epochs=150, imgsz=1280, project="runs", name="train_final")
