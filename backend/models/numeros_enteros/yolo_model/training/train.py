
from ultralytics import YOLO

modelo = YOLO("yolov8n.pt")
modelo.train(data="/content/NewCarro_NumCal_v8-1/data.yaml", epochs=150, imgsz=1280, project="runs", name="train_final")
